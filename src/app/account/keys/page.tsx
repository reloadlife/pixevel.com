import { KeyRound, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getKeysVault } from "@/lib/account/keys";
import { getCurrentUser } from "@/lib/auth";
import { KeyCard, type KeyCardOrder } from "./key-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "کلیدها و لایسنس‌ها | حساب کاربری",
};

export default async function KeysVaultPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/keys");
  }

  const vault = await getKeysVault(user.id);

  return (
    <main className="space-y-6" dir="rtl">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-black sm:text-3xl">
          <KeyRound className="size-6 text-gold" />
          کلیدها و لایسنس‌ها
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          همه کدهای دیجیتال خریداری‌شده شما در یک‌جا. کدها به‌صورت پیش‌فرض پنهان‌اند؛ برای دیدن یا کپی
          روی آیکون‌ها بزنید.
        </p>
      </header>

      {vault.orders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
            <KeyRound className="size-7" />
          </div>
          <div>
            <p className="text-lg font-black">هنوز کلیدی ندارید</p>
            <p className="mt-1 text-sm text-muted-foreground">
              پس از خرید محصولات دیجیتال، کدها و لایسنس‌های شما این‌جا نمایش داده می‌شود.
            </p>
          </div>
          <Link href="/" className={buttonVariants()}>
            <ShoppingBag className="size-4" />
            مشاهده فروشگاه
          </Link>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            مجموعاً <span className="font-black text-foreground">{vault.totalKeys}</span> کد در{" "}
            <span className="font-black text-foreground">{vault.orders.length}</span> سفارش.
          </p>
          <div className="space-y-4">
            {vault.orders.map((order) => {
              const card: KeyCardOrder = {
                orderId: order.orderId,
                orderNumber: order.orderNumber,
                createdAt: order.createdAt.toISOString(),
                keyCount: order.keyCount,
                hasEmail: order.hasEmail,
                products: order.products.map((product) => ({
                  variantId: product.variantId,
                  titleFa: product.titleFa,
                  variantFa: product.variantFa,
                  keys: product.keys.map((key) => ({ id: key.id, code: key.code })),
                })),
              };
              return <KeyCard key={order.orderId} order={card} />;
            })}
          </div>
        </>
      )}
    </main>
  );
}
