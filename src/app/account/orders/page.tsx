import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { listAccountOrders } from "@/lib/orders/account-orders";
import { OrdersList } from "./orders-list";

export default async function OrdersHistoryPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/orders");
  }

  const initial = await listAccountOrders({ userId: user.id, page: 1 });

  return (
    <main className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">سفارش‌های من</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          تاریخچه سفارش‌ها، پیگیری وضعیت و خرید دوباره.
        </p>
      </header>

      <OrdersList initial={initial} />
    </main>
  );
}
