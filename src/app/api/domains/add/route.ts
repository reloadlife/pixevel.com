import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { CART_COOKIE } from "@/lib/cart";
import { addDomainToCart, DomainCartError } from "@/lib/domains/cart";

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

type AddDomainPayload = {
  domainName?: string;
  years?: number;
};

/**
 * POST /api/domains/add  { domainName, years }
 *
 * Re-quotes the domain, mints a one-off domain product/variant, and adds it to
 * the caller's cart. Anonymous shoppers get a persistent cart cookie, matching
 * the normal /api/cart add flow.
 */
export async function POST(request: Request) {
  const body = await readJson<AddDomainPayload>(request);
  const domainName = body?.domainName?.trim();

  if (!domainName) {
    return apiError("INVALID_DOMAIN", "نام دامنه مشخص نشده است.");
  }

  const cookieStore = await cookies();
  const user = await getCurrentUser();

  let anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;

  if (!user && !anonymousId) {
    anonymousId = randomUUID();
    cookieStore.set(CART_COOKIE, anonymousId, cartCookieOptions());
  }

  try {
    const cart = await addDomainToCart({ user, anonymousId }, domainName, body?.years ?? 1);
    return apiOk({ cart });
  } catch (error) {
    if (error instanceof DomainCartError) {
      return apiError(error.code, error.message);
    }

    throw error;
  }
}
