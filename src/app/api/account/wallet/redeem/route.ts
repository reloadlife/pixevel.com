import { redeemGiftCard, WalletError, walletReasonLabel } from "@/lib/account/wallet";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface RedeemBody {
  code?: string;
}

/**
 * POST /api/account/wallet/redeem  { code }
 * Validates a gift card and credits its balance to the user's wallet.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<RedeemBody>(request)) ?? {};
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return apiError("INVALID_CODE", "کد کارت هدیه را وارد کنید.", 400);
  }

  try {
    const { wallet, transaction, amount } = await redeemGiftCard(user.id, code);

    return apiOk({
      amount: amount.toString(),
      balance: {
        amount: wallet.balanceAmount.toString(),
        currency: wallet.currency,
      },
      transaction: {
        id: transaction.id,
        direction: transaction.direction,
        reason: transaction.reason,
        reasonLabel: walletReasonLabel(transaction.reason),
        amount: transaction.amount.toString(),
        balanceAfter: transaction.balanceAfter.toString(),
        createdAt: transaction.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof WalletError) {
      const status =
        error.code === "GIFT_CARD_NOT_FOUND" ? 404 : error.code === "INVALID_AMOUNT" ? 400 : 409;
      return apiError(error.code, error.message, status);
    }
    return apiError("INTERNAL", "ثبت کارت هدیه ممکن نشد.", 500);
  }
}
