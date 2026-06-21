import { listPublishedPosts } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

export const revalidate = 3600;

/** Escapes the five XML predefined entities for safe inclusion in RSS text. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** GET /blog/feed.xml — RSS 2.0 feed of the latest published posts. */
export async function GET() {
  const { posts } = await listPublishedPosts({ page: 1, pageSize: 50 });

  const items = posts
    .map((post) => {
      const link = `${siteUrl}/blog/${post.slug}`;
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : "";
      return [
        "<item>",
        `<title>${esc(post.titleFa)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="true">${link}</guid>`,
        pubDate ? `<pubDate>${pubDate}</pubDate>` : "",
        `<description>${esc(post.excerptFa ?? "")}</description>`,
        "</item>",
      ].join("");
    })
    .join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    "<title>بلاگ پیسکول</title>",
    `<link>${siteUrl}/blog</link>`,
    "<description>راهنماها و اخبار گیفت‌کارت، سی‌دی‌کی و سرویس‌های دیجیتال پیسکول.</description>",
    "<language>fa-IR</language>",
    items,
    "</channel>",
    "</rss>",
  ].join("");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
