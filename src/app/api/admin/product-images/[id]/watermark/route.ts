import { eq } from "drizzle-orm";

import { productImages, products } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { renderProductImageWatermark } from "@/lib/admin/image-watermarks";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

type WatermarkPatchBody = {
  enabled?: boolean;
  watermarkImageId?: string | null;
  x?: number | string | null;
  y?: number | string | null;
  size?: number | string | null;
  opacity?: number | string | null;
};

function parseInteger(value: number | string | null | undefined, fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const text = String(value).trim();

  if (!/^-?\d+$/.test(text)) {
    return null;
  }

  const numeric = Number(text);

  if (!Number.isSafeInteger(numeric)) {
    return null;
  }

  return numeric;
}

function toProductImageRow(image: {
  id: string;
  url: string;
  originalUrl: string | null;
  altFa: string | null;
  vipImage: boolean;
  isPrimary: boolean;
  showcasePublic: boolean;
  showcasePremium: boolean;
  sortOrder: number;
  variantId: string | null;
  watermarkEnabled: boolean;
  watermarkImageId: string | null;
  watermarkX: number;
  watermarkY: number;
  watermarkSize: number;
  watermarkOpacity: number;
  watermarkAppliedUrl: string | null;
}) {
  return {
    id: image.id,
    url: image.url,
    originalUrl: image.originalUrl ?? "",
    altFa: image.altFa ?? "",
    vipImage: image.vipImage,
    isPrimary: image.isPrimary,
    showcasePublic: image.showcasePublic,
    showcasePremium: image.showcasePremium,
    sortOrder: image.sortOrder,
    variantId: image.variantId ?? "",
    watermarkEnabled: image.watermarkEnabled,
    watermarkImageId: image.watermarkImageId ?? "",
    watermarkX: image.watermarkX,
    watermarkY: image.watermarkY,
    watermarkSize: image.watermarkSize,
    watermarkOpacity: image.watermarkOpacity,
    watermarkAppliedUrl: image.watermarkAppliedUrl ?? "",
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<WatermarkPatchBody>(request);

  if (!body || typeof body.enabled !== "boolean") {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  const db = getDb();
  const image = await db.query.productImages.findFirst({
    where: (item, { eq }) => eq(item.id, id),
  });

  if (!image) {
    return apiError("IMAGE_NOT_FOUND", "تصویر محصول پیدا نشد.", 404);
  }

  if (!body.enabled) {
    const restoredUrl = image.originalUrl ?? image.url;
    const updated = await db.transaction(async (tx) => {
      const [productImage] = await tx
        .update(productImages)
        .set({
          url: restoredUrl,
          originalUrl: null,
          watermarkEnabled: false,
          watermarkImageId: null,
          watermarkX: 0,
          watermarkY: 0,
          watermarkSize: 120,
          watermarkOpacity: 100,
          watermarkAppliedUrl: null,
        })
        .where(eq(productImages.id, id))
        .returning();

      if (productImage.isPrimary) {
        await tx
          .update(products)
          .set({ primaryImageUrl: restoredUrl })
          .where(eq(products.id, productImage.productId));
      }

      return productImage;
    });

    return apiOk({ image: toProductImageRow(updated) });
  }

  const sourceUrl = image.originalUrl ?? image.url;
  const x = parseInteger(body.x, image.watermarkX);
  const y = parseInteger(body.y, image.watermarkY);
  const size = parseInteger(body.size, image.watermarkSize || 120);
  const opacity = parseInteger(body.opacity, image.watermarkOpacity || 100);
  const watermarkImageId = (body.watermarkImageId ?? image.watermarkImageId ?? "").trim();

  if (x === null || y === null || size === null || opacity === null) {
    return apiError("INVALID_WATERMARK_NUMBER", "مقدارهای X، Y، اندازه و شفافیت باید عدد صحیح باشند.");
  }

  if (size < 8) {
    return apiError("INVALID_WATERMARK_SIZE", "اندازه واترمارک باید حداقل ۸ باشد.");
  }

  if (opacity < 0 || opacity > 100) {
    return apiError("INVALID_WATERMARK_OPACITY", "شفافیت واترمارک باید بین ۰ تا ۱۰۰ باشد.");
  }

  const watermarkImage = watermarkImageId
    ? await db.query.watermarkImages.findFirst({
        where: (item, { eq }) => eq(item.id, watermarkImageId),
      })
    : null;

  if (!watermarkImage) {
    return apiError("WATERMARK_IMAGE_REQUIRED", "تصویر واترمارک معتبر نیست.");
  }

  let watermarkedUrl: string;

  try {
    watermarkedUrl = await renderProductImageWatermark({
      sourceUrl,
      imageId: image.id,
      options: {
        imageUrl: watermarkImage.url,
        x,
        y,
        size,
        opacity,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "UNSUPPORTED_SOURCE_IMAGE_URL" ||
        error.message === "UNSUPPORTED_WATERMARK_IMAGE_URL")
    ) {
      return apiError(
        "UNSUPPORTED_IMAGE_URL",
        "واترمارک فقط روی تصاویر آپلودشده داخلی قابل اعمال است."
      );
    }

    return apiError("WATERMARK_RENDER_FAILED", "واترمارک روی تصویر اعمال نشد.", 500);
  }

  const updated = await db.transaction(async (tx) => {
    const [productImage] = await tx
      .update(productImages)
      .set({
        url: watermarkedUrl,
        originalUrl: sourceUrl,
        watermarkEnabled: true,
        watermarkImageId,
        watermarkX: x,
        watermarkY: y,
        watermarkSize: size,
        watermarkOpacity: opacity,
        watermarkAppliedUrl: watermarkedUrl,
      })
      .where(eq(productImages.id, id))
      .returning();

    if (productImage.isPrimary) {
      await tx
        .update(products)
        .set({ primaryImageUrl: watermarkedUrl })
        .where(eq(products.id, productImage.productId));
    }

    return productImage;
  });

  return apiOk({ image: toProductImageRow(updated) });
}
