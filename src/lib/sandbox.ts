import { Sandbox } from "@e2b/code-interpreter";

export async function createSandbox() {
  const sandbox = await Sandbox.create({
    timeoutMs: 5 * 60 * 1000, // 5 min
  });
  return sandbox;
}

export async function runInSandbox(
  sandbox: Sandbox,
  command: string,
  onStdout?: (line: string) => void,
  onStderr?: (line: string) => void
) {
  const result = await sandbox.commands.run(command, {
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
