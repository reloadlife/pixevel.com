import { cookies } from "next/headers";

import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { CART_COOKIE, getCartView, removeItem, setItemQuantity } from "@/lib/cart";

type ItemPayload = {
  variantId?: string;
  quantity?: number;
};

async function identity() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  return { user, anonymousId: cookieStore.get(CART_COOKIE)?.value ?? null };
}

export async function PATCH(request: Request) {
  const body = await readJson<ItemPayload>(request);
  const variantId = body?.variantId?.trim();

  if (!variantId || typeof body?.quantity !== "number") {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  const cart = await setItemQuantity(await identity(), variantId, body.quantity);

  return apiOk({ cart });
}

export async function DELETE(request: Request) {
  const body = await readJson<ItemPayload>(request);
  const variantId = body?.variantId?.trim();

  if (!variantId) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  const cart = await removeItem(await identity(), variantId);

  return apiOk({ cart });
}

export async function GET() {
  const cart = await getCartView(await identity());

  return apiOk({ cart });
}
