import Link from "next/link";

import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────

type ResultStatus = "success" | "failed" | "pending";

interface PageProps {
  searchParams: Promise<{ orderId?: string; status?: string }>;
}

function normalizeStatus(value: string | undefined): ResultStatus {
  if (value === "success" || value === "failed" || value === "pending") {
    return value;
  }
  return "failed";
}

// ─── Visual config per state ─────────────────────────────────────────────────

const STATE = {
  success: {
    badge: "✓",
    badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400",
    title: "پرداخت با موفقیت انجام شد",
    subtitle: "سفارش شما ثبت و تأیید شد.",
  },
  failed: {
    badge: "✕",
    badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400",
    title: "پرداخت ناموفق بود",
    subtitle: "متأسفانه پرداخت شما کامل نشد.",
  },
  pending: {
    badge: "…",
    badgeClass: "bg-yellow-400/15 text-yellow-600 dark:text-yellow-400",
    title: "پرداخت در حال بررسی است",
    subtitle: "وضعیت پرداخت شما هنوز قطعی نشده است.",
  },
} as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PaymentResultPage({ searchParams }: PageProps) {
  const { orderId, status: rawStatus } = await searchParams;
  const status = normalizeStatus(rawStatus);
  const state = STATE[status];

  // Load minimal order details for display (best-effort; the page renders even
  // if the order can't be loaded).
  let orderNumber: string | null = null;
  let totalAmount: string | number | null = null;

  if (orderId) {
    try {
      const db = getDb();
      const order = await db.query.orders.findFirst({
        where: (o, { eq }) => eq(o.id, orderId),
        columns: { orderNumber: true, totalAmount: true },
      });
      if (order) {
        orderNumber = order.orderNumber;
        totalAmount = order.totalAmount;
      }
    } catch {
      // Ignore — show the result without order metadata.
    }
  }

  const orderHref = orderId ? `/account/orders/${orderId}` : "/account/orders";

  return (
    <main
      className="flex min-h-[70vh] items-start justify-center bg-background px-4 py-12 text-foreground sm:px-8"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <div className="border border-border bg-card p-6 text-center sm:p-8">
          <div
            className={`mx-auto flex size-14 items-center justify-center rounded-full text-2xl font-black ${state.badgeClass}`}
            aria-hidden
          >
            {state.badge}
          </div>

          <h1 className="mt-5 text-2xl font-black">{state.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.subtitle}</p>

          {/* Order meta */}
          {(orderNumber || totalAmount != null) && (
            <dl className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
              {orderNumber && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">شماره سفارش</dt>
                  <dd className="font-mono font-medium" dir="ltr">
                    {orderNumber}
                  </dd>
                </div>
              )}
              {totalAmount != null && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">مبلغ</dt>
                  <dd className="font-black">{formatToman(totalAmount)}</dd>
                </div>
              )}
            </dl>
          )}

          {/* Success note: digital codes emailed + viewable in account */}
          {status === "success" && (
            <div className="mt-6 rounded border border-green-500/30 bg-green-500/10 p-4 text-right text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">
                کدهای دیجیتال شما ایمیل شد
              </p>
              <p className="mt-1 text-muted-foreground">
                کدها به ایمیل شما ارسال شدند و در حساب کاربری‌تان نیز قابل مشاهده هستند.
              </p>
            </div>
          )}

          {/* Pending note */}
          {status === "pending" && (
            <div className="mt-6 rounded border border-yellow-400/30 bg-yellow-400/10 p-4 text-right text-sm">
              <p className="font-medium text-yellow-700 dark:text-yellow-400">در انتظار تأیید</p>
              <p className="mt-1 text-muted-foreground">
                به‌محض مشخص‌شدن وضعیت، نتیجه در صفحه سفارش نمایش داده می‌شود.
              </p>
            </div>
          )}

          {/* Failure retry / contact CTA */}
          {status === "failed" && (
            <div className="mt-6 rounded border border-red-500/30 bg-red-500/10 p-4 text-right text-sm">
              <p className="text-muted-foreground">
                اگر مبلغی از حساب شما کسر شده باشد، طی ۷۲ ساعت به‌صورت خودکار بازگردانده می‌شود.
                می‌توانید پرداخت را دوباره از صفحه سفارش انجام دهید یا با پشتیبانی در تماس باشید.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-7 flex flex-col gap-3">
            <Link
              href={orderHref}
              className="inline-flex h-11 items-center justify-center bg-foreground px-5 text-sm font-black text-background"
            >
              {status === "failed" ? "بازگشت به سفارش و تلاش دوباره" : "مشاهده سفارش"}
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center border border-border px-5 text-sm font-medium"
            >
              بازگشت به فروشگاه
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
