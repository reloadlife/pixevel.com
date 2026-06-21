import { Download, Receipt } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatToman, toFaNumber } from "@/lib/format";
import { paymentStatusMeta, type StatusTone, toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

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

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/payments");
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const db = getDb();

  const rows = await db.query.payments.findMany({
    where: (p, { eq }) => eq(p.userId, user.id),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
    with: {
      order: { columns: { id: true, orderNumber: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return (
    <main className="space-y-6 pb-10">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">پرداخت‌ها و رسیدها</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تاریخچه پرداخت‌های شما و رسید هر تراکنش در این بخش در دسترس است.
        </p>
      </header>

      {items.length === 0 ? (
        <Card className="grid place-items-center px-5 py-16 text-center">
          <Receipt className="size-10 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">
            {page > 1 ? "پرداختی در این صفحه وجود ندارد." : "هنوز پرداختی ثبت نشده است."}
          </p>
          {page > 1 ? (
            <Link
              href="/account/payments"
              className="mt-4 rounded-xl border px-4 py-2 text-sm font-black transition hover:bg-muted"
            >
              بازگشت به ابتدای فهرست
            </Link>
          ) : (
            <Link
              href="/"
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition hover:opacity-90"
            >
              شروع خرید
            </Link>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {items.map((payment) => {
              const meta = paymentStatusMeta(payment.status);
              return (
                <li
                  key={payment.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black">
                        {formatToman(payment.amount.toString())}
                      </span>
                      <StatusBadge label={meta.label} tone={meta.tone} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {faDate(payment.paidAt ?? payment.createdAt)}
                      {payment.provider ? (
                        <>
                          {" · "}
                          <span dir="ltr">{payment.provider}</span>
                        </>
                      ) : null}
                    </p>
                    {payment.orderId ? (
                      <Link
                        href={`/account/orders/${payment.orderId}`}
                        className="mt-1 inline-block text-xs font-bold text-primary underline-offset-4 hover:underline"
                      >
                        مشاهده سفارش
                        {payment.order?.orderNumber ? (
                          <span className="font-mono" dir="ltr">
                            {" "}
                            {payment.order.orderNumber}
                          </span>
                        ) : null}
                      </Link>
                    ) : null}
                  </div>

                  {payment.receiptUrl ? (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border px-3 py-2 text-sm font-bold transition hover:bg-muted sm:self-center"
                    >
                      <Download className="size-4" aria-hidden />
                      دانلود رسید
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {(page > 1 || hasMore) && items.length > 0 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="صفحه‌بندی پرداخت‌ها">
          {page > 1 ? (
            <Link
              href={`/account/payments?page=${page - 1}`}
              className="rounded-xl border px-4 py-2 text-sm font-bold transition hover:bg-muted"
            >
              صفحه قبل
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">صفحه {toFaNumber(page)}</span>
          {hasMore ? (
            <Link
              href={`/account/payments?page=${page + 1}`}
              className="rounded-xl border px-4 py-2 text-sm font-bold transition hover:bg-muted"
            >
              صفحه بعد
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
