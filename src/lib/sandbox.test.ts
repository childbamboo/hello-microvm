import { describe, it, expect, vi, beforeEach } from "vitest";
import { patchDevServerConfig, wrapWithAllowedHosts } from "./sandbox";
import type { Sandbox } from "@e2b/code-interpreter";

// Lightweight mock for e2b Sandbox's files API
function createMockSandbox(files: Record<string, string> = {}) {
  const store = new Map(Object.entries(files));
  return {
    files: {
      exists: vi.fn(async (path: string) => store.has(path)),
      read: vi.fn(async (path: string) => {
        const content = store.get(path);
        if (content === undefined) throw new Error(`File not found: ${path}`);
        return content;
      }),
      write: vi.fn(async (path: string, content: string) => {
        store.set(path, content);
      }),
    },
    _store: store,
  } as unknown as Sandbox & { _store: Map<string, string> };
}

describe("patchDevServerConfig", () => {
  it("adds server block when none exists", async () => {
    const sandbox = createMockSandbox({
      "/home/user/project/vite.config.ts": [
        'import { defineConfig } from "vite";',
        "export default defineConfig({",
        "  plugins: [],",
        "});",
      ].join("\n"),
    });

    const logs = await patchDevServerConfig(sandbox);

    expect(logs).toContain("[patch] Found vite.config.ts");
    expect(logs).toContain("[patch] Added server block with allowedHosts + host");

    const content = sandbox._store.get("/home/user/project/vite.config.ts")!;
    expect(content).toContain("allowedHosts: true");
    expect(content).toContain("host: '0.0.0.0'");
  });

  it("injects into existing server block", async () => {
    const sandbox = createMockSandbox({
      "/home/user/project/vite.config.ts": [
        'import { defineConfig } from "vite";',
        "export default defineConfig({",
        "  server: {",
        "    port: 3000,",
        "  },",
        "});",
      ].join("\n"),
    });

    const logs = await patchDevServerConfig(sandbox);

    expect(logs).toContain("[patch] Added allowedHosts: true");
    expect(logs).toContain("[patch] Added host: '0.0.0.0'");

    const content = sandbox._store.get("/home/user/project/vite.config.ts")!;
    expect(content).toContain("allowedHosts: true");
    expect(content).toContain("host: '0.0.0.0'");
    expect(content).toContain("port: 3000");
  });

  it('fixes allowedHosts: "all" → true', async () => {
    const sandbox = createMockSandbox({
      "/home/user/project/vite.config.js": [
        'import { defineConfig } from "vite";',
        "export default defineConfig({",
        "  server: {",
        '    allowedHosts: "all",',
        "    host: '0.0.0.0',",
        "  },",
        "});",
      ].join("\n"),
    });

    const logs = await patchDevServerConfig(sandbox);

    expect(logs).toContain("[patch] Fixed allowedHosts: 'all' → true");

    const content = sandbox._store.get("/home/user/project/vite.config.js")!;
    expect(content).toContain("allowedHosts: true");
    expect(content).not.toContain('"all"');
  });

  it("skips patching when config already correct", async () => {
    const sandbox = createMockSandbox({
      "/home/user/project/vite.config.ts": [
        'import { defineConfig } from "vite";',
        "export default defineConfig({",
        "  server: {",
        "    allowedHosts: true,",
        "    host: '0.0.0.0',",
        "  },",
        "});",
      ].join("\n"),
    });

    const logs = await patchDevServerConfig(sandbox);

    // Should find the file but not log any patch actions (besides find + verify)
    expect(logs).toContain("[patch] Found vite.config.ts");
    expect(logs.filter((l) => l.startsWith("[patch] Added"))).toHaveLength(0);
    expect(logs.filter((l) => l.startsWith("[patch] Fixed"))).toHaveLength(0);
  });

  it("reports no config file found", async () => {
    const sandbox = createMockSandbox({});

    const logs = await patchDevServerConfig(sandbox);

    expect(logs).toContain("[patch] No vite config file found");
  });
});

describe("wrapWithAllowedHosts", () => {
  it("prefixes command with env var", () => {
    const result = wrapWithAllowedHosts("npm run dev");
    expect(result).toBe(
      "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.e2b.app npm run dev"
    );
  });
});
