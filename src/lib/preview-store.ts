import { randomUUID } from "crypto";

interface PreviewEntry {
  /** Actual e2b sandbox preview URL (never exposed to client) */
  url: string;
  /** Auto-expiry timestamp (ms) */
  expiresAt: number;
}

/** In-memory token → e2b URL mapping. Tokens expire with the sandbox (5 min). */
const store = new Map<string, PreviewEntry>();

const TTL_MS = 5 * 60 * 1000; // 5 min — matches sandbox timeout

/** Register a new preview and return the generated token. */
export function registerPreview(e2bUrl: string): string {
  cleanup();
  const token = randomUUID();
  store.set(token, { url: e2bUrl, expiresAt: Date.now() + TTL_MS });
  return token;
}

/** Look up the real e2b URL for a given token. Returns null if invalid/expired. */
export function resolvePreview(token: string): string | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return entry.url;
}

/** Remove expired entries to prevent unbounded growth. */
function cleanup() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (now > entry.expiresAt) store.delete(token);
  }
}
