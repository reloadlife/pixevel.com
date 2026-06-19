import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILES = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 300 * 1024;
const WEBP_MAX_QUALITY = 82;
const WEBP_MIN_QUALITY = 38;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

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
      .slice(0, 48) || "image"
  );
}

async function renderWebp(bytes: Buffer, quality: number) {
  return sharp(bytes, { animated: false })
    .rotate()
    .webp({
      effort: 6,
      quality,
      smartSubsample: true,
    })
    .toBuffer();
}

async function optimizeImage(bytes: Buffer, mimeType: string) {
  const originalExt = ALLOWED_IMAGE_TYPES.get(mimeType) ?? ".jpg";

  try {
    if (mimeType === "image/gif") {
      return { bytes, ext: originalExt, mimeType, optimized: false };
    }

    let bestUnderTarget: { bytes: Buffer; quality: number } | null = null;
    let smallestOverTarget: { bytes: Buffer; quality: number } | null = null;
    let low = WEBP_MIN_QUALITY;
    let high = WEBP_MAX_QUALITY;

    while (low <= high) {
      const quality = Math.floor((low + high) / 2);
      const webpBytes = await renderWebp(bytes, quality);

      if (webpBytes.length <= TARGET_IMAGE_BYTES) {
        bestUnderTarget = { bytes: webpBytes, quality };
        low = quality + 1;
      } else {
        if (!smallestOverTarget || webpBytes.length < smallestOverTarget.bytes.length) {
          smallestOverTarget = { bytes: webpBytes, quality };
        }
        high = quality - 1;
      }
    }

    const optimized = bestUnderTarget ?? smallestOverTarget;

    if (!optimized || optimized.bytes.length === 0 || optimized.bytes.length >= bytes.length) {
      return { bytes, ext: originalExt, mimeType, optimized: false };
    }

    return {
      bytes: optimized.bytes,
      ext: ".webp",
      mimeType: "image/webp",
      optimized: true,
      quality: optimized.quality,
    };
  } catch {
    return { bytes, ext: originalExt, mimeType, optimized: false };
  }
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
    return apiError("TOO_MANY_FILES", "حداکثر ۱۲ تصویر را همزمان آپلود کنید.");
  }

  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const uploadDir = path.join(process.cwd(), "statics", "uploads", folder);

  await mkdir(uploadDir, { recursive: true });

  const uploadedFiles = [];

  for (const file of files) {
    const ext = ALLOWED_IMAGE_TYPES.get(file.type);

    if (!ext) {
      return apiError("INVALID_FILE_TYPE", "فقط فایل تصویری معتبر قابل آپلود است.");
    }

    if (file.size > MAX_BYTES) {
      return apiError("FILE_TOO_LARGE", "حجم هر تصویر باید کمتر از ۸ مگابایت باشد.");
    }

    const baseName = cleanBaseName(file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    const optimized = await optimizeImage(bytes, file.type);
    const fileName = `${Date.now()}-${randomBytes(5).toString("hex")}-${baseName}${optimized.ext}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, optimized.bytes);

    uploadedFiles.push({
      originalName: file.name,
      url: `/statics/uploads/${folder}/${fileName}`,
      size: optimized.bytes.length,
      originalSize: file.size,
      mimeType: optimized.mimeType,
      originalMimeType: file.type,
      optimized: optimized.optimized,
      quality: optimized.quality,
      targetSize: TARGET_IMAGE_BYTES,
    });
  }

  return apiOk({ files: uploadedFiles }, { status: 201 });
}
