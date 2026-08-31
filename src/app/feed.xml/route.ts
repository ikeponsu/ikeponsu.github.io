import { NextResponse } from "next/server";
import { getAllPostsMeta } from "@/lib/posts";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const posts = getAllPostsMeta();

  const items = posts
    .map((post) => {
      const url = `${siteConfig.url}/posts/${post.slug}`;
      const pubDate = post.date ? new Date(post.date).toUTCString() : null;

      return [
        "<item>",
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${url}</link>`,
        `<guid>${url}</guid>`,
        pubDate ? `<pubDate>${pubDate}</pubDate>` : "",
        `<description>${escapeXml(post.excerpt)}</description>`,
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0"><channel>' +
    `<title>${escapeXml(siteConfig.title)}</title>` +
    `<link>${siteConfig.url}</link>` +
    `<description>${escapeXml(siteConfig.description)}</description>` +
    "<language>ja</language>" +
    items +
    "</channel></rss>";

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
