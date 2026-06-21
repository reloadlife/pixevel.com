import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { BlogPost } from "@/db/schema";
import { blogPosts } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Default number of posts per page on the public blog index. */
export const BLOG_PAGE_SIZE = 12;

/** A blog post shaped for public surfaces (cards, detail, RSS). */
export type PublicBlogPost = {
  id: string;
  slug: string;
  titleFa: string;
  excerptFa: string | null;
  bodyFa: string;
  coverImageUrl: string | null;
  tags: string[];
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
};

type BlogRow = BlogPost & { author?: { fullName: string | null } | null };

/** Serializes a DB row into the stable, client-safe public shape. */
function toPublicPost(row: BlogRow): PublicBlogPost {
  return {
    id: row.id,
    slug: row.slug,
    titleFa: row.titleFa,
    excerptFa: row.excerptFa ?? null,
    bodyFa: row.bodyFa,
    coverImageUrl: row.coverImageUrl ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    authorName: row.author?.fullName ?? null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    seoTitle: row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    ogImageUrl: row.ogImageUrl ?? null,
    noindex: row.noindex,
  };
}

export type ListPublishedPostsResult = {
  posts: PublicBlogPost[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

/**
 * Lists PUBLISHED posts ordered by publishedAt desc, paginated. An optional
 * `tag` narrows to posts whose `tags` array contains that slug. Returns a stable
 * envelope with pagination metadata suitable for both web and a future client.
 */
export async function listPublishedPosts({
  page = 1,
  tag,
  pageSize = BLOG_PAGE_SIZE,
}: {
  page?: number;
  tag?: string;
  pageSize?: number;
} = {}): Promise<ListPublishedPostsResult> {
  const db = getDb();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : BLOG_PAGE_SIZE;

  const trimmedTag = tag?.trim();
  const where = trimmedTag
    ? and(
        eq(blogPosts.status, "PUBLISHED"),
        sql`${blogPosts.tags} @> ${JSON.stringify([trimmedTag])}::jsonb`,
      )
    : eq(blogPosts.status, "PUBLISHED");

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(blogPosts)
    .where(where);

  const total = Number(count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);

  const rows = await db.query.blogPosts.findMany({
    where: () => where,
    orderBy: [desc(blogPosts.publishedAt), desc(blogPosts.createdAt)],
    limit: safePageSize,
    offset: (currentPage - 1) * safePageSize,
    with: { author: { columns: { fullName: true } } },
  });

  return {
    posts: rows.map(toPublicPost),
    page: currentPage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}

/** Returns a single PUBLISHED post by slug, or null when missing/unpublished. */
export async function getPublishedPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const trimmed = slug?.trim();
  if (!trimmed) {
    return null;
  }

  const row = await getDb().query.blogPosts.findFirst({
    where: (p, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(p.slug, trimmed), eqOp(p.status, "PUBLISHED")),
    with: { author: { columns: { fullName: true } } },
  });

  return row ? toPublicPost(row) : null;
}

/** Returns the `n` most recent PUBLISHED posts (newest first). */
export async function listRecentPosts(n = 5): Promise<PublicBlogPost[]> {
  const limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;

  const rows = await getDb().query.blogPosts.findMany({
    where: (p, { eq: eqOp }) => eqOp(p.status, "PUBLISHED"),
    orderBy: [desc(blogPosts.publishedAt), desc(blogPosts.createdAt)],
    limit,
    with: { author: { columns: { fullName: true } } },
  });

  return rows.map(toPublicPost);
}
