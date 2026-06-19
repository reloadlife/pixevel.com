import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { watermarkImages } from "@/db/schema";
import { listAdminWatermarkImages, toAdminWatermarkImageRow } from "@/lib/admin/watermark-images";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const MAX_FILES = 8;
const MAX_BYTES = 3 * 1024 * 1024;

function cleanBaseName(name: string) {
  const parsed = path.parse(name);

  return (
    parsed.name
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "watermark"
  );
}

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const images = await listAdminWatermarkImages();

  return apiOk({ images: images.map(toAdminWatermarkImageRow) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (files.length === 0) {
    return apiError("NO_FILES", "فایلی برای آپلود انتخاب نشده است.");
  }

  if (files.length > MAX_FILES) {
    return apiError("TOO_MANY_FILES", "حداکثر ۸ تصویر را همزمان آپلود کنید.");
  }

  if (files.some((file) => file.type !== "image/png")) {
    return apiError("INVALID_FILE_TYPE", "فقط فایل PNG برای واترمارک مجاز است.");
  }

  if (files.some((file) => file.size > MAX_BYTES)) {
    return apiError("FILE_TOO_LARGE", "حجم هر تصویر واترمارک باید کمتر از ۳ مگابایت باشد.");
  }

  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const uploadDir = path.join(process.cwd(), "statics", "uploads", "watermarks", folder);

  await mkdir(uploadDir, { recursive: true });

  const uploadedImages = [];

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    let pngBytes: Buffer;
    let metadata: sharp.Metadata;

    try {
      pngBytes = await sharp(bytes, { animated: false })
        .rotate()
        .png({
          compressionLevel: 9,
          effort: 10,
        })
        .toBuffer();
      metadata = await sharp(pngBytes).metadata();
    } catch {
      return apiError("INVALID_IMAGE", "تصویر PNG معتبر نیست.");
    }

    const baseName = cleanBaseName(file.name);
    const fileName = `${Date.now()}-${randomBytes(5).toString("hex")}-${baseName}.png`;
    const filePath = path.join(uploadDir, fileName);
    const url = `/statics/uploads/watermarks/${folder}/${fileName}`;

    await writeFile(filePath, pngBytes);

    const [image] = await getDb()
      .insert(watermarkImages)
      .values({
        titleFa: formData.get("titleFa")?.toString().trim() || null,
        originalName: file.name,
        url,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        mimeType: "image/png",
        sizeBytes: pngBytes.length,
      })
      .returning();

    uploadedImages.push(image);
  }

  return apiOk({ images: uploadedImages.map(toAdminWatermarkImageRow) }, { status: 201 });
}
