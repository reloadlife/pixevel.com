import { getWalletWithLedger, walletReasonLabel } from "@/lib/account/wallet";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/account/wallet
 * Returns the authenticated user's wallet balance and ledger (newest first).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  try {
    const { wallet, transactions } = await getWalletWithLedger(user.id);

    return apiOk({
      balance: {
        amount: wallet.balanceAmount.toString(),
        currency: wallet.currency,
      },
      transactions: transactions.map((txn) => ({
        id: txn.id,
        direction: txn.direction,
        reason: txn.reason,
        reasonLabel: walletReasonLabel(txn.reason),
        amount: txn.amount.toString(),
        balanceAfter: txn.balanceAfter.toString(),
        orderId: txn.orderId,
        giftCardId: txn.giftCardId,
        note: txn.note,
        createdAt: txn.createdAt.toISOString(),
      })),
    });
  } catch {
    return apiError("INTERNAL", "دریافت اطلاعات کیف پول ممکن نشد.", 500);
  }
}
