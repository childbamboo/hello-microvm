/**
 * Rewrite root-relative paths (e.g. "/src/main.jsx", "/@vite/client")
 * in text responses so they route through the proxy.
 * Matches paths inside quotes or parentheses, but skips protocol-relative
 * URLs ("//...") and already-rewritten proxy paths.
 */
export function rewriteRootRelativePaths(text: string, token: string): string {
  const proxyBase = `/api/preview/${token}`;
  // Only rewrite paths that look like actual resource references (start with
  // a word char or @), skipping standalone "/" and other non-path strings.
  return text.replace(/(["'])\/(?!\/|api\/preview\/)(?=[@\w])/g, `$1${proxyBase}/`);
}

/**
 * Rewrite an upstream Location header so it stays within the proxy.
 * Absolute URLs pointing at the sandbox host are turned into proxy-relative paths.
 */
export function rewriteLocation(
  location: string,
  baseUrl: string,
  token: string
): string {
  if (location.startsWith(baseUrl)) {
    const relative = location.slice(baseUrl.length);
    return `/api/preview/${token}${relative}`;
  }
  // Relative location — prefix with the proxy base
  if (location.startsWith("/")) {
    return `/api/preview/${token}${location}`;
  }
  return location;
}
