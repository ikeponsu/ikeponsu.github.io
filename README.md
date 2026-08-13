# ikeponsu.github.io

Next.js + Tailwind CSS で作った個人ブログです。GitHub Pages 上で静的サイトとして公開しています。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

## 記事の追加

`src/content/posts/` に Markdown ファイルを追加します。ファイル名がそのまま URL のスラッグになります（例: `my-post.md` → `/posts/my-post`）。

```md
---
title: "記事タイトル"
date: "2026-08-13"
excerpt: "一覧に表示される概要文。"
tags: ["tag1", "tag2"]
---

本文を Markdown で書きます。
```

## サイト情報の変更

`src/lib/site-config.ts` でサイト名・説明文・著者名を変更できます。

## デプロイ

`main` ブランチに push すると `.github/workflows/deploy.yml` が自動的に `npm run build` を実行し、GitHub Pages に静的ファイルをデプロイします。

初回だけ、リポジトリの Settings → Pages で "Source" を **GitHub Actions** に設定してください。

## ビルド

```bash
npm run build
```

`next.config.ts` で `output: "export"` を指定しているため、`out/` ディレクトリに静的ファイルが生成されます。
