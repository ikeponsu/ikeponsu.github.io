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

// trending-products系の記事は "## N. キーワード" ごとに商品リンク・画像・価格が
// 並ぶ固定フォーマットで生成される。それ以外の記事では空配列を返す。
function extractProductItems(markdown: string): ProductItem[] {
  const blocks = markdown.split(/^## \d+\.\s.+$/m).slice(1);

  return blocks
    .map((block) => {
      const linkMatch = block.match(/\[(.+?)\]\((https?:\/\/\S+?)\)/);
      const imageMatch = block.match(/!\[.*?\]\((https?:\/\/\S+?)\)/);
      const priceMatch = block.match(/価格:\s*¥([\d,]+)/);

      return {
        name: linkMatch?.[1] ?? "",
        url: linkMatch?.[2] ?? "",
        image: imageMatch?.[1] ?? null,
        price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null,
      };
    })
    .filter((item) => item.url);
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
  const contentHtml = processedContent.toString();

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
