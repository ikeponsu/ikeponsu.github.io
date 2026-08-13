import { getAllPostsMeta } from "@/lib/posts";
import { siteConfig } from "@/lib/site-config";
import PostCard from "@/components/PostCard";

export default function Home() {
  const posts = getAllPostsMeta();

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <section className="mb-12">
        <h1 className="text-3xl font-bold text-sky-900">{siteConfig.title}</h1>
        <p className="mt-3 text-slate-600">{siteConfig.description}</p>
      </section>

      {posts.length === 0 ? (
        <p className="text-slate-500">まだ記事がありません。</p>
      ) : (
        <ul className="flex flex-col gap-5">
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
