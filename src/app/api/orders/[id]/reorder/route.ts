import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { addToCart, CART_COOKIE, CartError, getCartView } from "@/lib/cart";
import { getOrderForReorder } from "@/lib/orders/account-orders";

const CART_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await context.params;

  const order = await getOrderForReorder(id, user.id);
  if (!order) {
    return apiError("ORDER_NOT_FOUND", "سفارش پیدا نشد.", 404);
  }

  const cookieStore = await cookies();
  let anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;
  if (!anonymousId) {
    anonymousId = randomUUID();
    cookieStore.set(CART_COOKIE, anonymousId, cartCookieOptions());
  }

  const identity = { user, anonymousId };

  let added = 0;
  let skipped = 0;

  for (const item of order.items) {
    if (!item.variantId) {
      skipped += 1;
      continue;
    }

    try {
      await addToCart(identity, item.variantId, item.quantity);
      added += 1;
    } catch (error) {
      if (error instanceof CartError) {
        // Item no longer purchasable (disabled / out of stock): skip it.
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  if (added === 0) {
    return apiError(
      "NOTHING_TO_REORDER",
      "هیچ‌کدام از کالاهای این سفارش در حال حاضر قابل خرید نیستند.",
      409,
    );
  }

  const cart = await getCartView(identity);

  return apiOk({ cart, added, skipped });
}
