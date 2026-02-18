"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatPanel({ messages, onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300">
        Chat
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            機能要望を入力してください
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? "ml-8 bg-blue-600 text-white"
                : "mr-8 bg-slate-700 text-slate-200"
            }`}
          >
            {msg.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-slate-700 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="機能要望を入力..."
            disabled={disabled}
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
