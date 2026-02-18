import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hello-microvm",
  description: "microVM を使ったリモート AI 開発デモ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
