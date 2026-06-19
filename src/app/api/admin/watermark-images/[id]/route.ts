import { eq } from "drizzle-orm";

import { watermarkImages } from "@/db/schema";
import { toAdminWatermarkImageRow } from "@/lib/admin/watermark-images";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type WatermarkImagePatchBody = {
  titleFa?: string | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<WatermarkImagePatchBody>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  const [image] = await getDb()
    .update(watermarkImages)
    .set({
      titleFa: body.titleFa?.trim() || null,
    })
    .where(eq(watermarkImages.id, id))
    .returning();

  if (!image) {
    return apiError("WATERMARK_IMAGE_NOT_FOUND", "تصویر واترمارک پیدا نشد.", 404);
  }

  return apiOk({ image: toAdminWatermarkImageRow(image) });
}
