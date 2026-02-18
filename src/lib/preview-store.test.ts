import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerPreview, resolvePreview } from "./preview-store";

const globalForPreview = globalThis as unknown as {
  __previewStore: Map<string, unknown>;
};

beforeEach(() => {
  vi.useFakeTimers();
  globalForPreview.__previewStore?.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("preview-store", () => {
  it("register → resolve roundtrip", () => {
    const token = registerPreview("https://abc.e2b.app", "secret");
    const result = resolvePreview(token);
    expect(result).toEqual({ url: "https://abc.e2b.app", accessToken: "secret" });
  });

  it("returns null for unknown token", () => {
    expect(resolvePreview("nonexistent")).toBeNull();
  });

  it("returns null after TTL expires", () => {
    const token = registerPreview("https://abc.e2b.app", "secret");
    // Advance past 5 min TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(resolvePreview(token)).toBeNull();
  });

  it("returns entry just before TTL expires", () => {
    const token = registerPreview("https://abc.e2b.app", "secret");
    // Advance to exactly TTL (boundary — Date.now() === expiresAt is still valid)
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(resolvePreview(token)).toEqual({
      url: "https://abc.e2b.app",
      accessToken: "secret",
    });
  });

  it("cleanup removes expired entries on next register", () => {
    const oldToken = registerPreview("https://old.e2b.app", "old-secret");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Register a new entry — triggers cleanup
    registerPreview("https://new.e2b.app", "new-secret");

    expect(resolvePreview(oldToken)).toBeNull();
    expect(globalForPreview.__previewStore.size).toBe(1);
  });

  it("generates unique tokens", () => {
    const t1 = registerPreview("https://a.e2b.app", "s1");
    const t2 = registerPreview("https://b.e2b.app", "s2");
    expect(t1).not.toBe(t2);
  });
});
