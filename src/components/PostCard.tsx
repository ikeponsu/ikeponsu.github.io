import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/format-date";

export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="block rounded-xl border border-sky-200 bg-white p-6 transition-all hover:border-sky-400 hover:shadow-md hover:shadow-sky-100"
    >
      <time className="text-xs font-medium text-sky-500">
        {formatDate(post.date)}
      </time>
      <h2 className="mt-2 text-lg font-bold text-sky-900">{post.title}</h2>
      {post.excerpt && (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {post.excerpt}
        </p>
      )}
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
    </Link>
  );
}
