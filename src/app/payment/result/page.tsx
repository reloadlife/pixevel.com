import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────

type ResultStatus = "success" | "failed" | "pending";

interface PageProps {
  searchParams: Promise<{ orderId?: string; status?: string }>;
}

/** Map the DB paymentStatus enum to our display state. */
function dbStatusToResult(
  dbStatus: "UNPAID" | "AUTHORIZED" | "PAID" | "FAILED" | "REFUNDED",
): ResultStatus {
  if (dbStatus === "PAID") return "success";
  if (dbStatus === "FAILED") return "failed";
  // UNPAID, AUTHORIZED, REFUNDED all show as pending/ambiguous.
  return "pending";
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

// ─── Fulfillment classification ───────────────────────────────────────────────

type FulfillmentBucket = "digital" | "physical" | "mixed" | "unknown";

type FulfillmentType = "DIGITAL" | "PHYSICAL" | "DOMAIN" | "SERVER" | "SERVICE";

const DIGITAL_TYPES = new Set<FulfillmentType>(["DIGITAL"]);
const PHYSICAL_TYPES = new Set<FulfillmentType>(["PHYSICAL", "DOMAIN", "SERVER", "SERVICE"]);

function classifyFulfillment(types: FulfillmentType[]): FulfillmentBucket {
  if (types.length === 0) return "unknown";
  const hasDigital = types.some((t) => DIGITAL_TYPES.has(t));
  const hasPhysical = types.some((t) => PHYSICAL_TYPES.has(t));
  if (hasDigital && hasPhysical) return "mixed";
  if (hasDigital) return "digital";
  return "physical";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PaymentResultPage({ searchParams }: PageProps) {
  const { orderId, status: hintStatus } = await searchParams;

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    // Preserve the original query string so after login the user lands back here.
    const params = new URLSearchParams();
    if (orderId) params.set("orderId", orderId);
    if (hintStatus) params.set("status", hintStatus);
    const returnPath = `/payment/result${params.size > 0 ? `?${params.toString()}` : ""}`;
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }

  // ── Order lookup (ownership-scoped) ────────────────────────────────────────
  let order: {
    orderNumber: string;
    totalAmount: string | number;
    paymentStatus: "UNPAID" | "AUTHORIZED" | "PAID" | "FAILED" | "REFUNDED";
    items: { fulfillmentType: FulfillmentType }[];
  } | null = null;

  if (orderId) {
    const db = getDb();
    order =
      (await db.query.orders.findFirst({
        where: (o, { and, eq }) => and(eq(o.id, orderId), eq(o.userId, user.id)),
        columns: { orderNumber: true, totalAmount: true, paymentStatus: true },
        with: {
          items: { columns: { fulfillmentType: true } },
        },
      })) ?? null;
    // If order not found or belongs to someone else, we fall through with order = null.
    // We do NOT reveal whether the order exists at all.
  }

  // ── Derive display status from DB, not URL ─────────────────────────────────
  const status: ResultStatus = order
    ? dbStatusToResult(order.paymentStatus)
    : // No order found (missing param, wrong user, etc.) — treat as failed/unknown.
      // The ?status hint is intentionally ignored for security: the DB is the truth.
      "failed";

  const state = STATE[status];

  // ── Fulfillment bucket (only relevant for success) ─────────────────────────
  const fulfillmentBucket: FulfillmentBucket =
    order && status === "success"
      ? classifyFulfillment(order.items.map((i) => i.fulfillmentType))
      : "unknown";

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
          {order && (
            <dl className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
              {order.orderNumber && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">شماره سفارش</dt>
                  <dd className="font-mono font-medium" dir="ltr">
                    {order.orderNumber}
                  </dd>
                </div>
              )}
              {order.totalAmount != null && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">مبلغ</dt>
                  <dd className="font-black">{formatToman(order.totalAmount)}</dd>
                </div>
              )}
            </dl>
          )}

          {/* Success note: fulfillment-aware */}
          {status === "success" &&
            (fulfillmentBucket === "digital" || fulfillmentBucket === "mixed") && (
              <div className="mt-6 rounded border border-green-500/30 bg-green-500/10 p-4 text-right text-sm">
                <p className="font-medium text-green-700 dark:text-green-400">
                  کدهای دیجیتال شما آماده است
                </p>
                <p className="mt-1 text-muted-foreground">
                  کدها به ایمیل شما ارسال شدند و در حساب کاربری‌تان نیز قابل مشاهده هستند.
                </p>
              </div>
            )}

          {status === "success" &&
            (fulfillmentBucket === "physical" || fulfillmentBucket === "mixed") && (
              <div className="mt-6 rounded border border-green-500/30 bg-green-500/10 p-4 text-right text-sm">
                <p className="font-medium text-green-700 dark:text-green-400">سفارش شما ثبت شد</p>
                <p className="mt-1 text-muted-foreground">
                  سفارش شما پردازش می‌شود و به‌زودی ارسال خواهد شد. وضعیت ارسال را در حساب کاربری‌تان
                  دنبال کنید.
                </p>
              </div>
            )}

          {status === "success" && fulfillmentBucket === "unknown" && (
            <div className="mt-6 rounded border border-green-500/30 bg-green-500/10 p-4 text-right text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">سفارش شما ثبت شد</p>
              <p className="mt-1 text-muted-foreground">
                جزئیات سفارش در حساب کاربری‌تان قابل مشاهده است.
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
