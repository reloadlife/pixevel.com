import { cookies } from "next/headers";

import { BasketItems } from "@/components/shop/basket-items";
import { getCurrentUser } from "@/lib/auth";
import { CART_COOKIE, getCartView } from "@/lib/cart";

export default async function BasketPage() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;
  const cart = await getCartView({ user, anonymousId });

  return (
    <main className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Basket
        </p>
        <h1 className="mt-3 text-4xl font-black">سبد خرید</h1>
      </header>

      <div className="mx-auto max-w-2xl">
        <BasketItems initialCart={cart} isLoggedIn={Boolean(user)} />
      </div>
    </main>
  );
}
