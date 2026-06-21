import "server-only";

import { desc, eq } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";

import type { BlogStatus } from "@/db/schema";
import { blogPosts } from "@/db/schema";
import { getDb } from "@/lib/db";
import { slugify } from "@/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BlogPostInput = {
  titleFa: string;
  slug?: string | null;
  excerptFa?: string | null;
  bodyFa: string;
  coverImageUrl?: string | null;
  status?: BlogStatus;
  tags?: string[] | null;
  publishedAt?: string | Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  noindex?: boolean;
};

export type BlogPostPatchInput = Partial<BlogPostInput>;

const STATUSES: readonly BlogStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

/**
 * Domain errors thrown by this module. The API layer maps each `code` to an
 * HTTP status + Persian message, so DB/ORM details never leak to clients.
 */
export class BlogError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "BlogError";
  }
}

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function normalizeTitle(value: unknown): string {
  const title = String(value ?? "").trim();
  if (!title) {
    throw new BlogError("TITLE_REQUIRED");
  }
  return title;
}

/** Allowlist sanitizer for admin-authored post HTML — strips scripts/handlers. */
const BLOG_SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "h1",
    "h2",
    "figure",
    "figcaption",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    "*": ["dir"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

function normalizeBody(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new BlogError("BODY_REQUIRED");
  }
  // Sanitize on write so stored HTML is XSS-safe — defends against a compromised
  // or CSRF'd admin session injecting scripts that run on public pages.
  const clean = sanitizeHtml(raw, BLOG_SANITIZE).trim();
  if (!clean) {
    throw new BlogError("BODY_REQUIRED");
  }
  return clean;
}

/** Builds a unique-friendly slug; falls back to the title, then a timestamp. */
function normalizeSlug(rawSlug: unknown, title: string): string {
  const candidate = String(rawSlug ?? "").trim();
  const slug = slugify(candidate || title);
  if (slug) {
    return slug;
  }
  // Persian-only titles can slugify to empty under some inputs — guarantee one.
  return `post-${Date.now()}`;
}

function normalizeStatus(value: unknown): BlogStatus {
  const status = String(value ?? "").toUpperCase() as BlogStatus;
  if (!STATUSES.includes(status)) {
    throw new BlogError("INVALID_STATUS");
  }
  return status;
}

function normalizeTags(value: unknown): string[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BlogError("INVALID_TAGS");
  }
  return value
    .map((t) => String(t ?? "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 24);
}

function toOptionalDate(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new BlogError("INVALID_DATE");
  }
  return date;
}

function toOptionalText(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (code === "23505") {
    return true;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.toLowerCase().includes("unique");
}

// ─── Read ──────────────────────────────────────────────────────────────────

/** Lists every post (any status), newest first, with the author name joined. */
export async function listAdminPosts() {
  return getDb().query.blogPosts.findMany({
    orderBy: [desc(blogPosts.createdAt)],
    with: { author: { columns: { fullName: true } } },
  });
}

export async function getAdminPost(id: string) {
  return getDb().query.blogPosts.findFirst({
    where: (p, { eq: eqOp }) => eqOp(p.id, id),
    with: { author: { columns: { fullName: true } } },
  });
}

export type AdminBlogRecord = Awaited<ReturnType<typeof getAdminPost>>;

/** A post row that may or may not carry the joined author relation. */
type AdminBlogPostRow = typeof blogPosts.$inferSelect & {
  author?: { fullName: string | null } | null;
};

/** Serializes a post row into a stable, client-safe admin shape. */
export function toAdminBlogRow(post: AdminBlogPostRow) {
  return {
    id: post.id,
    slug: post.slug,
    titleFa: post.titleFa,
    excerptFa: post.excerptFa ?? "",
    bodyFa: post.bodyFa,
    coverImageUrl: post.coverImageUrl ?? "",
    status: post.status,
    tags: Array.isArray(post.tags) ? post.tags : [],
    authorName: post.author?.fullName ?? null,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    ogImageUrl: post.ogImageUrl ?? "",
    noindex: post.noindex,
    createdAt: post.createdAt ? post.createdAt.toISOString() : null,
    updatedAt: post.updatedAt ? post.updatedAt.toISOString() : null,
  };
}

export type AdminBlogRow = ReturnType<typeof toAdminBlogRow>;

// ─── Write ─────────────────────────────────────────────────────────────────

export async function createBlogPost(input: BlogPostInput, authorUserId: string | null) {
  const titleFa = normalizeTitle(input.titleFa);
  const bodyFa = normalizeBody(input.bodyFa);
  const slug = normalizeSlug(input.slug, titleFa);
  const status = input.status !== undefined ? normalizeStatus(input.status) : "DRAFT";
  const explicitPublishedAt = toOptionalDate(input.publishedAt);

  // First publish without an explicit date stamps "now".
  const publishedAt =
    status === "PUBLISHED" ? (explicitPublishedAt ?? new Date()) : explicitPublishedAt;

  try {
    const [post] = await getDb()
      .insert(blogPosts)
      .values({
        slug,
        titleFa,
        excerptFa: toOptionalText(input.excerptFa),
        bodyFa,
        coverImageUrl: toOptionalText(input.coverImageUrl),
        status,
        authorUserId,
        tags: normalizeTags(input.tags),
        publishedAt,
        seoTitle: toOptionalText(input.seoTitle),
        seoDescription: toOptionalText(input.seoDescription),
        ogImageUrl: toOptionalText(input.ogImageUrl),
        noindex: Boolean(input.noindex),
      })
      .returning();

    return post;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BlogError("SLUG_TAKEN");
    }
    throw error;
  }
}

