import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

const postsDirectory = path.join(process.cwd(), "src/content/posts");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
};

export type ProductItem = {
  name: string;
  url: string;
  image: string | null;
  price: number | null;
};

export type Post = PostMeta & {
  contentHtml: string;
  items: ProductItem[];
};

// 商品紹介系の記事は "## N. 見出し" ごとに商品リンク・画像・価格が並ぶ固定
// フォーマットで生成される。見出し自体がリンクの場合(latest-gadgets等)と、
// 見出しの下に別途リンク行がある場合(trending-products等)の両方に対応する。
// それ以外の記事では空配列を返す。
function extractProductItems(markdown: string): ProductItem[] {
  const headingRegex = /^## \d+\.\s(.+)$/gm;
  const headings = [...markdown.matchAll(headingRegex)];

  return headings
    .map((heading, i) => {
      const headingText = heading[1];
      const blockStart = (heading.index ?? 0) + heading[0].length;
      const blockEnd = headings[i + 1]?.index ?? markdown.length;
      const block = markdown.slice(blockStart, blockEnd);

      const headingLinkMatch = headingText.match(
        /\[(.+?)\]\((https?:\/\/\S+?)\)/,
      );
      const blockLinkMatch = block.match(/\[(.+?)\]\((https?:\/\/\S+?)\)/);
      const imageMatch = block.match(/!\[.*?\]\((https?:\/\/\S+?)\)/);
      const priceMatch = block.match(/価格:\s*[¥￥]([\d,]+)/);

      return {
        name: headingLinkMatch?.[1] ?? blockLinkMatch?.[1] ?? headingText,
        url: headingLinkMatch?.[2] ?? blockLinkMatch?.[2] ?? "",
        image: imageMatch?.[1] ?? null,
        price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null,
      };
    })
    .filter((item) => item.url);
}

// アフィリエイトリンクにGoogle推奨のrel属性を付与する。このブログの記事本文に
// 含まれる外部リンクは現状すべて楽天/Amazonのアフィリエイトリンクのため、
// contentHtml中の外部リンク全体に一律で適用する。
function markOutboundLinksAsSponsored(html: string): string {
  return html.replace(
    /<a href="(https?:\/\/[^"]+)"/g,
    '<a target="_blank" rel="sponsored noopener noreferrer" href="$1"',
  );
}

// 商品画像は読み込みを遅延させ、初期表示のペイロードを減らす。
function addLazyLoadingToImages(html: string): string {
  return html.replace(/<img /g, '<img loading="lazy" decoding="async" ');
}

function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs
    .readdirSync(postsDirectory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

function readPostFile(slug: string) {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  return matter(fileContents);
}

export function getAllPostsMeta(): PostMeta[] {
  const slugs = getPostSlugs();
  const posts = slugs.map((slug) => {
    const { data } = readPostFile(slug);
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? "",
      excerpt: data.excerpt ?? "",
      tags: data.tags ?? [],
    } satisfies PostMeta;
  });

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getAllPostSlugs(): string[] {
  return getPostSlugs();
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const { data, content } = readPostFile(slug);
  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(content);
  const contentHtml = addLazyLoadingToImages(
    markOutboundLinksAsSponsored(processedContent.toString()),
  );

  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? "",
    excerpt: data.excerpt ?? "",
    tags: data.tags ?? [],
    contentHtml,
    items: extractProductItems(content),
  };
}
