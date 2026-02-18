import { NextRequest } from "next/server";
import { generatePlan } from "@/lib/agent";
import { createSandbox, runInSandbox, getPreviewUrl, patchDevServerConfig, wrapWithAllowedHosts, PROJECT_DIR } from "@/lib/sandbox";
import { registerPreview } from "@/lib/preview-store";
import type { SSEEvent, TaskItem } from "@/types";

function sseEncode(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const { message } = (await req.json()) as { message: string };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(sseEncode(event)));
      };

      let sandbox: Awaited<ReturnType<typeof createSandbox>> | null = null;
      try {
        // 1. Generate development plan via LLM
        send({ type: "status", status: "starting" });
        send({ type: "terminal", line: "$ Generating development plan..." });

        const plan = await generatePlan(message);
        send({
          type: "message",
          content: plan.summary,
        });

        // Send initial tasks
        const tasks: TaskItem[] = plan.tasks.map((t, i) => ({
          id: `task-${i}`,
          label: t.label,
          status: "pending" as const,
        }));
        for (const task of tasks) {
          send({ type: "task", task });
        }

        // 2. Create sandbox
        send({ type: "terminal", line: "$ Creating microVM sandbox..." });
        send({ type: "status", status: "running" });
        sandbox = await createSandbox();
        await sandbox.commands.run(`mkdir -p ${PROJECT_DIR}`);
        send({
          type: "terminal",
          line: `$ Sandbox created: ${sandbox.sandboxId}`,
        });

        // 3. Execute each task
        for (let i = 0; i < plan.tasks.length; i++) {
          const task = plan.tasks[i];
          tasks[i].status = "running";
          send({ type: "task", task: tasks[i] });
          send({ type: "terminal", line: `$ ${task.command}` });

          const isLastTask = i === plan.tasks.length - 1;

          if (isLastTask) {
            // Patch config: allowedHosts: true + host: '0.0.0.0'
            const patchLogs = await patchDevServerConfig(sandbox);
            for (const log of patchLogs) {
              send({ type: "terminal", line: log });
            }
            // Start dev server with env var prefix for additional safety
            const wrappedCmd = wrapWithAllowedHosts(task.command);
            send({ type: "terminal", line: `$ ${wrappedCmd}` });
            await sandbox.commands.run(wrappedCmd, {
              background: true,
              cwd: PROJECT_DIR,
            });
            send({ type: "terminal", line: "(running in background)" });
          } else {
            const result = await runInSandbox(
              sandbox,
              task.command,
              (line) => send({ type: "terminal", line }),
              (line) => send({ type: "terminal", line: `[stderr] ${line}` })
            );

            if (result.exitCode !== 0) {
              tasks[i].status = "error";
              send({ type: "task", task: tasks[i] });
              send({
                type: "error",
                message: `Task failed: ${task.label} (exit code ${result.exitCode})`,
              });
              send({ type: "status", status: "error" });
              controller.close();
              return;
            }
          }

          tasks[i].status = "done";
          send({ type: "task", task: tasks[i] });
        }

        // 4. Get preview URL (proxied through our server with token auth)
        // Wait a moment for the dev server to start
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const e2bUrl = getPreviewUrl(sandbox, 3000);
        const token = registerPreview(e2bUrl);
        const previewUrl = `/api/preview/${token}`;
        send({ type: "preview", url: previewUrl });
        send({ type: "terminal", line: `$ Preview ready (token-protected)` });
        send({ type: "status", status: "done" });
        send({
          type: "message",
          content: `開発が完了しました。プレビューをご確認ください。`,
        });
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
        send({ type: "status", status: "error" });
        // Clean up sandbox on error only; successful sandboxes stay alive
        // for preview access until the timeout (5 min) expires
        if (sandbox) {
          sandbox.kill().catch(() => {});
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
