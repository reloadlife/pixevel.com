import { z } from "zod";
import {
  GiftCardError,
  generateGiftCards,
  giftCardStatusCounts,
  listGiftCards,
  toAdminGiftCardOption,
} from "@/lib/admin/gift-cards";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

/** Maps a GiftCardError code → [httpStatus, Persian message]. */
const GIFT_CARD_ERROR_MAP: Record<string, [number, string]> = {
  INVALID_COUNT: [400, "تعداد کارت‌ها باید بین ۱ تا ۱۰۰۰ باشد."],
  INVALID_AMOUNT: [400, "مبلغ کارت هدیه باید بزرگ‌تر از صفر باشد."],
  INVALID_DATE: [400, "تاریخ انقضای واردشده نامعتبر است."],
  INVALID_STATUS: [400, "وضعیت کارت هدیه نامعتبر است."],
  STATUS_NOT_SETTABLE: [400, "این وضعیت به‌صورت دستی قابل تنظیم نیست."],
  CARD_REDEEMED: [409, "کارت هدیه استفاده‌شده قابل فعال‌سازی مجدد نیست."],
  CARD_EXPIRED: [409, "کارت هدیه منقضی‌شده قابل فعال‌سازی نیست."],
  CODE_GENERATION_FAILED: [500, "تولید کد یکتا ممکن نشد. دوباره تلاش کنید."],
  NOT_FOUND: [404, "کارت هدیه پیدا نشد."],
};

export function giftCardErrorResponse(error: unknown) {
  if (error instanceof GiftCardError) {
    const mapped = GIFT_CARD_ERROR_MAP[error.code] ?? [400, "عملیات کارت هدیه انجام نشد."];
    return apiError(error.code, mapped[1], mapped[0]);
  }
  return apiError("GIFT_CARD_FAILED", "عملیات کارت هدیه انجام نشد.", 500);
}

const StatusEnum = z.enum(["ACTIVE", "REDEEMED", "DISABLED", "EXPIRED"]);

const GenerateSchema = z.object({
  count: z.number().int().min(1).max(1000),
  amount: z.number().int().positive(),
  currency: z.string().trim().min(1).max(8).optional(),
  expiresAt: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && StatusEnum.safeParse(statusParam).success ? statusParam : null;

  const result = await listGiftCards({
    status: status as z.infer<typeof StatusEnum> | null,
    q: url.searchParams.get("q"),
    page: Number(url.searchParams.get("page")) || 1,
    pageSize: Number(url.searchParams.get("pageSize")) || undefined,
  });

  const counts = await giftCardStatusCounts();

  return apiOk({
    giftCards: result.rows.map(toAdminGiftCardOption),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
    counts,
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const parsed = await parseBody(request, GenerateSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const cards = await generateGiftCards(parsed.data);
    return apiOk({ giftCards: cards.map(toAdminGiftCardOption) }, { status: 201 });
  } catch (error) {
    return giftCardErrorResponse(error);
  }
}
