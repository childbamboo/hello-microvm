# hello-microvm

microVM（e2b）を使ったリモート AI 開発デモ。チャットで機能要望を入力すると、AI エージェントが microVM 上で自動開発し、完成物を Web プレビューできる。

## Architecture

```
Browser
  ├─ Chat Panel ──→ POST /api/chat ──→ Claude API (generatePlan)
  │                       │
  │                       ├─→ e2b Sandbox (create → commands.run × N → dev server)
  │                       │         ↕ SDK files API (patchDevServerConfig)
  │                       │
  │  ← SSE stream ────────┘
  │    (status, terminal, task, preview, message, error)
  │
  ├─ Status Panel ─── terminal logs + task progress
  └─ Preview Panel ── iframe → https://{port}-{sandboxId}.e2b.app
```

### Flow

1. ユーザーがチャットに機能要望を入力
2. Claude API で開発計画（シェルコマンドのリスト）を生成
3. e2b sandbox（Firecracker microVM）を起動
4. コマンドを順次実行（scaffolding → install → code generation → dev server）
5. dev server 起動前に Vite config を自動パッチ（`allowedHosts: true`, `host: 0.0.0.0`）
6. プレビュー URL を iframe に表示
7. 進捗は SSE でリアルタイム配信

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| API | Next.js Route Handler (SSE streaming) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Sandbox | e2b Code Interpreter (`@e2b/code-interpreter`) |

## Setup

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` に API キーを設定:

```
E2B_API_KEY=your-e2b-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

API キーの取得先:
- **E2B**: https://e2b.dev
- **Anthropic**: https://console.anthropic.com

## Development

```bash
npm run dev     # http://localhost:3000
npm run build   # Production build
npm run lint    # ESLint
```

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts   # SSE endpoint: plan → sandbox → execute → preview
│   ├── page.tsx             # Main UI (3-panel layout)
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles (Tailwind)
├── components/
│   ├── ChatPanel.tsx        # Chat input & message display
│   ├── StatusPanel.tsx      # Terminal output & task progress
│   └── PreviewPanel.tsx     # iframe preview
├── lib/
│   ├── agent.ts             # Claude API integration (plan generation)
│   └── sandbox.ts           # e2b sandbox management & config patching
└── types.ts                 # Shared type definitions (SSEEvent, TaskItem, etc.)

docs/
├── requirements.md          # 開発要件
└── multi-tenant.md          # マルチテナント設計（別フェーズ）
```

## Known Issues & Design Decisions

### e2b sandbox の制約

- **Vite allowedHosts**: e2b プロキシ経由のアクセスは Vite にブロックされるため、dev server 起動前に SDK files API で `allowedHosts: true` を自動パッチし、環境変数 `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.e2b.app` も付与している（3重対策）
- **cwd 非持続**: `sandbox.commands.run()` は個別プロセスで実行されるため、全コマンドに `cwd: PROJECT_DIR` を明示的に指定
- **sandbox ライフサイクル**: 成功時は 5 分の timeout で自動消滅（プレビュー閲覧のため即 kill しない）。エラー時は即座に `sandbox.kill()`

### 今後の確認事項

[docs/requirements.md](./docs/requirements.md) の「今後の確認事項」セクションを参照。

## Docs

詳細な設計ドキュメントは [docs/](./docs/) を参照。
