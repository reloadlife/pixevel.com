import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { orders, payments } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

// ─── POST /api/payments/receipt ───────────────────────────────────────────────

/**
 * Upload a card-to-card transfer receipt for an order.
 *
 * - Requires an authenticated session (401 if not logged in).
 * - The order must belong to the current user (403 otherwise).
 * - Accepts multipart/form-data with fields: orderId (text) + file (image).
 * - Saves the file to statics/uploads/<year>/<month>/ (same as admin uploads).
 * - Writes the receiptUrl to the payment row for that order.
 * - Returns { data: { ok: true, receiptUrl } }.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("UNAUTHORIZED", "برای آپلود رسید ابتدا وارد شوید.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("BAD_REQUEST", "فرم داده‌ها قابل خواندن نیست.", 400);
  }

  const orderId = formData.get("orderId");
  const file = formData.get("file");

  if (!orderId || typeof orderId !== "string" || orderId.trim() === "") {
    return apiError("BAD_REQUEST", "شناسه سفارش الزامی است.", 400);
  }

  if (!(file instanceof File) || file.size === 0) {
    return apiError("NO_FILE", "فایل رسید انتخاب نشده است.", 400);
  }

  // ── Validate file type ────────────────────────────────────────────────────
  const ext = ALLOWED_IMAGE_TYPES.get(file.type);
  if (!ext) {
    return apiError("INVALID_FILE_TYPE", "فقط فایل تصویری معتبر قابل آپلود است.", 400);
  }

  if (file.size > MAX_BYTES) {
    return apiError("FILE_TOO_LARGE", "حجم فایل باید کمتر از ۸ مگابایت باشد.", 400);
  }

  const db = getDb();

  // ── Ownership check ───────────────────────────────────────────────────────
  const [order] = await db
    .select({ id: orders.id, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId.trim()))
    .limit(1);

  if (!order) {
    return apiError("NOT_FOUND", "سفارش یافت نشد.", 404);
  }

  if (order.userId !== user.id) {
    return apiError("FORBIDDEN", "دسترسی به این سفارش مجاز نیست.", 403);
  }

  // ── Store file (same pattern as admin uploads route) ─────────────────────
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const uploadDir = path.join(process.cwd(), "statics", "uploads", folder);

  await mkdir(uploadDir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  const baseName = "receipt";
  const fileName = `${Date.now()}-${randomBytes(5).toString("hex")}-${baseName}${ext}`;
  const filePath = path.join(uploadDir, fileName);

  await writeFile(filePath, bytes);

  const receiptUrl = `/statics/uploads/${folder}/${fileName}`;

  // ── Update payment row ────────────────────────────────────────────────────
  await db.update(payments).set({ receiptUrl }).where(eq(payments.orderId, order.id));

  return apiOk({ ok: true, receiptUrl });
}
