// Googleトレンド(RSS)から急上昇キーワードを取得し、Amazon Creators API で関連商品を検索、
// Geminiで紹介コメントを生成して src/content/posts/trending-products-amazon.md を上書き生成する。
// 楽天版 (fetch-trending-products.mjs) の Amazon版。
//
// 必要な環境変数 (latest-gadgets 用と共通):
//   AMAZON_CREATORS_CLIENT_ID     - Creators API の Client ID
//   AMAZON_CREATORS_CLIENT_SECRET - Creators API の Client Secret
//   AMAZON_PARTNER_TAG            - アソシエイトタグ
//   GEMINI_API_KEY                 - 紹介コメント生成用 (Gemini API, 省略時はコメントなしで生成)

import fs from "node:fs";
import path from "node:path";

const RSS_URL = "https://trends.google.co.jp/trending/rss?geo=JP";
const TOKEN_URL = "https://api.amazon.co.jp/auth/o2/token";
const SEARCH_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";
const MARKETPLACE = "www.amazon.co.jp";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TARGET_COUNT = 10;

const NG_WORDS = [
  "訃報",
  "死去",
  "逮捕",
  "容疑者",
  "事故",
  "事件",
  "殺害",
  "遺体",
  "お別れ",
];

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeXmlText(raw) {
  let text = raw.trim();
  const cdata = text.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) text = cdata[1];
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchGoogleTrends() {
  try {
    const res = await fetch(RSS_URL);
    if (!res.ok) {
      console.error(`Googleトレンド取得に失敗しました: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return itemBlocks
      .map((block) => {
        const m = block.match(/<title>([\s\S]*?)<\/title>/);
        return m ? decodeXmlText(m[1]) : null;
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Googleトレンド取得中にエラーが発生しました。");
    console.error(err);
    return [];
  }
}

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
  const priceText =
    item.offersV2?.listings?.[0]?.price?.displayAmount ??
    item.offersV2?.listings?.[0]?.price?.money?.displayAmount ??
    null;

  const url = asin
    ? `https://www.amazon.co.jp/dp/${asin}?tag=${PARTNER_TAG}`
    : item.detailPageUrl ?? item.DetailPageURL ?? "#";

  return { title, imageUrl, priceText, url };
}

async function searchAmazonItem(accessToken, keyword) {
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
        itemCount: 1,
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
      console.error(`Amazon商品検索に失敗しました (HTTP ${res.status}): ${keyword}`);
      console.error(bodyText);
      return null;
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      console.error(`Amazon商品検索レスポンスのJSON解析に失敗しました: ${keyword}`);
      return null;
    }

    const items =
      data.items ?? data.searchResult?.items ?? data.SearchResult?.Items ?? [];
    return items.length > 0 ? normalizeItem(items[0]) : null;
  } catch (err) {
    console.error(`Amazon商品検索中にエラーが発生しました: ${keyword}`);
    console.error(err);
    return null;
  }
}

// Geminiで紹介コメントを生成する。不適切な話題と判定された場合は skip: true を返す。
async function generateComment(trend, item) {
  if (!GEMINI_API_KEY) return { skip: false, text: null };

  const prompt =
    "あなたはブログに載せる紹介文を書くアシスタントです。\n\n" +
    `【話題のキーワード】: ${trend}\n` +
    `【関連するおすすめ商品】: ${item.title}\n` +
    (item.priceText ? `【価格】: ${item.priceText}\n` : "") +
    "\n上記のキーワードと商品について、ブログに載せる紹介コメントを日本語2〜3文で書いてください。\n" +
    "- キーワードと商品の関連性を自然に説明する\n" +
    "- 実在しないスペックや効果を断定的に書かない\n" +
    "- 事故・訃報・犯罪など不謹慎な話題、またはネガティブなニュースに便乗する内容だと判断した場合は、" +
    '他には何も書かず "SKIP" とだけ出力する\n';

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      console.error(`コメント生成に失敗しました (HTTP ${res.status}): ${trend}`);
      console.error(await res.text());
      return { skip: false, text: null };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return { skip: false, text: null };
    if (text.includes("SKIP")) return { skip: true, text: null };
    return { skip: false, text };
  } catch (err) {
    console.error(`コメント生成中にエラーが発生しました: ${trend}`);
    console.error(err);
    return { skip: false, text: null };
  }
}

function buildMarkdown(results, generatedAt) {
  const frontmatter = [
    "---",
    `title: "今話題のトレンド × Amazonのおすすめ商品"`,
    `date: "${generatedAt}"`,
    `excerpt: "Googleトレンドで話題のキーワードと、関連するAmazonのおすすめ商品を紹介します。"`,
    `tags: ["トレンド", "Amazon"]`,
    "---",
    "",
  ].join("\n");

  const body = results
    .map(({ trend, item, comment }, i) => {
      const lines = [`## ${i + 1}. ${trend}`, `[${item.title}](${item.url})`];
      if (item.imageUrl) {
        lines.push(`![${item.title}](${item.imageUrl})`);
      }
      if (comment) {
        lines.push(comment);
      }
      if (item.priceText) {
        lines.push(`価格: ${item.priceText}`);
      }
      lines.push(`[Amazonで見る](${item.url})`);
      return lines.join("\n\n");
    })
    .join("\n\n");

  const disclosure =
    "\n\n---\n\n" +
    "当サイトはAmazonアソシエイト・プログラムの参加者であり、適格販売により収入を得ています。" +
    "掲載している価格・商品情報は取得時点のものです。最新の情報はAmazon.co.jpの商品ページでご確認ください。" +
    "トレンドキーワードはGoogleトレンドの情報を基に自動抽出したものです。";

  return frontmatter + body + disclosure + "\n";
}

async function main() {
  const trends = await fetchGoogleTrends();
  if (trends.length === 0) {
    console.error("トレンドが取得できませんでした。");
    process.exit(1);
  }

  const accessToken = await getAccessToken();

  const results = [];
  for (const trend of trends) {
    if (results.length >= TARGET_COUNT) break;

    if (NG_WORDS.some((ng) => trend.includes(ng))) {
      console.log(`NGワード検知によりスキップ: ${trend}`);
      continue;
    }

    await sleep(1200); // Creators API のレート制限に配慮

    const item = await searchAmazonItem(accessToken, trend);
    if (!item) {
      console.log(`関連商品なしのためスキップ: ${trend}`);
      continue;
    }

    const { skip, text } = await generateComment(trend, item);
    if (skip) {
      console.log(`Geminiが不適切と判定したためスキップ: ${trend}`);
      continue;
    }

    results.push({ trend, item, comment: text });
  }

  if (results.length === 0) {
    console.error("紹介できるトレンド×商品の組み合わせが見つかりませんでした。");
    process.exit(1);
  }

  if (results.length < TARGET_COUNT) {
    console.log(
      `目標の${TARGET_COUNT}件に届かず、${results.length}件で生成します。`,
    );
  }

  const generatedAt = new Date().toISOString();
  const markdown = buildMarkdown(results, generatedAt);

  const outputPath = path.join(
    process.cwd(),
    "src/content/posts/trending-products-amazon.md",
  );
  fs.writeFileSync(outputPath, markdown, "utf8");
  console.log(`書き込み完了: ${outputPath}`);
}

main();
