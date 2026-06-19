import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { addToCart, CART_COOKIE, CartError, getCartView } from "@/lib/cart";

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

type AddPayload = {
  variantId?: string;
  quantity?: number;
};

export async function GET() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;

  const cart = await getCartView({ user, anonymousId });

  return apiOk({ cart });
}

export async function POST(request: Request) {
  const body = await readJson<AddPayload>(request);
  const variantId = body?.variantId?.trim();

  if (!variantId) {
    return apiError("INVALID_VARIANT", "تنوع محصول مشخص نشده است.");
  }

  const cookieStore = await cookies();
  const user = await getCurrentUser();

  // Anonymous shoppers get a persistent cart id cookie on first add.
  let anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;

  if (!user && !anonymousId) {
    anonymousId = randomUUID();
    cookieStore.set(CART_COOKIE, anonymousId, cartCookieOptions());
  }

  try {
    const cart = await addToCart({ user, anonymousId }, variantId, body?.quantity ?? 1);
    return apiOk({ cart });
  } catch (error) {
    if (error instanceof CartError) {
      return apiError(error.code, error.message);
    }

    throw error;
  }
}
