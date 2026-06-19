import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileCard } from "@/components/account/profile-card";
import { Card } from "@/components/ui/card";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";
import {
  orderStatusMeta,
  paymentStatusMeta,
  type StatusTone,
  toneClass,
} from "@/lib/status-labels";
import { cn } from "@/lib/utils";

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        toneClass(tone),
      )}
    >
      {label}
    </span>
  );
}

function SectionCard({
  title,
  count,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-black">{title}</h2>
        {count > 0 ? <span className="text-xs text-muted-foreground">{count} مورد</span> : null}
      </div>
      {count === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y">{children}</div>
      )}
    </Card>
  );
}

export default async function AccountPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login?redirect=/account");
  }

  const db = getDb();
  const [profile, orders, payments] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, sessionUser.id),
      columns: {
        fullName: true,
        email: true,
        phone: true,
        isPremium: true,
        createdAt: true,
        defaultAddressLine: true,
        defaultCity: true,
        defaultProvince: true,
        defaultPostalCode: true,
      },
    }),
    db.query.orders.findMany({
      where: (order, { eq: eqOp }) => eqOp(order.userId, sessionUser.id),
      orderBy: (order, { desc }) => [desc(order.createdAt)],
      limit: 20,
    }),
    db.query.payments.findMany({
      where: (payment, { eq: eqOp }) => eqOp(payment.userId, sessionUser.id),
      orderBy: (payment, { desc }) => [desc(payment.createdAt)],
      limit: 20,
    }),
  ]);

  if (!profile) {
    redirect("/login?redirect=/account");
  }

  return (
    <main className="bg-background px-4 pb-10 pt-4 text-foreground sm:px-8 lg:px-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <ProfileCard profile={profile} />

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="سفارش‌ها" count={orders.length} emptyText="هنوز سفارشی ثبت نشده است.">
            {orders.map((order) => {
              const meta = orderStatusMeta(order.status);
              const payMeta = paymentStatusMeta(order.paymentStatus);
              return (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="font-black" dir="ltr">
                      {order.orderNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {faDate(order.createdAt)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge label={meta.label} tone={meta.tone} />
                      <StatusBadge label={payMeta.label} tone={payMeta.tone} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold">
                      {formatToman(order.totalAmount.toString())}
                    </span>
                    <span aria-hidden className="text-muted-foreground">
                      ‹
                    </span>
                  </div>
                </Link>
              );
            })}
          </SectionCard>

          <SectionCard
            title="پرداخت‌ها"
            count={payments.length}
            emptyText="هنوز پرداختی ثبت نشده است."
          >
            {payments.map((payment) => {
              const meta = paymentStatusMeta(payment.status);
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-muted-foreground">
                      {payment.provider ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {faDate(payment.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge label={meta.label} tone={meta.tone} />
                    <span className="text-sm font-bold">
                      {formatToman(payment.amount.toString())}
                    </span>
                  </div>
                </div>
              );
            })}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
