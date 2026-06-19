import { apiError, apiOk, readJson } from "@/lib/api";
import { validateCoupon } from "@/lib/coupons";

// ─── POST /api/coupons/validate ───────────────────────────────────────────────
//
// Previews a coupon for the checkout UI. The discount returned here is a
// convenience only — order placement re-validates server-side against the real
// cart subtotal, so the client can never force a discount.

interface ValidateBody {
  code?: string;
  subtotal?: number | string;
}

export async function POST(request: Request) {
  const body = await readJson<ValidateBody>(request);

  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!code) {
    return apiError("INVALID_CODE", "کد تخفیف را وارد کنید.", 400);
  }

  const subtotalRaw = Number(body?.subtotal ?? 0);
  const subtotal = Number.isFinite(subtotalRaw) ? Math.max(0, Math.trunc(subtotalRaw)) : 0;

  const result = await validateCoupon(code, subtotal);

  if (!result.ok) {
    // Surface a stable machine code plus the Persian reason message.
    return apiError(`COUPON_${result.reason}`, result.message, 422);
  }

  return apiOk({
    code: result.code,
    discountAmount: result.discountAmount,
    kind: result.kind,
    value: result.value,
  });
}
