"use client";

import { useState, useCallback } from "react";
import ChatPanel from "@/components/ChatPanel";
import StatusPanel from "@/components/StatusPanel";
import PreviewPanel from "@/components/PreviewPanel";
import type { ChatMessage, TaskItem, SSEEvent } from "@/types";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "starting" | "running" | "done" | "error"
  >("idle");

  const isProcessing = status === "starting" || status === "running";

  const handleSend = useCallback(
    async (content: string) => {
      if (isProcessing) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMsg]);
      setTasks([]);
      setTerminalLogs([]);
      setPreviewUrl(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const dataLine = line.replace(/^data: /, "");
            if (!dataLine) continue;

            try {
              const event: SSEEvent = JSON.parse(dataLine);
              switch (event.type) {
                case "status":
                  setStatus(event.status);
                  break;
                case "terminal":
                  setTerminalLogs((prev) => [...prev, event.line]);
                  break;
                case "task":
                  setTasks((prev) => {
                    const idx = prev.findIndex((t) => t.id === event.task.id);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = event.task;
                      return next;
                    }
                    return [...prev, event.task];
                  });
                  break;
                case "preview":
                  setPreviewUrl(event.url);
                  break;
                case "message":
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `msg-${Date.now()}`,
                      role: "assistant",
                      content: event.content,
                    },
                  ]);
                  break;
                case "error":
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `msg-${Date.now()}`,
                      role: "assistant",
                      content: `エラー: ${event.message}`,
                    },
                  ]);
                  break;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (error) {
        setStatus("error");
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: `接続エラー: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ]);
      }
    },
    [isProcessing]
  );

  return (
    <div className="flex h-screen flex-col bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700 px-6 py-3">
        <h1 className="text-lg font-bold text-white">hello-microvm</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status === "idle"
                ? "bg-slate-500"
                : status === "done"
                  ? "bg-green-400"
                  : status === "error"
                    ? "bg-red-400"
                    : "animate-pulse bg-yellow-400"
            }`}
          />
          <span className="text-slate-400">
            {status === "idle"
              ? "待機中"
              : status === "starting"
                ? "準備中..."
                : status === "running"
                  ? "開発中..."
                  : status === "done"
                    ? "完了"
                    : "エラー"}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex w-1/3 flex-col border-r border-slate-700">
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            disabled={isProcessing}
          />
        </div>

        {/* Right: Status + Preview */}
        <div className="flex w-2/3 flex-col">
          <div className="flex-1 overflow-hidden border-b border-slate-700">
            <StatusPanel terminalLogs={terminalLogs} tasks={tasks} />
          </div>
          <div className="h-[40%]">
            <PreviewPanel url={previewUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
