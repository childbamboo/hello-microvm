"use client";

import { useRef, useEffect } from "react";
import type { TaskItem } from "@/types";

interface Props {
  terminalLogs: string[];
  tasks: TaskItem[];
}

const statusIcon: Record<TaskItem["status"], string> = {
  pending: "\u25cb",
  running: "\u25d4",
  done: "\u25cf",
  error: "\u2716",
};

const statusColor: Record<TaskItem["status"], string> = {
  pending: "text-slate-500",
  running: "text-yellow-400",
  done: "text-green-400",
  error: "text-red-400",
};

export default function StatusPanel({ terminalLogs, tasks }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300">
        作業状況
      </div>

      {/* Task progress */}
      <div className="border-b border-slate-700 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          タスク進捗
        </div>
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-600">タスクなし</p>
        ) : (
          <ul className="space-y-1">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-sm">
                <span className={statusColor[task.status]}>
                  {statusIcon[task.status]}
                </span>
                <span
                  className={
                    task.status === "done"
                      ? "text-slate-500 line-through"
                      : "text-slate-300"
                  }
                >
                  {task.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Terminal output */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          ターミナル
        </div>
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto bg-slate-950 px-4 py-2 font-mono text-xs leading-5 text-green-400"
        >
          {terminalLogs.length === 0 ? (
            <span className="text-slate-600">$ waiting...</span>
          ) : (
            terminalLogs.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
