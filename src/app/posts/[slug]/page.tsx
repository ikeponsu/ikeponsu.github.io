import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllPostSlugs, getPostBySlug, type Post } from "@/lib/posts";
import { formatDate } from "@/lib/format-date";
import { siteConfig } from "@/lib/site-config";

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

// 楽天のサムネイルは既定で128x128しかなく、OGP画像としては小さすぎるため
// SNSシェア用にのみ大きいサイズを要求し直す(記事本文の表示サイズには影響しない)。
function ogImageFor(post: Pick<Post, "items">): string | null {
  const image = post.items.find((item) => item.image)?.image;
  return image ? image.replace(/_ex=\d+x\d+/, "_ex=600x600") : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    const image = ogImageFor(post);

    return {
      title: post.title,
      description: post.excerpt,
      alternates: {
        canonical: `/posts/${slug}`,
      },
      openGraph: {
        title: post.title,
        description: post.excerpt,
        type: "article",
        publishedTime: post.date,
        url: `/posts/${slug}`,
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: post.title,
        description: post.excerpt,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {};
  }
}

function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
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

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: `${siteConfig.url}/posts/${slug}`,
    author: { "@type": "Person", name: siteConfig.author },
    publisher: { "@type": "Organization", name: siteConfig.title },
    ...(ogImageFor(post) ? { image: [ogImageFor(post)] } : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: siteConfig.title, item: siteConfig.url },
      {
        "@type": "ListItem",
        position: 2,
        name: post.title,
        item: `${siteConfig.url}/posts/${slug}`,
      },
    ],
  };

  const itemListJsonLd =
    post.items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: post.items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "Product",
              name: item.name,
              url: item.url,
              ...(item.image ? { image: item.image } : {}),
              ...(item.price
                ? {
                    offers: {
                      "@type": "Offer",
                      price: item.price,
                      priceCurrency: "JPY",
                      url: item.url,
                    },
                  }
                : {}),
            },
          })),
        }
      : null;

  return (
    <article className="mx-auto max-w-2xl px-6 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd) }}
        />
      )}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-accent"
      >
        <span aria-hidden>←</span> 記事一覧へ戻る
      </Link>

      <header className="mt-8 mb-12">
        <time className="text-xs font-medium tracking-wide text-muted uppercase">
          {formatDate(post.date)}
        </time>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {post.title}
        </h1>
        {post.tags.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted"
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
