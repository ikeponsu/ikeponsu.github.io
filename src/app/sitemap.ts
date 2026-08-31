import type { MetadataRoute } from "next";
import { getAllPostsMeta } from "@/lib/posts";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPostsMeta();

  return [
    {
      url: siteConfig.url,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/about`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...posts.map((post) => ({
      url: `${siteConfig.url}/posts/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : undefined,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
  ];
}
