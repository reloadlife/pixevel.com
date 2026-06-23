import type { MetadataRoute } from "next";

import { getGlobalDefaults } from "@/lib/seo/defaults";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Global robots default comes from the SEO hub (falls back to index:true).
  const { robotsDefault } = await getGlobalDefaults();
  const disallow = ["/admin", "/api", "/account", "/checkout", "/payment", "/login"];

  return {
    rules: {
      userAgent: "*",
      // When the operator disables site-wide indexing, disallow everything.
      ...(robotsDefault.index ? { allow: "/", disallow } : { disallow: "/" }),
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
