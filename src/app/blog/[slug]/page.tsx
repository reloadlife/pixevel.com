import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublishedPostBySlug } from "@/lib/blog";
import { resolveMetadata } from "@/lib/seo/resolve";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

function faDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return { title: { absolute: "مطلب پیدا نشد" } };
  }

  return resolveMetadata(
    {
      kind: "blog",
      slug: post.slug,
      entity: {
        titleFa: post.titleFa,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        fallbackDescription: post.excerptFa,
        ogImageUrl: post.ogImageUrl ?? post.coverImageUrl,
        noindex: post.noindex,
      },
    },
    { ogPublishedTime: post.publishedAt },
  );
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: post.titleFa,
        description: post.excerptFa ?? undefined,
        image: post.ogImageUrl ?? post.coverImageUrl ?? undefined,
        datePublished: post.publishedAt ?? undefined,
        dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
        author: {
          "@type": post.authorName ? "Person" : "Organization",
          name: post.authorName ?? "پیسکول",
        },
        publisher: { "@type": "Organization", name: "پیسکول" },
        mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "خانه", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "بلاگ", item: `${siteUrl}/blog` },
          {
            "@type": "ListItem",
            position: 3,
            name: post.titleFa,
            item: `${siteUrl}/blog/${post.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-foreground sm:px-6" dir="rtl">
      {/* PAGE_VIEW is fired globally by <RouteTracker/> — no per-page beacon here. */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: blog body is admin-authored, trusted content */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/blog" className="underline underline-offset-4 hover:text-foreground">
          ← بازگشت به بلاگ
        </Link>
      </nav>

      <article>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">{post.titleFa}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{faDate(post.publishedAt)}</span>
          {post.authorName ? <span>· {post.authorName}</span> : null}
        </div>

        {post.coverImageUrl ? (
          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
            <Image
              src={post.coverImageUrl}
              alt={post.titleFa}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        <div
          className="mt-8 space-y-4 text-base leading-relaxed text-foreground/90 [&_a]:text-gold [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-black [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-bold [&_img]:rounded-xl [&_li]:mr-5 [&_ol]:list-decimal [&_p]:leading-loose [&_ul]:list-disc"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: blog body is admin-authored, trusted content
          dangerouslySetInnerHTML={{ __html: post.bodyFa }}
        />

        {post.tags.length > 0 ? (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-bold text-muted-foreground transition hover:text-foreground"
              >
                #{tag}
              </Link>
            ))}
          </div>
        ) : null}
      </article>
    </main>
  );
}
