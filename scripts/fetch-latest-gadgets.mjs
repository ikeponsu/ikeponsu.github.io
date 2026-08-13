// Amazon Creators API (PA-API 5.0 の後継) からガジェットカテゴリの新商品を取得し、
// src/content/posts/latest-gadgets.md を上書き生成するスクリプト。
//
// 注意: Creators API は比較的新しく、エンドポイントやレスポンス形式が変わる可能性がある。
// 実行に失敗した場合は、まず `node scripts/fetch-latest-gadgets.mjs` をローカルで
// 環境変数を設定して直接実行し、コンソールに出力される生レスポンスを確認すること。
//
// 必要な環境変数:
//   AMAZON_CREATORS_CLIENT_ID     - Creators API の Client ID (旧 AccessKey とは別物)
//   AMAZON_CREATORS_CLIENT_SECRET - Creators API の Client Secret
//   AMAZON_PARTNER_TAG            - アソシエイトタグ (例: yourtag-22)
//   GEMINI_API_KEY                - 商品紹介コメント生成用 (Gemini API)

import fs from "node:fs";
import path from "node:path";

const TOKEN_URL = "https://api.amazon.co.jp/auth/o2/token";
const SEARCH_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";
const MARKETPLACE = "www.amazon.co.jp";
const KEYWORDS = "ガジェット";
const SEARCH_INDEX = "Electronics";
const ITEM_COUNT = 10;
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CLIENT_ID = process.env.AMAZON_CREATORS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CREATORS_CLIENT_SECRET;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function requireEnv(name, value) {
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。`);
    process.exit(1);
  }
}

requireEnv("AMAZON_CREATORS_CLIENT_ID", CLIENT_ID);
requireEnv("AMAZON_CREATORS_CLIENT_SECRET", CLIENT_SECRET);
requireEnv("AMAZON_PARTNER_TAG", PARTNER_TAG);

async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "creatorsapi::default",
    }),
  });

  if (!res.ok) {
    console.error(`トークン取得に失敗しました: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }

  const data = await res.json();
  if (!data.access_token) {
    console.error("トークン取得レスポンスに access_token がありません。");
    console.error(JSON.stringify(data));
    process.exit(1);
  }
  return data.access_token;
}

