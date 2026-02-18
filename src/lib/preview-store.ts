import { randomUUID } from "crypto";

interface PreviewEntry {
  /** Actual e2b sandbox preview URL (never exposed to client) */
  url: string;
  /** e2b traffic access token for authenticated proxy requests */
  accessToken: string;
  /** Auto-expiry timestamp (ms) */
  expiresAt: number;
}

/**
 * In-memory token → e2b URL mapping. Tokens expire with the sandbox (5 min).
 * Stored on globalThis so the Map survives HMR re-evaluation in Next.js dev mode
 * and stays shared across all route handlers.
 */
const globalForPreview = globalThis as unknown as {
  __previewStore: Map<string, PreviewEntry>;
};
const store =
  globalForPreview.__previewStore ??
  (globalForPreview.__previewStore = new Map<string, PreviewEntry>());

const TTL_MS = 5 * 60 * 1000; // 5 min — matches sandbox timeout

/** Register a new preview and return the generated token. */
export function registerPreview(e2bUrl: string, accessToken: string): string {
  cleanup();
  const token = randomUUID();
  store.set(token, { url: e2bUrl, accessToken, expiresAt: Date.now() + TTL_MS });
  return token;
}

/** Look up the real e2b URL and access token for a given token. */
export function resolvePreview(token: string): { url: string; accessToken: string } | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return { url: entry.url, accessToken: entry.accessToken };
}

/** Remove expired entries to prevent unbounded growth. */
function cleanup() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (now > entry.expiresAt) store.delete(token);
  }
}
