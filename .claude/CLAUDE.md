# hello-microvm

## Project Overview

microVM（e2b）を使ったリモート AI 開発デモ PoC。
チャットで機能要望を入力 → Claude API で開発計画生成 → e2b sandbox 内で自動開発 → Web プレビュー。

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`, model: `claude-sonnet-4-5-20250929`)
- **Sandbox**: e2b Code Interpreter (`@e2b/code-interpreter`)
- **Language**: TypeScript (strict)

## Architecture

```
POST /api/chat (SSE streaming)
  → generatePlan() — Claude API でシェルコマンドのリストを生成
  → createSandbox() — e2b microVM 起動
  → runInSandbox() × N — コマンド順次実行（cwd: PROJECT_DIR）
  → patchDevServerConfig() — Vite config 自動パッチ
  → wrapWithAllowedHosts() — 環境変数プレフィックス付きで dev server 起動
  → getPreviewUrl() — e2b プロキシ URL 取得
```

## Key Files

| File | Role |
|---|---|
| `src/app/api/chat/route.ts` | メイン API エンドポイント。SSE で進捗をストリーミング |
| `src/lib/agent.ts` | Claude API 呼び出し。システムプロンプトで開発計画の JSON を生成 |
| `src/lib/sandbox.ts` | e2b sandbox のライフサイクル管理、config パッチ、プレビュー URL |
| `src/app/page.tsx` | メイン UI。3 パネルレイアウト（Chat / Status / Preview） |
| `src/types.ts` | 共有型定義（SSEEvent, TaskItem, ChatMessage 等） |

## e2b Sandbox の重要な制約

開発中に発見したハマりどころ。修正時は必ず考慮すること。

### cwd が持続しない
`sandbox.commands.run()` は個別プロセスで実行される。`cd` は効かない。
全コマンドに `cwd: PROJECT_DIR`（`/home/user/project`）を明示的に指定する。

### Vite allowedHosts
e2b プロキシ（`*.e2b.app`）経由のアクセスは Vite のセキュリティチェックにブロックされる。
現在 3 重の対策を実施:
1. **SDK files API** で vite.config に `allowedHosts: true` を注入（`patchDevServerConfig()`）
2. **環境変数** `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.e2b.app` をシェルプレフィックスで付与（`wrapWithAllowedHosts()`）
3. **LLM プロンプト** にもホスト許可設定の指示を含める（補助的）

config パッチは `sed` やシェル経由だと e2b 内でエスケープが壊れるため、必ず SDK の `sandbox.files.read()/write()` を使う。

### sandbox ライフサイクル
- 成功時: kill しない（プレビュー閲覧のため）。`timeoutMs: 5 * 60 * 1000` で自動消滅
- エラー時: 即座に `sandbox.kill()` でクリーンアップ
- e2b Dashboard で concurrent sandbox 数を監視すること

## Environment Variables

```
E2B_API_KEY      — e2b API キー (https://e2b.dev)
ANTHROPIC_API_KEY — Anthropic API キー (https://console.anthropic.com)
```

## Coding Conventions

- コードコメントは英語
- ドキュメント・UI テキストは日本語
- Conventional Commits 形式（`feat:`, `fix:`, `docs:` 等）
- コンポーネントは `src/components/` に配置、`"use client"` を明示

## Development Commands

```bash
npm run dev     # Dev server (http://localhost:3000)
npm run build   # Production build
npm run lint    # ESLint
```

## Design Documents

- `docs/requirements.md` — 開発要件・機能仕様・画面構成
- `docs/multi-tenant.md` — マルチテナント設計（別フェーズ）

## Don't

- `sandbox.commands.run()` で `cwd` を省略しない
- Vite config のパッチに `sed` やシェルコマンドを使わない（SDK files API を使う）
- 成功時に sandbox を即 kill しない（プレビューが見えなくなる）
- `allowedHosts: 'all'` を使わない（Vite では無効値。正しくは `true`）
