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

## 最新ガジェット記事の自動更新

`/posts/latest-gadgets` は Amazon Creators API (旧 Product Advertising API 5.0 の後継) から
「ガジェット」カテゴリの新商品を5件取得し、`.github/workflows/update-gadgets.yml` によって
**毎日 9:00 / 12:00 / 18:00 (JST) に自動更新**されます。更新スクリプトは
`scripts/fetch-latest-gadgets.mjs` です。

### 事前準備: Creators API の資格情報発行

旧 PA-API 5.0 は 2026年5月に完全に停止しており、現在は使えません。以下の手順で
新しい資格情報を発行してください。

1. [Associates Central](https://affiliate-program.amazon.co.jp/) にログイン
2. Tools → Creators API を開く
3. Create Application → アプリ名を入力
4. Create Credential → **Client ID** と **Client Secret** が表示される
   （Client Secret は一度しか表示されないので必ず保存する）

### GitHub Secrets への登録

リポジトリの Settings → Secrets and variables → Actions で以下を設定します。

| Secret名 | 内容 |
| --- | --- |
| `AMAZON_CREATORS_CLIENT_ID` | 上記で発行した Client ID |
| `AMAZON_CREATORS_CLIENT_SECRET` | 上記で発行した Client Secret |
| `AMAZON_PARTNER_TAG` | アソシエイトタグ（既存の値をそのまま使用可） |

旧 PA-API 5.0 用に登録していた `AMAZON_ACCESS_KEY` / `AMAZON_SECRET_KEY` /
`AMAZON_PARTNER_TYPE` は Creators API では使用しないため、削除して問題ありません。

### 動作確認

資格情報を登録したら、Actions タブから **Update Latest Gadgets** ワークフローを
`Run workflow`（`workflow_dispatch`）で手動実行し、正常に完了するか確認してください。
Creators API はまだ新しく仕様変更が入りうるため、失敗した場合はワークフローのログに
出力される生レスポンスを確認し、`scripts/fetch-latest-gadgets.mjs` 内のエンドポイント
URL やフィールド名を最新の [Creators API ドキュメント](https://affiliate-program.amazon.com/creatorsapi/docs/)
に合わせて調整してください。
