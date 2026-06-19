import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export type ProductImageWatermarkOptions = {
  imageUrl: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function localStaticUrlToPath(url: string) {
  if (!url.startsWith("/statics/")) {
    return null;
  }

  const root = path.resolve(process.cwd(), "statics");
  const relativePath = decodeURIComponent(url.replace(/^\/statics\/+/, ""));
  const filePath = path.resolve(root, relativePath);

  if (filePath !== root && filePath.startsWith(`${root}${path.sep}`)) {
    return filePath;
  }

  return null;
}

async function buildOpacityMask(width: number, height: number, opacity: number) {
  const alpha = clamp(opacity / 100, 0, 1);

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="rgba(255,255,255,${alpha})"/>
    </svg>`
  );
}

async function buildImageOverlay({
  imageUrl,
  baseWidth,
  baseHeight,
  size,
  opacity,
}: {
  imageUrl: string;
  baseWidth: number;
  baseHeight: number;
  size: number;
  opacity: number;
}) {
  const watermarkPath = localStaticUrlToPath(imageUrl);

  if (!watermarkPath) {
    throw new Error("UNSUPPORTED_WATERMARK_IMAGE_URL");
  }

  const watermarkBytes = await readFile(watermarkPath);
  const resized = await sharp(watermarkBytes, { animated: false })
    .rotate()
    .resize({
      width: Math.min(size, baseWidth),
      height: baseHeight,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  const metadata = await sharp(resized).metadata();
  const width = metadata.width ?? 1;
  const height = metadata.height ?? 1;

  if (opacity >= 100) {
    return { bytes: resized, width, height };
  }

  const mask = await buildOpacityMask(width, height, opacity);
  const bytes = await sharp(resized)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  return { bytes, width, height };
}

function resolvePosition({
  offset,
  baseSize,
  overlaySize,
}: {
  offset: number;
  baseSize: number;
  overlaySize: number;
}) {
  const rawPosition =
    offset < 0 ? baseSize - overlaySize + Math.round(offset) : Math.round(offset);

  return Math.round(clamp(rawPosition, 0, Math.max(0, baseSize - overlaySize)));
}

export async function renderProductImageWatermark({
  sourceUrl,
  imageId,
  options,
}: {
  sourceUrl: string;
  imageId: string;
  options: ProductImageWatermarkOptions;
}) {
  const sourcePath = localStaticUrlToPath(sourceUrl);

  if (!sourcePath) {
    throw new Error("UNSUPPORTED_SOURCE_IMAGE_URL");
  }

  const sourceBytes = await readFile(sourcePath);
  const metadata = await sharp(sourceBytes, { animated: false }).rotate().metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error("INVALID_SOURCE_IMAGE");
  }

  const overlay = await buildImageOverlay({
    imageUrl: options.imageUrl,
    baseWidth: width,
    baseHeight: height,
    size: Math.round(clamp(options.size, 8, Math.max(width, height))),
    opacity: Math.round(clamp(options.opacity, 0, 100)),
  });
  const left = resolvePosition({
    offset: options.x,
    baseSize: width,
    overlaySize: overlay.width,
  });
  const top = resolvePosition({
    offset: options.y,
    baseSize: height,
    overlaySize: overlay.height,
  });

  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const outputDir = path.join(process.cwd(), "statics", "uploads", "watermarked", folder);
  const fileName = `${Date.now()}-${randomBytes(5).toString("hex")}-${imageId}.webp`;
  const filePath = path.join(outputDir, fileName);

  await mkdir(outputDir, { recursive: true });

  const output = await sharp(sourceBytes, { animated: false })
    .rotate()
    .composite([{ input: overlay.bytes, left, top }])
    .webp({
      effort: 6,
      quality: 88,
      smartSubsample: true,
    })
    .toBuffer();

  await writeFile(filePath, output);

  return `/statics/uploads/watermarked/${folder}/${fileName}`;
}