async function searchNewGadgets(accessToken) {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-marketplace": MARKETPLACE,
    },
    body: JSON.stringify({
      keywords: KEYWORDS,
      searchIndex: SEARCH_INDEX,
      itemCount: ITEM_COUNT,
      sortBy: "NewestArrivals",
      partnerTag: PARTNER_TAG,
      marketplace: MARKETPLACE,
      resources: [
        "images.primary.medium",
        "itemInfo.title",
        "offersV2.listings.price",
      ],
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    console.error(`商品検索に失敗しました: HTTP ${res.status}`);
    console.error(bodyText);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    console.error("商品検索レスポンスのJSON解析に失敗しました。");
    console.error(bodyText);
    process.exit(1);
  }

  // レスポンスの入れ子構造が未確定なため、複数のパターンを試す。
  const items = data.items ?? data.searchResult?.items ?? data.SearchResult?.Items ?? [];

  if (items.length === 0) {
    console.error("商品が0件でした。レスポンス全体:");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  return items.slice(0, ITEM_COUNT).map(normalizeItem);
}

function normalizeItem(item) {
  const asin = item.asin ?? item.ASIN;
  const title =
    item.itemInfo?.title?.displayValue ??
    item.ItemInfo?.Title?.DisplayValue ??
    "(タイトル不明)";
  const imageUrl =
    item.images?.primary?.medium?.url ??
    item.Images?.Primary?.Medium?.URL ??
    null;
  const price =
    item.offersV2?.listings?.[0]?.price?.displayAmount ??
    item.offersV2?.listings?.[0]?.price?.money?.displayAmount ??
    item.offers?.listings?.[0]?.price?.displayAmount ??
    item.Offers?.Listings?.[0]?.Price?.DisplayAmount ??
    null;

  const url = asin
    ? `https://www.amazon.co.jp/dp/${asin}?tag=${PARTNER_TAG}`
    : item.detailPageUrl ?? item.DetailPageURL ?? "#";

  return { asin, title, imageUrl, price, url };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveComparisonKeyword(title) {
  if (!title || title === "(タイトル不明)") return KEYWORDS;
  const firstWord = title.split(/[ 　]+/)[0];
  return firstWord && firstWord.length >= 2 ? firstWord : KEYWORDS;
}

// 新商品と同ジャンルで評価の高い既存商品を検索し、比較コメント生成用の材料にする。
// タイトルからのキーワード抽出は精度が高くないため、見つからない/的外れな場合は
// null を返し、その商品は比較なしの単独コメントにフォールバックする。
async function searchSimilarProduct(accessToken, item) {
  const keyword = deriveComparisonKeyword(item.title);

  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-marketplace": MARKETPLACE,
      },
      body: JSON.stringify({
        keywords: keyword,
        searchIndex: SEARCH_INDEX,
        itemCount: 5,
        sortBy: "AvgCustomerReviews",
        partnerTag: PARTNER_TAG,
        marketplace: MARKETPLACE,
        resources: ["itemInfo.title", "offersV2.listings.price"],
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error(`比較商品の検索に失敗しました (HTTP ${res.status}): ${item.title}`);
      console.error(bodyText);
      return null;
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      console.error(`比較商品検索レスポンスのJSON解析に失敗しました: ${item.title}`);
      return null;
    }

    const candidates =
      data.items ?? data.searchResult?.items ?? data.SearchResult?.Items ?? [];
    const match = candidates.find((c) => (c.asin ?? c.ASIN) !== item.asin);
    return match ? normalizeItem(match) : null;
  } catch (err) {
    console.error(`比較商品検索中にエラーが発生しました: ${item.title}`);
    console.error(err);
    return null;
  }
}

async function generateCommentary(item, compareItem) {
  if (!GEMINI_API_KEY) return null;

  const prompt = compareItem
    ? "次の2つのAmazon商品を比較する日本語2〜3文のコメントをブログ用に書いてください。" +
      "1つ目は最近発売された新商品、2つ目は同じジャンルで評価の高い既存の定番品です。" +
      "新商品が既存品とどう違うか、どんな人に向いているかを簡潔にまとめてください。" +
      "実在しないスペックや効果を断定的に書かないでください。\n\n" +
      `[新商品]\n商品名: ${item.title}\n` +
      (item.price ? `価格: ${item.price}\n` : "") +
      `\n[既存の定番品]\n商品名: ${compareItem.title}\n` +
      (compareItem.price ? `価格: ${compareItem.price}\n` : "")
    : "次のAmazon商品について、ブログに載せる紹介コメントを日本語1〜2文で書いてください。" +
      "商品名から想像できる魅力を簡潔に伝え、実在しないスペックや効果を断定的に書かないでください。\n\n" +
      `商品名: ${item.title}\n` +
      (item.price ? `価格: ${item.price}\n` : "");

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      console.error(`コメント生成に失敗しました (HTTP ${res.status}): ${item.title}`);
      console.error(await res.text());
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    console.error(`コメント生成中にエラーが発生しました: ${item.title}`);
    console.error(err);
    return null;
  }
}

function buildMarkdown(items, generatedAt) {
  const frontmatter = [
    "---",
    `title: "最新ガジェット情報"`,
    `date: "${generatedAt}"`,
    `excerpt: "Amazonで見つけた発売されたばかりのガジェットを10件紹介します。"`,
    `tags: ["ガジェット", "Amazon"]`,
    "---",
    "",
  ].join("\n");

  const body = items
    .map((item, i) => {
      const lines = [`## ${i + 1}. [${item.title}](${item.url})`];
      if (item.imageUrl) {
        lines.push(`![${item.title}](${item.imageUrl})`);
      }
      if (item.comment) {
        lines.push(item.comment);
      }
      if (item.price) {
        lines.push(`価格: ${item.price}`);
      }
      lines.push(`[Amazonで見る](${item.url})`);
      return lines.join("\n\n");
    })
    .join("\n\n");

  const disclosure =
    "\n\n---\n\n" +
    "当サイトはAmazonアソシエイト・プログラムの参加者であり、" +
    "適格販売により収入を得ています。掲載している価格・商品情報は取得時点のものです。" +
    "最新の情報はAmazon.co.jpの商品ページでご確認ください。";

  return frontmatter + body + disclosure + "\n";
}

async function main() {
  const accessToken = await getAccessToken();
  const items = await searchNewGadgets(accessToken);

  for (const item of items) {
    await sleep(1100); // Creators API のレート制限 (1 req/sec 目安) に配慮
    const compareItem = await searchSimilarProduct(accessToken, item);
    item.comment = await generateCommentary(item, compareItem);
  }

  const generatedAt = new Date().toISOString();
  const markdown = buildMarkdown(items, generatedAt);

  const outputPath = path.join(
    process.cwd(),
    "src/content/posts/latest-gadgets.md",
  );
  fs.writeFileSync(outputPath, markdown, "utf8");
  console.log(`書き込み完了: ${outputPath}`);
}

main();
