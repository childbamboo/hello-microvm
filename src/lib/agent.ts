import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `あなたは Web アプリケーション開発を行う AI エージェントです。
ユーザーの機能要望を受け取り、シェルコマンドのリストとして開発手順を生成してください。

ルール:
- モックアップ用途の簡易な Web アプリを作成する
- フレームワークは状況に応じて選択（React, HTML+CSS+JS 等）
- レスポンスは JSON 形式で返す
- 各ステップはシェルコマンドとして実行可能な形にする
- 全てのコマンドは空のプロジェクトディレクトリ内で実行される。cd は不要。npm init や npx create-xxx は現在のディレクトリに直接ファイルを生成するようにする
- 最後に dev server を起動するコマンドを含める（ポート 3000）
- 重要: アプリはリモートの sandbox 環境で実行され、外部プロキシ経由でアクセスされる。dev server は全てのホストからのアクセスを許可する必要がある:
  - Vite の場合: vite.config に server.allowedHosts: "all" を設定する、または起動コマンドに --host を付ける
  - Next.js の場合: --hostname 0.0.0.0 を付ける
  - その他: 同等のホスト許可設定を行う

レスポンス形式:
{
  "tasks": [
    { "label": "タスクの説明", "command": "実行するシェルコマンド" }
  ],
  "summary": "作成するアプリの概要"
}`;

export interface AgentTask {
  label: string;
  command: string;
}

export interface AgentPlan {
  tasks: AgentTask[];
  summary: string;
}

export async function generatePlan(userMessage: string): Promise<AgentPlan> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse agent response as JSON");
  }

  return JSON.parse(jsonMatch[0]) as AgentPlan;
}