export async function updateBlogPost(id: string, input: BlogPostPatchInput) {
  const current = await getDb().query.blogPosts.findFirst({
    where: (p, { eq: eqOp }) => eqOp(p.id, id),
  });

  if (!current) {
    throw new BlogError("NOT_FOUND");
  }

  const patch: Partial<typeof blogPosts.$inferInsert> = {};

  const nextTitle = input.titleFa !== undefined ? normalizeTitle(input.titleFa) : current.titleFa;
  if (input.titleFa !== undefined) {
    patch.titleFa = nextTitle;
  }
  if (input.bodyFa !== undefined) {
    patch.bodyFa = normalizeBody(input.bodyFa);
  }
  if (input.slug !== undefined) {
    patch.slug = normalizeSlug(input.slug, nextTitle);
  }
  if (input.excerptFa !== undefined) {
    patch.excerptFa = toOptionalText(input.excerptFa);
  }
  if (input.coverImageUrl !== undefined) {
    patch.coverImageUrl = toOptionalText(input.coverImageUrl);
  }
  if (input.tags !== undefined) {
    patch.tags = normalizeTags(input.tags);
  }
  if (input.seoTitle !== undefined) {
    patch.seoTitle = toOptionalText(input.seoTitle);
  }
  if (input.seoDescription !== undefined) {
    patch.seoDescription = toOptionalText(input.seoDescription);
  }
  if (input.ogImageUrl !== undefined) {
    patch.ogImageUrl = toOptionalText(input.ogImageUrl);
  }
  if (input.noindex !== undefined) {
    patch.noindex = Boolean(input.noindex);
  }

  const nextStatus = input.status !== undefined ? normalizeStatus(input.status) : current.status;
  if (input.status !== undefined) {
    patch.status = nextStatus;
  }

  // Resolve publishedAt: an explicit value wins; otherwise stamp "now" the first
  // time a post transitions into PUBLISHED without already having a date.
  if (input.publishedAt !== undefined) {
    patch.publishedAt = toOptionalDate(input.publishedAt);
  } else if (nextStatus === "PUBLISHED" && !current.publishedAt) {
    patch.publishedAt = new Date();
  }

  patch.updatedAt = new Date();

  try {
    const [post] = await getDb()
      .update(blogPosts)
      .set(patch)
      .where(eq(blogPosts.id, id))
      .returning();

    return post;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BlogError("SLUG_TAKEN");
    }
    throw error;
  }
}

export async function deleteBlogPost(id: string) {
  const [deleted] = await getDb()
    .delete(blogPosts)
    .where(eq(blogPosts.id, id))
    .returning({ id: blogPosts.id });

  if (!deleted) {
    throw new BlogError("NOT_FOUND");
  }

  return deleted;
}
