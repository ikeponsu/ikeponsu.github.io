import { getAllPostsMeta } from "@/lib/posts";
import { siteConfig } from "@/lib/site-config";
import PostCard from "@/components/PostCard";

export default function Home() {
  const posts = getAllPostsMeta();

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <section className="mb-16">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {siteConfig.title}
        </h1>
        <p className="mt-4 text-lg text-muted">{siteConfig.description}</p>
      </section>

      {posts.length === 0 ? (
        <p className="text-muted">まだ記事がありません。</p>
      ) : (
        <ul className="divide-y divide-line">
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
