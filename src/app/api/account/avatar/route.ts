import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { updateAvatar } from "@/lib/account";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const AVATAR_SIZE = 512;
const ALLOWED_IMAGE_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return apiError("NO_FILE", "فایلی برای آپلود انتخاب نشده است.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return apiError("INVALID_FILE_TYPE", "فقط فایل تصویری معتبر قابل آپلود است.");
  }

  if (file.size > MAX_BYTES) {
    return apiError("FILE_TOO_LARGE", "حجم تصویر باید کمتر از ۸ مگابایت باشد.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let optimized: Buffer;
  try {
    optimized = await sharp(bytes, { animated: false, limitInputPixels: 50_000_000 })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
      .webp({ effort: 6, quality: 80 })
      .toBuffer();
  } catch {
    return apiError("INVALID_IMAGE", "پردازش تصویر ممکن نشد.");
  }

  const uploadDir = path.join(process.cwd(), "statics", "uploads", "avatars");
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${user.id}-${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
  await writeFile(path.join(uploadDir, fileName), optimized);

  const url = `/statics/uploads/avatars/${fileName}`;
  await updateAvatar(user.id, url);

  return apiOk({ avatarUrl: url }, { status: 201 });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  await updateAvatar(user.id, null);
  return apiOk({ avatarUrl: null });
}
