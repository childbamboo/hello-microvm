import { NextRequest, NextResponse } from "next/server";
import { resolvePreview } from "@/lib/preview-store";
import { rewriteRootRelativePaths, rewriteLocation } from "@/lib/preview-rewrite";

/**
 * Reverse-proxy for sandbox previews.
 * Validates the token, then forwards the request to the real e2b URL.
 * The client never sees the direct *.e2b.app hostname.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; path?: string[] }> }
) {
  const { token, path } = await params;

  const preview = resolvePreview(token);
  if (!preview) {
    return NextResponse.json(
      { error: "Invalid or expired preview token" },
      { status: 403 }
    );
  }

  const { url: baseUrl, accessToken } = preview;

  // Reconstruct the target URL
  const subPath = path ? `/${path.join("/")}` : "";
  const search = req.nextUrl.search; // preserve query string
  const targetUrl = `${baseUrl}${subPath}${search}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        // Forward accept headers so the upstream can content-negotiate
        accept: req.headers.get("accept") ?? "*/*",
        "accept-encoding": req.headers.get("accept-encoding") ?? "",
        // Authenticate with e2b (allowPublicTraffic: false)
        ...(accessToken ? { "e2b-traffic-access-token": accessToken } : {}),
      },
      // Do not follow redirects automatically — pass them through
      redirect: "manual",
    });

    // Build response headers to relay
    const headers = new Headers();
    const passthroughHeaders = [
      "content-type",
      "content-length",
      "cache-control",
      "etag",
      "last-modified",
    ];
    for (const name of passthroughHeaders) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Allow iframe embedding from our own origin
    headers.set("x-frame-options", "SAMEORIGIN");

    // Handle redirects — rewrite Location to go through the proxy
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (location) {
        const rewritten = rewriteLocation(location, baseUrl, token);
        headers.set("location", rewritten);
      }
      return new NextResponse(null, { status: upstream.status, headers });
    }

    // Rewrite root-relative paths in text responses so resources
    // load through the proxy instead of hitting Next.js directly.
    const contentType = upstream.headers.get("content-type") ?? "";
    const isText =
      contentType.includes("text/html") ||
      contentType.includes("javascript") ||
      contentType.includes("text/css");

    if (isText) {
      let body = await upstream.text();
      body = rewriteRootRelativePaths(body, token);
      headers.delete("content-length"); // length changed after rewrite
      return new NextResponse(body, { status: upstream.status, headers });
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach sandbox preview" },
      { status: 502 }
    );
  }
}

