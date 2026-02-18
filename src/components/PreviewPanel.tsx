"use client";

interface Props {
  url: string | null;
}

export default function PreviewPanel({ url }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <span className="text-sm font-semibold text-slate-300">
          プレビュー
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline"
          >
            新しいタブで開く
          </a>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center">
        {url ? (
          <iframe
            src={url}
            title="Preview"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <p className="text-sm text-slate-600">
            開発完了後にプレビューが表示されます
          </p>
        )}
      </div>
    </div>
  );
}
