---
title: "Next.jsをGitHub Pagesで公開する方法"
date: "2026-08-13"
excerpt: "Next.jsの静的書き出し機能を使ってGitHub Pages上でブログを公開する手順のメモ。"
tags: ["Next.js", "GitHub Pages"]
---

Next.js には `output: "export"` という設定があり、これを使うと SSR サーバーを使わずに完全な静的ファイル一式（HTML/CSS/JS）を生成できます。GitHub Pages のような静的ホスティングにそのままデプロイできるので便利です。

## 設定のポイント

`next.config.ts` に以下を追加するだけです。

```ts
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
};
```

`username.github.io` のようなユーザー・organizationページの場合はルート配下で公開されるので、`basePath` の設定は不要です。

## デプロイ

GitHub Actions で `next build` を実行し、生成された `out/` ディレクトリを GitHub Pages にアップロードするワークフローを組んでおけば、`main` ブランチに push するだけで自動的に公開されます。

とても手軽にブログサイトが持てるので、おすすめの構成です。
