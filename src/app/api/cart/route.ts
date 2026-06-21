import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { z } from "zod";

import { getOrSetAnonId, recordEvent } from "@/lib/analytics/track";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { addToCart, CART_COOKIE, CartError, getCartView } from "@/lib/cart";
import { getDb } from "@/lib/db";
import { parseBody } from "@/lib/validate";

const AddSchema = z.object({
  variantId: z.string().trim().min(1),
  quantity: z.number().int().positive().max(99).optional(),
});

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

export async function GET() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;

  const cart = await getCartView({ user, anonymousId });

  return apiOk({ cart });
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, AddSchema);
  if (!parsed.ok) {
    return parsed.response;
  }
  const { variantId } = parsed.data;
  const quantity = parsed.data.quantity ?? 1;

  const cookieStore = await cookies();
  const user = await getCurrentUser();

  // Anonymous shoppers get a persistent cart id cookie on first add.
  let anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;

  if (!user && !anonymousId) {
    anonymousId = randomUUID();
    cookieStore.set(CART_COOKIE, anonymousId, cartCookieOptions());
  }

  try {
    const cart = await addToCart({ user, anonymousId }, variantId, quantity);

    // Fire-and-forget ADD_TO_CART capture — must never break add-to-cart.
    void (async () => {
      const variant = await getDb()
        .query.productVariants.findFirst({
          where: (item, { eq }) => eq(item.id, variantId),
          columns: { productId: true },
        })
        .catch(() => null);

      await recordEvent({
        type: "ADD_TO_CART",
        userId: user?.id ?? null,
        anonId: user ? null : (anonymousId ?? (await getOrSetAnonId().catch(() => null))),
        productId: variant?.productId ?? null,
        metadata: { variantId, quantity },
      });
    })();

    return apiOk({ cart });
  } catch (error) {
    if (error instanceof CartError) {
      return apiError(error.code, error.message);
    }

    console.error("[cart] add failed:", error);
    return apiError("INTERNAL", "افزودن به سبد ممکن نشد.", 500);
  }
}
