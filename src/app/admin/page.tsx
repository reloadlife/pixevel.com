import {
  AlertTriangleIcon,
  BanknoteIcon,
  ClockIcon,
  PackageIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderStatus, PaymentStatus } from "@/db/schema";
import {
  type DashboardMetrics,
  getDashboardMetrics,
  LOW_STOCK_THRESHOLD,
} from "@/lib/admin/metrics";
import { getCurrentUser } from "@/lib/auth";
import { formatToman, toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Labels & colors ──────────────────────────────────────────────────────────

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "در انتظار",
  PAID: "پرداخت شده",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  REFUNDED: "مسترد شده",
};

const ORDER_STATUS_BAR: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-400",
  PAID: "bg-blue-500",
  PROCESSING: "bg-indigo-500",
  SHIPPED: "bg-purple-500",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-zinc-400",
  REFUNDED: "bg-red-500",
};

const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-zinc-100 text-zinc-600",
  REFUNDED: "bg-red-100 text-red-800",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "پرداخت نشده",
  AUTHORIZED: "تأییدشده",
  PAID: "پرداخت شده",
  FAILED: "ناموفق",
  REFUNDED: "مسترد شده",
};

const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  UNPAID: "bg-yellow-100 text-yellow-800",
  AUTHORIZED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-orange-100 text-orange-800",
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  if (user.role !== "ADMIN") {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4">
        <div className="border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-black">دسترسی مجاز نیست</h1>
          <p className="mt-2 text-muted-foreground">این بخش فقط برای ادمین‌هاست.</p>
        </div>
      </main>
    );
  }

  const metrics = await getDashboardMetrics();

  return (
    <div dir="rtl" className="space-y-6">
      <KpiGrid metrics={metrics} />

      <div className="grid gap-6 lg:grid-cols-3">
        <OrdersByStatus counts={metrics.orderCountsByStatus} total={metrics.totalOrders} />
        <PaymentBreakdown counts={metrics.orderCountsByPaymentStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LowStockList items={metrics.lowStock} />
        <TopProductsList items={metrics.topProducts} />
      </div>

      <RecentOrdersTable orders={metrics.recentOrders} />
    </div>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

function KpiGrid({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="درآمد کل"
        value={formatToman(metrics.revenue.total)}
        icon={BanknoteIcon}
        hint="مجموع پرداخت‌های موفق"
      />
      <KpiCard
        title="درآمد امروز"
        value={formatToman(metrics.revenue.today)}
        icon={TrendingUpIcon}
        hint={`۷ روز اخیر: ${formatToman(metrics.revenue.last7Days)}`}
      />
      <KpiCard
        title="سفارش‌ها"
        value={toFaNumber(metrics.totalOrders)}
        icon={ShoppingBagIcon}
        hint="تعداد کل سفارش‌های ثبت‌شده"
      />
      <KpiCard
        title="در انتظار پرداخت"
        value={toFaNumber(metrics.pendingPaymentOrders)}
        icon={ClockIcon}
        accent={metrics.pendingPaymentOrders > 0 ? "warn" : undefined}
        hint="سفارش‌های پرداخت‌نشده یا در انتظار تأیید"
      />
      <KpiCard
        title="کاربران"
        value={toFaNumber(metrics.totalUsers)}
        icon={UsersIcon}
        hint="کاربران ثبت‌نام‌شده"
      />
      <KpiCard
        title="محصولات"
        value={toFaNumber(metrics.totalProducts)}
        icon={PackageIcon}
        hint="محصولات تعریف‌شده"
      />
      <KpiCard
        title="مشترکین خبرنامه"
        value={toFaNumber(metrics.activeNewsletterSubscribers)}
        icon={UsersIcon}
        hint="مشترکین فعال"
      />
      <KpiCard
        title="کسری موجودی"
        value={toFaNumber(metrics.lowStock.length)}
        icon={AlertTriangleIcon}
        accent={metrics.lowStock.length > 0 ? "warn" : undefined}
        hint={`تنوع‌هایی با موجودی کمتر از ${toFaNumber(LOW_STOCK_THRESHOLD)}`}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  hint: string;
  accent?: "warn";
}) {
  return (
    <Card className={cn(accent === "warn" && "border-amber-300 bg-amber-50/40")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon
            className={cn("h-4 w-4 text-muted-foreground", accent === "warn" && "text-amber-600")}
          />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-black tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

// ─── Orders by status (CSS bars) ────────────────────────────────────────────────

function OrdersByStatus({
  counts,
  total,
}: {
  counts: DashboardMetrics["orderCountsByStatus"];
  total: number;
}) {
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base font-black">سفارش‌ها بر اساس وضعیت</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {counts.map((row) => (
            <li key={row.status} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">
                {ORDER_STATUS_LABELS[row.status]}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className={cn("h-full rounded", ORDER_STATUS_BAR[row.status])}
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-left text-xs font-bold tabular-nums">
                {toFaNumber(row.count)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          مجموع سفارش‌ها: <span className="font-bold">{toFaNumber(total)}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function PaymentBreakdown({ counts }: { counts: DashboardMetrics["orderCountsByPaymentStatus"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-black">وضعیت پرداخت سفارش‌ها</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {counts.map((row) => (
            <li key={row.status} className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-bold",
                  PAYMENT_STATUS_BADGE[row.status],
                )}
              >
                {PAYMENT_STATUS_LABELS[row.status]}
              </span>
              <span className="text-sm font-black tabular-nums">{toFaNumber(row.count)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Low stock ────────────────────────────────────────────────────────────────

function LowStockList({ items }: { items: DashboardMetrics["lowStock"] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-black">
            <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
            هشدار کسری موجودی
          </CardTitle>
          <Link href="/admin/inventory" className="text-xs text-primary hover:underline">
            مدیریت موجودی
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            موجودی همه تنوع‌ها در حد مطلوب است.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.productTitleFa}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.variantTitleFa}
                    <span className="mx-1">·</span>
                    <span className="font-mono" dir="ltr">
                      {item.sku}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 text-xs font-bold",
                    item.availableCount === 0
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800",
                  )}
                >
                  {item.availableCount === 0 ? "ناموجود" : `${toFaNumber(item.availableCount)} عدد`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top products ─────────────────────────────────────────────────────────────

function TopProductsList({ items }: { items: DashboardMetrics["topProducts"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          پرفروش‌ترین محصولات
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">هنوز فروشی ثبت نشده است.</p>
        ) : (
          <ol className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.variantId ?? item.sku}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-black tabular-nums">
                    {toFaNumber(index + 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.titleFa}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatToman(item.revenue)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                  {toFaNumber(item.unitsSold)} فروش
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Recent orders ────────────────────────────────────────────────────────────

function RecentOrdersTable({ orders }: { orders: DashboardMetrics["recentOrders"] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-black">آخرین سفارش‌ها</CardTitle>
          <Link href="/admin/orders" className="text-xs text-primary hover:underline">
            همه سفارش‌ها
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            هنوز سفارشی ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-right text-xs font-black text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-2">شماره سفارش</th>
                  <th className="p-2">مشتری</th>
                  <th className="p-2">وضعیت</th>
                  <th className="p-2">پرداخت</th>
                  <th className="p-2">مبلغ</th>
                  <th className="p-2">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="p-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs font-bold text-primary hover:underline"
                        dir="ltr"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="p-2">
                      <span className="block truncate">{order.customerName ?? "—"}</span>
                      {order.customerPhone ? (
                        <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                          {order.customerPhone}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-bold",
                          ORDER_STATUS_BADGE[order.status],
                        )}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="p-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-bold",
                          PAYMENT_STATUS_BADGE[order.paymentStatus],
                        )}
                      >
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </td>
                    <td className="p-2 font-bold tabular-nums">{formatToman(order.totalAmount)}</td>
                    <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
