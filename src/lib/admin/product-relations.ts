import { and, eq } from "drizzle-orm";

import { type ProductRelationKind, productRelationKind, productRelations } from "@/db/schema";
import { getDb } from "@/lib/db";

const VALID_KINDS = new Set<ProductRelationKind>(productRelationKind.enumValues);

export function isValidRelationKind(value: unknown): value is ProductRelationKind {
  return typeof value === "string" && VALID_KINDS.has(value as ProductRelationKind);
}

/** Return all relation rows for a product, grouped with basic related-product info. */
export async function listProductRelations(productId: string) {
  const rows = await getDb().query.productRelations.findMany({
    where: (rel, { eq: eqOp }) => eqOp(rel.productId, productId),
    with: {
      relatedProduct: {
        columns: { id: true, slug: true, titleFa: true, status: true, primaryImageUrl: true },
      },
    },
    orderBy: (rel, { asc }) => [asc(rel.kind), asc(rel.position)],
  });

  return rows;
}

/**
 * Replace all relations of a given kind for a product.
 * Passing an empty relatedIds array removes all relations of that kind.
 */
export async function setProductRelations(
  productId: string,
  kind: ProductRelationKind,
  relatedIds: string[],
) {
  if (!isValidRelationKind(kind)) throw new Error("INVALID_RELATION_KIND");

  // Verify all related products exist and are not the product itself.
  const uniqueIds = Array.from(new Set(relatedIds)).filter((id) => id !== productId);

  if (uniqueIds.length > 0) {
    const found = await getDb().query.products.findMany({
      where: (p, { inArray: inArrayOp }) => inArrayOp(p.id, uniqueIds),
      columns: { id: true },
    });
    if (found.length !== uniqueIds.length) throw new Error("INVALID_RELATED_PRODUCT");
  }

  await getDb().transaction(async (tx) => {
    // Remove all existing relations of this kind for this product.
    await tx
      .delete(productRelations)
      .where(and(eq(productRelations.productId, productId), eq(productRelations.kind, kind)));

    if (uniqueIds.length > 0) {
      await tx.insert(productRelations).values(
        uniqueIds.map((relatedProductId, position) => ({
          productId,
          relatedProductId,
          kind,
          position,
        })),
      );
    }
  });
}

export type AdminProductRelationRow = Awaited<ReturnType<typeof listProductRelations>>[number];

export function toAdminRelationRow(row: AdminProductRelationRow) {
  return {
    id: row.id,
    kind: row.kind,
    position: row.position,
    relatedProduct: {
      id: row.relatedProduct.id,
      slug: row.relatedProduct.slug,
      titleFa: row.relatedProduct.titleFa,
      status: row.relatedProduct.status,
      imageUrl: row.relatedProduct.primaryImageUrl ?? null,
    },
  };
}
