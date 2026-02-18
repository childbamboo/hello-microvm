import { describe, it, expect } from "vitest";
import { rewriteRootRelativePaths, rewriteLocation } from "./preview-rewrite";

const TOKEN = "test-token-abc";
const PROXY = `/api/preview/${TOKEN}`;

describe("rewriteRootRelativePaths", () => {
  it("rewrites quoted root-relative paths", () => {
    const html = `<script src="/src/main.jsx"></script>`;
    expect(rewriteRootRelativePaths(html, TOKEN)).toBe(
      `<script src="${PROXY}/src/main.jsx"></script>`
    );
  });

  it("rewrites single-quoted paths", () => {
    const css = `url('/assets/bg.png')`;
    expect(rewriteRootRelativePaths(css, TOKEN)).toBe(
      `url('${PROXY}/assets/bg.png')`
    );
  });

  it("skips protocol-relative URLs (//)", () => {
    const html = `<script src="//cdn.example.com/lib.js"></script>`;
    expect(rewriteRootRelativePaths(html, TOKEN)).toBe(html);
  });

  it("does not double-rewrite already-proxied paths", () => {
    const html = `<script src="${PROXY}/src/main.jsx"></script>`;
    expect(rewriteRootRelativePaths(html, TOKEN)).toBe(html);
  });

  it("skips standalone /", () => {
    const html = `<a href="/">Home</a>`;
    expect(rewriteRootRelativePaths(html, TOKEN)).toBe(html);
  });

  it("rewrites multiple paths in one string", () => {
    const html = `<link href="/style.css"/><script src="/@vite/client"></script>`;
    const expected = `<link href="${PROXY}/style.css"/><script src="${PROXY}/@vite/client"></script>`;
    expect(rewriteRootRelativePaths(html, TOKEN)).toBe(expected);
  });

  it("rewrites @-prefixed paths (Vite)", () => {
    const js = `import "/@vite/client";`;
    expect(rewriteRootRelativePaths(js, TOKEN)).toBe(
      `import "${PROXY}/@vite/client";`
    );
  });
});

describe("rewriteLocation", () => {
  const BASE = "https://abc123.e2b.app";

  it("rewrites absolute e2b URL to proxy path", () => {
    expect(rewriteLocation(`${BASE}/foo/bar`, BASE, TOKEN)).toBe(
      `${PROXY}/foo/bar`
    );
  });

  it("rewrites root-relative path", () => {
    expect(rewriteLocation("/dashboard", BASE, TOKEN)).toBe(
      `${PROXY}/dashboard`
    );
  });

  it("passes through external URLs unchanged", () => {
    const ext = "https://example.com/callback";
    expect(rewriteLocation(ext, BASE, TOKEN)).toBe(ext);
  });

  it("rewrites base URL with no trailing path", () => {
    expect(rewriteLocation(BASE, BASE, TOKEN)).toBe(PROXY);
  });
});
