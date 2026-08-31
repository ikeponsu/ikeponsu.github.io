import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/format-date";

export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link href={`/posts/${post.slug}`} className="group block py-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent">
          {post.title}
        </h2>
        <time className="shrink-0 text-xs text-muted">
          {formatDate(post.date)}
        </time>
      </div>
      {post.excerpt && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {post.excerpt}
        </p>
      )}
      {post.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted"
            >
              #{tag}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
