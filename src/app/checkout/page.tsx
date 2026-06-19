import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutClient } from "@/components/shop/checkout-client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CART_COOKIE, getCartView } from "@/lib/cart";
import { getDb } from "@/lib/db";
import { formatToman, toFaNumber } from "@/lib/format";

export const metadata = { title: "تکمیل سفارش | Pixevel" };

export default async function CheckoutPage() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);

  if (!user) {
    redirect("/login?redirect=/checkout");
  }

  const anonymousId = cookieStore.get(CART_COOKIE)?.value ?? null;
  const cart = await getCartView({ user, anonymousId });
  const hasPhysical = cart.items.some((item) => item.fulfillmentType === "PHYSICAL");
  const hasDigital = cart.items.some((item) => item.fulfillmentType === "DIGITAL");

  const profile = await getDb().query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      email: true,
      fullName: true,
      defaultAddressLine: true,
      defaultCity: true,
      defaultProvince: true,
      defaultPostalCode: true,
    },
  });
  const defaultShipping = {
    customerName: profile?.fullName ?? "",
    addressLine: profile?.defaultAddressLine ?? "",
    city: profile?.defaultCity ?? "",
    province: profile?.defaultProvince ?? "",
    postalCode: profile?.defaultPostalCode ?? "",
  };

  if (cart.items.length === 0) {
    return (
      <main dir="rtl" className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14">
        <div className="mx-auto max-w-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">سبد خرید شما خالی است.</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-black text-background"
          >
            مشاهده محصولات
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14">
      {/* Page header — gold/luxe style consistent with top-bar */}
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gold">Pixevel Checkout</p>
        <h1 className="mt-3 text-4xl font-black">تکمیل سفارش</h1>
      </header>

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Cart summary */}
        <section>
          <h2 className="mb-4 text-lg font-black">خلاصه سبد</h2>
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div
                key={item.variantId}
                className="flex items-center gap-4 border border-border bg-card p-3"
              >
                <div className="size-16 shrink-0 overflow-hidden bg-muted">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.titleFa}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <span className="font-black">{item.titleFa}</span>
                  <span className="text-xs text-muted-foreground">{item.variantTitleFa}</span>
                </div>
                <div className="shrink-0 text-left text-sm">
                  <div className="text-xs text-muted-foreground">
                    {toFaNumber(item.quantity)} عدد
                  </div>
                  <div className="font-black">{formatToman(item.lineTotal)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Client handles coupon, totals, email/gift capture, payment, submit */}
        <CheckoutClient
          cart={cart}
          hasPhysical={hasPhysical}
          hasDigital={hasDigital}
          defaultShipping={defaultShipping}
          defaultEmail={profile?.email ?? ""}
        />
      </div>
    </main>
  );
}
