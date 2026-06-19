import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";
import { CopyButton } from "./copy-button";

// ─── Label helpers ────────────────────────────────────────────────────────────

function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "در انتظار",
    PAID: "پرداخت شده",
    PROCESSING: "در حال پردازش",
    SHIPPED: "ارسال شده",
    DELIVERED: "تحویل داده شده",
    CANCELLED: "لغو شده",
    REFUNDED: "بازگشت وجه",
  };
  return map[status] ?? status;
}

function paymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    UNPAID: "پرداخت نشده",
    AUTHORIZED: "مجاز",
    PAID: "پرداخت شده",
    FAILED: "ناموفق",
    REFUNDED: "بازگشت وجه",
  };
  return map[status] ?? status;
}

function shippingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "در انتظار پردازش",
    PAID: "آماده‌سازی",
    PROCESSING: "در حال آماده‌سازی",
    SHIPPED: "ارسال شده",
    DELIVERED: "تحویل داده شده",
    CANCELLED: "لغو شده",
    REFUNDED: "بازگشت وجه",
  };
  return map[status] ?? status;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirect=/account/orders/${id}`);
  }

  const db = getDb();

  const order = await db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.id, id),
    with: {
      items: {
        with: {
          variant: {
            with: {
              product: {
                columns: { fulfillmentType: true },
              },
            },
          },
        },
      },
      inventoryUnits: {
        where: (u, { eq }) => eq(u.status, "SOLD"),
        columns: { id: true, variantId: true, code: true },
      },
    },
  });

  if (!order || order.userId !== user.id) {
    notFound();
  }

  const isPaid = order.paymentStatus === "PAID";

  // Build variantId → codes[] map for digital delivery
  const codesByVariant = new Map<string, string[]>();
  for (const unit of order.inventoryUnits) {
    const existing = codesByVariant.get(unit.variantId) ?? [];
    existing.push(unit.code);
    codesByVariant.set(unit.variantId, existing);
  }

  // Determine if any item is PHYSICAL
  const hasPhysical = order.items.some(
    (item) => item.variant?.product?.fulfillmentType === "PHYSICAL",
  );
  const hasDigital = order.items.some(
    (item) => item.variant?.product?.fulfillmentType === "DIGITAL" || !item.variant?.product,
  );

  return (
    <main
      className="min-h-dvh bg-background px-4 pb-24 pt-14 text-foreground sm:px-8 lg:px-14"
      dir="rtl"
    >
      {/* Header */}
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-3 text-4xl font-black">جزئیات سفارش</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground" dir="ltr">
          {order.orderNumber}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Order summary */}
        <section className="border border-border bg-card p-4">
          <h2 className="font-black">خلاصه سفارش</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">وضعیت سفارش</dt>
              <dd className="font-medium">{orderStatusLabel(order.status)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">وضعیت پرداخت</dt>
              <dd className="font-medium">{paymentStatusLabel(order.paymentStatus)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">جمع کالاها</dt>
              <dd className="font-medium">{formatToman(order.subtotalAmount)}</dd>
            </div>
            {Number(order.shippingAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">هزینه ارسال</dt>
                <dd className="font-medium">{formatToman(order.shippingAmount)}</dd>
              </div>
            )}
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">تخفیف</dt>
                <dd className="font-medium text-green-600">-{formatToman(order.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-black">مبلغ کل</dt>
              <dd className="font-black">{formatToman(order.totalAmount)}</dd>
            </div>
          </dl>
        </section>

        {/* Order items */}
        <section className="border border-border bg-card p-4">
          <h2 className="font-black">اقلام سفارش</h2>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="border border-border p-3 text-sm">
                <p className="font-black">{item.titleFa}</p>
                <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                  {item.sku}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.colorNameFa} / {item.materialNameFa} / سایز {item.size}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">× {item.quantity}</span>
                  <span className="font-medium">{formatToman(item.totalPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Delivery section */}
      <section className="mt-5 border border-border bg-card p-4">
        <h2 className="font-black">تحویل</h2>

        {!isPaid ? (
          <div className="mt-4 rounded border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm">
            <p className="font-medium text-yellow-700 dark:text-yellow-400">در انتظار پرداخت</p>
            <p className="mt-1 text-muted-foreground">
              پس از تأیید پرداخت، اطلاعات تحویل در این بخش نمایش داده می‌شود.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Digital codes */}
            {hasDigital && (
              <div>
                <h3 className="mb-3 text-sm font-black text-muted-foreground">کدهای دیجیتال</h3>
                <div className="space-y-3">
                  {order.items
                    .filter(
                      (item) =>
                        item.variant?.product?.fulfillmentType === "DIGITAL" ||
                        !item.variant?.product,
                    )
                    .map((item) => {
                      const codes = item.variantId
                        ? (codesByVariant.get(item.variantId) ?? [])
                        : [];
                      return (
                        <div key={item.id} className="border border-border p-3 text-sm">
                          <p className="mb-2 font-medium">{item.titleFa}</p>
                          {codes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              کدی تخصیص داده نشده است.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {codes.map((code) => (
                                <div
                                  key={code}
                                  className="flex items-center justify-between rounded bg-muted px-3 py-1.5"
                                >
                                  <span className="font-mono text-xs" dir="ltr">
                                    {code}
                                  </span>
                                  <CopyButton text={code} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Physical shipping */}
            {hasPhysical && (
              <div>
                <h3 className="mb-3 text-sm font-black text-muted-foreground">اطلاعات ارسال</h3>
                <div className="border border-border p-3 text-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {shippingStatusLabel(order.status)}
                    </span>
                  </div>
                  <dl className="space-y-1.5">
                    {order.customerName && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">گیرنده:</dt>
                        <dd>{order.customerName}</dd>
                      </div>
                    )}
                    {order.addressLine && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">آدرس:</dt>
                        <dd>{order.addressLine}</dd>
                      </div>
                    )}
                    {(order.city || order.province) && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">شهر:</dt>
                        <dd>{[order.city, order.province].filter(Boolean).join("، ")}</dd>
                      </div>
                    )}
                    {order.postalCode && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">کد پستی:</dt>
                        <dd dir="ltr" className="font-mono">
                          {order.postalCode}
                        </dd>
                      </div>
                    )}
                    {order.customerPhone && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">تلفن:</dt>
                        <dd dir="ltr" className="font-mono">
                          {order.customerPhone}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Back link */}
      <div className="mt-6">
        <a href="/account" className="text-sm text-muted-foreground underline underline-offset-4">
          ← بازگشت به حساب کاربری
        </a>
      </div>
    </main>
  );
}
