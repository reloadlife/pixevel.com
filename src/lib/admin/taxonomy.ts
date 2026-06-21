import { eq } from "drizzle-orm";

import { categories, tags } from "@/db/schema";
import { getDb } from "@/lib/db";
import { slugify } from "@/lib/format";

type CategoryInput = {
  titleFa: string;
  slug?: string;
  parentId?: string | null;
  descriptionFa?: string;
  isVisible?: boolean;
  sortOrder?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  noindex?: boolean;
};

type TagInput = {
  titleFa: string;
  slug?: string;
  isVisible?: boolean;
};

type CategoryPatchInput = Partial<CategoryInput>;
type TagPatchInput = Partial<TagInput>;

export async function listAdminCategories() {
  const rows = await getDb().query.categories.findMany({
    orderBy: (category, { asc }) => [asc(category.sortOrder), asc(category.titleFa)],
  });
  const childrenByParent = new Map<string | null, typeof rows>();

  for (const category of rows) {
    const parentKey = category.parentId ?? null;
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  }

  const flattened: Array<(typeof rows)[number] & { depth: number; pathFa: string }> = [];

  function walk(parentId: string | null, depth: number, parentPath: string) {
    const children = childrenByParent.get(parentId) ?? [];

    for (const category of children) {
      const pathFa = parentPath ? `${parentPath} / ${category.titleFa}` : category.titleFa;
      flattened.push({ ...category, depth, pathFa });
      walk(category.id, depth + 1, pathFa);
    }
  }

  walk(null, 0, "");

  return flattened;
}

export async function createAdminCategory(input: CategoryInput) {
  const titleFa = input.titleFa.trim();
  const slug = slugify(input.slug || titleFa);

  if (!titleFa || !slug) {
    throw new Error("INVALID_CATEGORY");
  }

  await validateCategoryParent(null, input.parentId || null);

  const sortOrder = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0;
  const seoTitle = normalizeText(input.seoTitle);
  const seoDescription = normalizeText(input.seoDescription);
  const ogImageUrl = normalizeText(input.ogImageUrl);
  const noindex = input.noindex ?? false;

  const [category] = await getDb()
    .insert(categories)
    .values({
      titleFa,
      slug,
      parentId: input.parentId || null,
      descriptionFa: input.descriptionFa?.trim() || null,
      isVisible: input.isVisible ?? true,
      sortOrder,
      seoTitle,
      seoDescription,
      ogImageUrl,
      noindex,
    })
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        titleFa,
        parentId: input.parentId || null,
        descriptionFa: input.descriptionFa?.trim() || null,
        ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : {}),
        sortOrder,
        seoTitle,
        seoDescription,
        ogImageUrl,
        noindex,
      },
    })
    .returning();

  return category;
}

/** Trims an optional text field to null when empty/undefined, preserving null intent. */
function normalizeText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function validateCategoryParent(categoryId: string | null, parentId: string | null) {
  if (!parentId) {
    return;
  }

  if (categoryId && parentId === categoryId) {
    throw new Error("INVALID_PARENT_CATEGORY");
  }

  let currentParentId: string | null = parentId;

  while (currentParentId) {
    const lookupId: string = currentParentId;
    const parent = await getDb().query.categories.findFirst({
      where: (category, { eq }) => eq(category.id, lookupId),
      columns: {
        id: true,
        parentId: true,
      },
    });

    if (!parent) {
      throw new Error("INVALID_PARENT_CATEGORY");
    }

    if (categoryId && parent.id === categoryId) {
      throw new Error("INVALID_PARENT_CATEGORY");
    }

    currentParentId = parent.parentId;
  }
}

export async function updateAdminCategory(id: string, input: CategoryPatchInput) {
  const current = await getDb().query.categories.findFirst({
    where: (category, { eq }) => eq(category.id, id),
  });

  if (!current) {
    throw new Error("CATEGORY_NOT_FOUND");
  }

  const nextTitle = input.titleFa?.trim() || current.titleFa;
  const nextSlug = input.slug !== undefined ? slugify(input.slug || nextTitle) : current.slug;

  if (!nextTitle || !nextSlug) {
    throw new Error("INVALID_CATEGORY");
  }

  const nextParentId = input.parentId !== undefined ? input.parentId || null : current.parentId;
  await validateCategoryParent(id, nextParentId);

  const [category] = await getDb()
    .update(categories)
    .set({
      titleFa: nextTitle,
      slug: nextSlug,
      parentId: nextParentId,
      ...(input.descriptionFa !== undefined
        ? { descriptionFa: input.descriptionFa?.trim() || null }
        : {}),
      ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : {}),
      ...(typeof input.sortOrder === "number" ? { sortOrder: input.sortOrder } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: normalizeText(input.seoTitle) } : {}),
      ...(input.seoDescription !== undefined
        ? { seoDescription: normalizeText(input.seoDescription) }
        : {}),
      ...(input.ogImageUrl !== undefined ? { ogImageUrl: normalizeText(input.ogImageUrl) } : {}),
      ...(typeof input.noindex === "boolean" ? { noindex: input.noindex } : {}),
    })
    .where(eq(categories.id, id))
    .returning();

  return category;
}

export async function listAdminTags() {
  return getDb().query.tags.findMany({
    orderBy: (tag, { asc }) => [asc(tag.titleFa)],
  });
}

export async function createAdminTag(input: TagInput) {
  const titleFa = input.titleFa.trim();
  const slug = slugify(input.slug || titleFa);

  if (!titleFa || !slug) {
    throw new Error("INVALID_TAG");
  }

  const [tag] = await getDb()
    .insert(tags)
    .values({
      titleFa,
      slug,
      isVisible: input.isVisible ?? true,
    })
    .onConflictDoUpdate({
      target: tags.slug,
      set: {
        titleFa,
        ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : {}),
      },
    })
    .returning();

  return tag;
}

export async function updateAdminTag(id: string, input: TagPatchInput) {
  const current = await getDb().query.tags.findFirst({
    where: (tag, { eq }) => eq(tag.id, id),
  });

  if (!current) {
    throw new Error("TAG_NOT_FOUND");
  }

  const nextTitle = input.titleFa?.trim() || current.titleFa;
  const nextSlug = input.slug !== undefined ? slugify(input.slug || nextTitle) : current.slug;

  if (!nextTitle || !nextSlug) {
    throw new Error("INVALID_TAG");
  }

  const [tag] = await getDb()
    .update(tags)
    .set({
      titleFa: nextTitle,
      slug: nextSlug,
      ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : {}),
    })
    .where(eq(tags.id, id))
    .returning();

  return tag;
}

export type AdminCategoryRecord = Awaited<ReturnType<typeof listAdminCategories>>[number];
export type AdminTagRecord = Awaited<ReturnType<typeof listAdminTags>>[number];

export function toAdminCategoryOption(category: AdminCategoryRecord) {
  return {
    id: category.id,
    slug: category.slug,
    titleFa: category.titleFa,
    parentId: category.parentId,
    isVisible: category.isVisible,
    sortOrder: category.sortOrder,
    depth: category.depth,
    pathFa: category.pathFa,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    ogImageUrl: category.ogImageUrl,
    noindex: category.noindex,
  };
}

export function toAdminTagOption(tag: AdminTagRecord) {
  return {
    id: tag.id,
    slug: tag.slug,
    titleFa: tag.titleFa,
    isVisible: tag.isVisible,
  };
}
