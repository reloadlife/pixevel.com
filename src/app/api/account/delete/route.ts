import { and, count, eq, inArray } from "drizzle-orm";

import { orders, users, wallets } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { destroyCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

type DeletePayload = {
  confirm?: boolean;
};

/**
 * Permanently deletes the authenticated user's account. Requires an explicit
 * `confirm: true` flag. Owned data (sessions, addresses, wishlist, wallet,
 * loyalty, notifications, support, reviews-as-user) cascades or is null-ed per
 * the schema FKs; orders/payments are retained with the user link set to null
 * so financial records stay intact.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<DeletePayload>(request)) ?? {};
  if (body.confirm !== true) {
    return apiError("CONFIRMATION_REQUIRED", "برای حذف حساب باید تأیید کنید.");
  }

  const db = getDb();

  // Block deletion while value/obligations remain: the wallet FK cascades, so a
  // positive balance + its ledger would be silently destroyed, and open orders
  // would be orphaned. Send the user to support to settle first.
  const wallet = await db.query.wallets.findFirst({
    where: (w, { eq: e }) => e(w.userId, user.id),
    columns: { balanceAmount: true },
  });
  if (wallet && Number(wallet.balanceAmount) > 0) {
    return apiError(
      "WALLET_NOT_EMPTY",
      "موجودی کیف پول شما صفر نیست؛ ابتدا با پشتیبانی تسویه کنید.",
      409,
    );
  }

  const [{ openOrders }] = await db
    .select({ openOrders: count() })
    .from(orders)
    .where(
      and(
        eq(orders.userId, user.id),
        inArray(orders.status, ["PENDING", "PAID", "PROCESSING", "SHIPPED"]),
      ),
    );
  if (Number(openOrders) > 0) {
    return apiError("OPEN_ORDERS", "سفارش در جریان دارید؛ پس از تکمیل آن‌ها دوباره تلاش کنید.", 409);
  }

  // Drop the current session cookie + row before removing the user.
  await destroyCurrentSession();

  try {
    await getDb().delete(users).where(eq(users.id, user.id));
  } catch {
    return apiError("INTERNAL", "حذف حساب ممکن نشد. لطفاً با پشتیبانی تماس بگیرید.", 500);
  }

  return apiOk({ deleted: true });
}
