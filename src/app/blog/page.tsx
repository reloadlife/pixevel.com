import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { listPublishedPosts } from "@/lib/blog";
import { resolveMetadata } from "@/lib/seo/resolve";

export function generateMetadata(): Promise<Metadata> {
  return resolveMetadata({ kind: "static", pathKey: "/blog" });
}

function faDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string }>;
}) {
  const { page: pageParam, tag } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);
  const { posts, page: current, hasPrev, hasNext } = await listPublishedPosts({ page, tag });

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (tag) sp.set("tag", tag);
    if (p > 1) sp.set("page", String(p));
    const q = sp.toString();
    return q ? `/blog?${q}` : "/blog";
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Blog
        </p>
        <h1 className="mt-3 text-4xl font-black">بلاگ پیسکول</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          راهنمای خرید و استفاده از گیفت‌کارت، سی‌دی‌کی، دامنه و سرویس‌های دیجیتال.
        </p>
        {tag ? (
          <p className="mt-3 text-sm text-muted-foreground">
            برچسب: <span className="font-bold text-foreground">{tag}</span> ·{" "}
            <Link href="/blog" className="underline underline-offset-4">
              همه مطالب
            </Link>
          </p>
        ) : null}
      </header>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <p className="text-sm font-bold">هنوز مطلبی منتشر نشده است.</p>
          <p className="mt-1 text-xs text-muted-foreground">به‌زودی سر بزنید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-md"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                {post.coverImageUrl ? (
                  <Image
                    src={post.coverImageUrl}
                    alt={post.titleFa}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition group-hover:scale-[1.03]"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="line-clamp-2 font-black leading-snug">{post.titleFa}</h2>
                {post.excerptFa ? (
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                    {post.excerptFa}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">{faDate(post.publishedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasPrev || hasNext ? (
        <nav className="mt-10 flex items-center justify-center gap-3 text-sm">
          {hasPrev ? (
            <Link
              href={pageHref(current - 1)}
              className="rounded-lg border border-border px-4 py-2 font-bold transition hover:bg-muted"
            >
              جدیدتر
            </Link>
          ) : null}
          <span className="text-muted-foreground">صفحه {current.toLocaleString("fa-IR")}</span>
          {hasNext ? (
            <Link
              href={pageHref(current + 1)}
              className="rounded-lg border border-border px-4 py-2 font-bold transition hover:bg-muted"
            >
              قدیمی‌تر
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
