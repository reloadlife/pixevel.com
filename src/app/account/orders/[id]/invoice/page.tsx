import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";
import { paymentStatusMeta } from "@/lib/status-labels";
import { PrintButton } from "./print-button";

function faDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoicePage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirect=/account/orders/${id}/invoice`);
  }

  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.id, id),
    with: { items: true },
  });

  // Only the order's owner or an admin may view the invoice.
  const isOwner = order?.userId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!order || (!isOwner && !isAdmin)) {
    notFound();
  }

  const payment = paymentStatusMeta(order.paymentStatus);
  const hasShipping = Number(order.shippingAmount) > 0;
  const hasDiscount = Number(order.discountAmount) > 0;
  const addressParts = [order.province, order.city, order.addressLine].filter(Boolean);

  return (
    <main
      className="mx-auto max-w-3xl bg-background px-4 py-8 text-foreground sm:px-8 print:max-w-none print:px-0 print:py-0"
      dir="rtl"
    >
      {/* Action bar — hidden when printing */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <a
          href={`/account/orders/${order.id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← بازگشت به جزئیات سفارش
        </a>
        <PrintButton />
      </div>

      {/* Invoice header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-lg font-black tracking-tight">Pixevel</p>
          <p className="mt-1 text-xs text-muted-foreground">فاکتور فروش</p>
        </div>
        <div className="text-left" dir="ltr">
          <p className="font-mono text-sm font-black">{order.orderNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground" dir="rtl">
            {faDateTime(order.createdAt)}
          </p>
        </div>
      </header>

      {/* Customer + payment meta */}
      <section className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            مشتری
          </h2>
          <dl className="space-y-1">
            {order.customerName ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">نام:</dt>
                <dd>{order.customerName}</dd>
              </div>
            ) : null}
            {order.customerPhone ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">تلفن:</dt>
                <dd dir="ltr" className="font-mono">
                  {order.customerPhone}
                </dd>
              </div>
            ) : null}
            {order.recipientEmail || order.customerEmail ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">ایمیل:</dt>
                <dd dir="ltr" className="font-mono">
                  {order.recipientEmail || order.customerEmail}
                </dd>
              </div>
            ) : null}
            {addressParts.length > 0 ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">نشانی:</dt>
                <dd>{addressParts.join("، ")}</dd>
              </div>
            ) : null}
            {order.postalCode ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">کد پستی:</dt>
                <dd dir="ltr" className="font-mono">
                  {order.postalCode}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            پرداخت
          </h2>
          <dl className="space-y-1">
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">وضعیت:</dt>
              <dd className="font-bold">{payment.label}</dd>
            </div>
            {order.couponCode ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">کد تخفیف:</dt>
                <dd dir="ltr" className="font-mono">
                  {order.couponCode}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {/* Line items */}
      <section className="mt-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border text-right text-xs text-muted-foreground">
              <th className="py-2 pl-2 font-bold">کالا</th>
              <th className="py-2 px-2 text-center font-bold">تعداد</th>
              <th className="py-2 px-2 text-left font-bold">قیمت واحد</th>
              <th className="py-2 pr-2 text-left font-bold">جمع</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-border align-top">
                <td className="py-3 pl-2">
                  <p className="font-medium">{item.titleFa}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.colorNameFa} / {item.materialNameFa} / سایز {item.size}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {item.sku}
                  </p>
                </td>
                <td className="py-3 px-2 text-center">{item.quantity}</td>
                <td className="py-3 px-2 text-left">{formatToman(item.unitPrice)}</td>
                <td className="py-3 pr-2 text-left font-medium">{formatToman(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totals */}
      <section className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">جمع کالاها</dt>
            <dd>{formatToman(order.subtotalAmount)}</dd>
          </div>
          {hasShipping ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">هزینه ارسال</dt>
              <dd>{formatToman(order.shippingAmount)}</dd>
            </div>
          ) : null}
          {hasDiscount ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">تخفیف</dt>
              <dd>-{formatToman(order.discountAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-2 text-base font-black">
            <dt>مبلغ کل</dt>
            <dd>{formatToman(order.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        از خرید شما سپاسگزاریم — Pixevel
      </footer>
    </main>
  );
}
