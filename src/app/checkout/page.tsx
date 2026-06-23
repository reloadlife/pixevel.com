import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutClient } from "@/components/shop/checkout-client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CART_COOKIE, getCartView } from "@/lib/cart";
import { getDb } from "@/lib/db";
import { getEnabledMethods } from "@/lib/payments/methods";

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
  const enabledMethods = getEnabledMethods();

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
      {/* Page header */}
      <header className="mx-auto mb-8 max-w-6xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">
          Pixevel Checkout
        </p>
        <h1 className="mt-3 text-4xl font-black">تکمیل سفارش</h1>
      </header>

      <div className="mx-auto max-w-6xl pb-16">
        {/* Client handles summary, coupon, totals, email/gift capture, payment, submit */}
        <CheckoutClient
          cart={cart}
          hasPhysical={hasPhysical}
          hasDigital={hasDigital}
          defaultShipping={defaultShipping}
          defaultEmail={profile?.email ?? ""}
          enabledMethods={enabledMethods}
          vatRatePercent={cart.vatRatePercent}
        />
      </div>
    </main>
  );
}
