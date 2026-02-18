import { Sandbox } from "@e2b/code-interpreter";

export async function createSandbox() {
  const sandbox = await Sandbox.create({
    timeoutMs: 5 * 60 * 1000, // 5 min
  });
  return sandbox;
}

export const PROJECT_DIR = "/home/user/project";

export async function runInSandbox(
  sandbox: Sandbox,
  command: string,
  onStdout?: (line: string) => void,
  onStderr?: (line: string) => void,
  cwd: string = PROJECT_DIR
) {
  const result = await sandbox.commands.run(command, {
    cwd,
    onStdout: onStdout
      ? (data: string) => onStdout(data)
      : undefined,
    onStderr: onStderr
      ? (data: string) => onStderr(data)
      : undefined,
  });
  return result;
}

export function getPreviewUrl(sandbox: Sandbox, port: number = 3000) {
  const host = sandbox.getHost(port);
  return `https://${host}`;
}

/**
 * Ensure the dev server config allows e2b proxy access.
 * 1. Set allowedHosts: true (Vite security check)
 * 2. Set host: '0.0.0.0' (so e2b proxy can reach the server)
 * Uses SDK files API to avoid shell escaping issues.
 * Returns debug info about what was done.
 */
export async function patchDevServerConfig(sandbox: Sandbox): Promise<string[]> {
  const logs: string[] = [];
  const viteFiles = ["vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.mts"];

  for (const f of viteFiles) {
    const filePath = `${PROJECT_DIR}/${f}`;
    if (!(await sandbox.files.exists(filePath))) continue;

    logs.push(`[patch] Found ${f}`);
    let content = await sandbox.files.read(filePath, { format: "text" });

    // Fix invalid allowedHosts values (e.g. "all" → true)
    if (/allowedHosts\s*:\s*["']all["']/.test(content)) {
      content = content.replace(
        /allowedHosts\s*:\s*["']all["']/,
        "allowedHosts: true"
      );
      logs.push("[patch] Fixed allowedHosts: 'all' → true");
    }

    // If no server block exists, add one inside defineConfig
    if (!/server\s*:\s*\{/.test(content)) {
      const replaced = content.replace(
        /defineConfig\s*\(\s*\{/,
        "defineConfig({\n    server: { allowedHosts: true, host: '0.0.0.0' },"
      );
      if (replaced !== content) {
        content = replaced;
        logs.push("[patch] Added server block with allowedHosts + host");
      }
    } else {
      // Existing server block — inject missing properties
      if (!content.includes("allowedHosts")) {
        content = content.replace(
          /server\s*:\s*\{/,
          "server: {\n      allowedHosts: true,"
        );
        logs.push("[patch] Added allowedHosts: true");
      }

      if (!content.includes("host:") && !content.includes("host :")) {
        content = content.replace(
          /server\s*:\s*\{/,
          "server: {\n      host: '0.0.0.0',"
        );
        logs.push("[patch] Added host: '0.0.0.0'");
      }
    }

    await sandbox.files.write(filePath, content);

    // Read back to verify
    const verified = await sandbox.files.read(filePath, { format: "text" });
    logs.push(`[patch] Config after patch:\n${verified}`);
    return logs;
  }

  logs.push("[patch] No vite config file found");
  return logs;
}

/**
 * Wrap a dev server command with env var to allow e2b proxy hosts.
 * Uses shell prefix (VAR=value cmd) for maximum reliability.
 */
export function wrapWithAllowedHosts(command: string): string {
  return `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.e2b.app ${command}`;
}
