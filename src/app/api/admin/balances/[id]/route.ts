import { z } from "zod";

import {
  adjustLoyalty,
  adjustWallet,
  BalanceAdjustError,
  getUserLedger,
  toUserLedger,
} from "@/lib/admin/balances";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

const WalletAdjustSchema = z.object({
  kind: z.literal("wallet"),
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
});

const LoyaltyAdjustSchema = z.object({
  kind: z.literal("loyalty"),
  points: z
    .number()
    .int()
    .refine((value) => value !== 0, { message: "تعداد امتیاز نمی‌تواند صفر باشد." }),
  note: z.string().trim().max(500).optional(),
});

const AdjustSchema = z.discriminatedUnion("kind", [WalletAdjustSchema, LoyaltyAdjustSchema]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const ledger = await getUserLedger(id);

  if (!ledger) {
    return apiError("USER_NOT_FOUND", "کاربر پیدا نشد.", 404);
  }

  return apiOk(toUserLedger(ledger));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const parsed = await parseBody(request, AdjustSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    if (parsed.data.kind === "wallet") {
      await adjustWallet(admin.id, id, {
        direction: parsed.data.direction,
        amount: String(parsed.data.amount),
        note: parsed.data.note,
      });
    } else {
      await adjustLoyalty(admin.id, id, {
        points: parsed.data.points,
        note: parsed.data.note,
      });
    }
  } catch (error) {
    if (error instanceof BalanceAdjustError) {
      const status = error.code === "USER_NOT_FOUND" ? 404 : 400;
      return apiError(error.code, error.message, status);
    }
    // Never leak DB/ORM internals to clients.
    return apiError("ADJUST_FAILED", "اعمال تغییر موجودی انجام نشد.", 500);
  }

  // Return the refreshed ledger so the client can update in place.
  const ledger = await getUserLedger(id);
  if (!ledger) {
    return apiError("USER_NOT_FOUND", "کاربر پیدا نشد.", 404);
  }

  return apiOk(toUserLedger(ledger));
}
