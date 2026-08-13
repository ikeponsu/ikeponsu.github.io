import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPostSlugs, getPostBySlug } from "@/lib/posts";
import { formatDate } from "@/lib/format-date";

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    return {
      title: post.title,
      description: post.excerpt,
    };
  } catch {
    return {};
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post;
  try {
    post = await getPostBySlug(slug);
  } catch {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-14">
      <Link
        href="/"
        className="text-sm font-medium text-sky-600 hover:text-sky-500"
      >
        ← 記事一覧へ戻る
      </Link>

      <header className="mt-6 mb-10">
        <time className="text-xs font-medium text-sky-500">
          {formatDate(post.date)}
        </time>
        <h1 className="mt-2 text-3xl font-bold text-sky-900">{post.title}</h1>
        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700"
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div
        className="prose-post"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </article>
  );
}
