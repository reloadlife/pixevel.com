import { getDb } from "@/lib/db";

export async function listAdminWatermarkImages() {
  return getDb().query.watermarkImages.findMany({
    orderBy: (image, { desc }) => [desc(image.createdAt)],
  });
}

export type AdminWatermarkImageRecord = Awaited<
  ReturnType<typeof listAdminWatermarkImages>
>[number];

export function toAdminWatermarkImageRow(image: AdminWatermarkImageRecord) {
  return {
    id: image.id,
    titleFa: image.titleFa ?? "",
    originalName: image.originalName,
    url: image.url,
    width: image.width,
    height: image.height,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    createdAt: image.createdAt.toISOString(),
  };
}
