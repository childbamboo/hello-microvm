export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface TaskItem {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

export interface SandboxSession {
  sandboxId: string;
  status: "starting" | "running" | "done" | "error";
  previewUrl: string | null;
  tasks: TaskItem[];
  terminalLogs: string[];
}

// SSE event types sent from the API
export type SSEEvent =
  | { type: "status"; status: SandboxSession["status"] }
  | { type: "terminal"; line: string }
  | { type: "task"; task: TaskItem }
  | { type: "preview"; url: string }
  | { type: "message"; content: string }
  | { type: "error"; message: string };
