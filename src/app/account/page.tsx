import { redirect } from "next/navigation";

import { BottomNav } from "@/components/shop/bottom-nav";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  const db = getDb();
  const [orders, payments] = await Promise.all([
    db.query.orders.findMany({
      where: (order, { eq }) => eq(order.userId, user.id),
      orderBy: (order, { desc }) => [desc(order.createdAt)],
      limit: 20,
    }),
    db.query.payments.findMany({
      where: (payment, { eq }) => eq(payment.userId, user.id),
      orderBy: (payment, { desc }) => [desc(payment.createdAt)],
      limit: 20,
    }),
  ]);

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-6 text-foreground sm:px-8 lg:px-14">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">Pixevel Account</p>
        <h1 className="mt-3 text-4xl font-black">حساب کاربری</h1>
        <p className="mt-2 text-sm text-muted-foreground" dir="ltr">{user.phone}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border border-border bg-card p-4">
          <h2 className="font-black">تاریخچه سفارش‌ها</h2>
          <div className="mt-4 space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="border border-border p-3 text-sm">
                  <p className="font-black">{order.orderNumber}</p>
                  <p className="text-muted-foreground">{formatToman(order.totalAmount.toString())}</p>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="border border-border bg-card p-4">
          <h2 className="font-black">تاریخچه پرداخت‌ها</h2>
          <div className="mt-4 space-y-3">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز پرداختی ثبت نشده است.</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="border border-border p-3 text-sm">
                  <p className="font-black">{payment.status}</p>
                  <p className="text-muted-foreground">{formatToman(payment.amount.toString())}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      <BottomNav user={user} />
    </main>
  );
}
