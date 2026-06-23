"use client";

import { ChevronDown, CreditCard, RefreshCw, Repeat, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatToman, toFaNumber } from "@/lib/format";
import { type StatusTone, toneClass } from "@/lib/status-labels";
import type { AccountSubscription } from "@/lib/subscriptions/query";
import { cn } from "@/lib/utils";

/** Persian (Jalali) calendar date from an ISO string. */
function faDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("fa-IR").format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  TRIALING: { label: "دوره آزمایشی", tone: "info" },
  ACTIVE: { label: "فعال", tone: "success" },
  PAST_DUE: { label: "پرداخت معوق", tone: "warning" },
  CANCELED: { label: "لغو شده", tone: "muted" },
  EXPIRED: { label: "منقضی شده", tone: "muted" },
  PAUSED: { label: "متوقف", tone: "warning" },
};

const INVOICE_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: "در انتظار", tone: "warning" },
  PAID: { label: "پرداخت شده", tone: "success" },
  FAILED: { label: "ناموفق", tone: "danger" },
  CANCELED: { label: "لغو شده", tone: "muted" },
};

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

/** Subscriptions where lifecycle actions (renew / cancel / toggle) still apply. */
function isManageable(status: string): boolean {
  return (
    status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE" || status === "PAUSED"
  );
}

export function SubscriptionsClient({ subscriptions }: { subscriptions: AccountSubscription[] }) {
  if (subscriptions.length === 0) {
    return (
      <Card className="grid place-items-center px-5 py-14 text-center">
        <Repeat className="size-9 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm text-muted-foreground">هنوز اشتراکی ندارید.</p>
        <a href="/products" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
          مشاهده محصولات
        </a>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {subscriptions.map((subscription) => (
        <SubscriptionCard key={subscription.id} subscription={subscription} />
      ))}
    </div>
  );
}

function SubscriptionCard({ subscription }: { subscription: AccountSubscription }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "autoRenew" | "renew" | "cancel">(null);
  const [autoRenew, setAutoRenew] = useState(subscription.autoRenew);
  const [showInvoices, setShowInvoices] = useState(false);

  const status = SUBSCRIPTION_STATUS[subscription.status] ?? {
    label: subscription.status,
    tone: "muted" as StatusTone,
  };
  const manageable = isManageable(subscription.status);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/account/subscriptions/${subscription.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && json?.ok === true, data: json?.data, error: json?.error };
  }

  async function toggleAutoRenew() {
    const next = !autoRenew;
    setBusy("autoRenew");
    setAutoRenew(next); // optimistic
    const { ok, error } = await patch({ action: "setAutoRenew", autoRenew: next });
    setBusy(null);
    if (!ok) {
      setAutoRenew(!next); // revert
      toast.error(error?.message ?? "تغییر تمدید خودکار ممکن نشد.");
      return;
    }
    toast.success(next ? "تمدید خودکار فعال شد." : "تمدید خودکار غیرفعال شد.");
    router.refresh();
  }

  async function renew(method: "WALLET" | "ZARINPAL") {
    setBusy("renew");
    const { ok, data, error } = await patch({ action: "renewNow", method });
    if (!ok) {
      setBusy(null);
      toast.error(error?.message ?? "تمدید ممکن نشد.");
      return;
    }
    if (data?.redirectUrl) {
      // Gateway flow: hand off to the payment provider.
      window.location.href = data.redirectUrl as string;
      return;
    }
    setBusy(null);
    if (data?.paid) {
      toast.success("اشتراک با موفقیت تمدید شد.");
      router.refresh();
    } else {
      toast.info("صورتحساب تمدید ایجاد شد.");
      router.refresh();
    }
  }

  async function cancel() {
    if (!window.confirm("اشتراک در پایان دوره فعلی لغو می‌شود. ادامه می‌دهید؟")) {
      return;
    }
    setBusy("cancel");
    const { ok, error } = await patch({ action: "cancel" });
    setBusy(null);
    if (!ok) {
      toast.error(error?.message ?? "لغو اشتراک ممکن نشد.");
      return;
    }
    toast.success("اشتراک در پایان دوره لغو خواهد شد.");
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black">{subscription.titleFa}</h2>
            <StatusBadge label={status.label} tone={status.tone} />
            {subscription.cancelAtPeriodEnd ? (
              <StatusBadge label="لغو در پایان دوره" tone="warning" />
            ) : null}
          </div>
          <p className="mt-1 text-sm font-black">
            {formatToman(subscription.priceAmount)}
            <span className="text-xs font-bold text-muted-foreground"> / دوره</span>
          </p>
        </div>
        {subscription.productSlug ? (
          <a
            href={`/products/${subscription.productSlug}`}
            className="shrink-0 text-xs font-bold text-primary underline-offset-4 hover:underline"
          >
            مشاهده محصول
          </a>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 px-5 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">شروع دوره</dt>
          <dd className="mt-0.5 font-bold">{faDate(subscription.currentPeriodStart)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">پایان دوره</dt>
          <dd className="mt-0.5 font-bold">{faDate(subscription.currentPeriodEnd)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">تمدید بعدی</dt>
          <dd className="mt-0.5 font-bold">{faDate(subscription.nextBillingAt)}</dd>
        </div>
      </dl>

      {manageable ? (
        <div className="flex flex-col gap-3 px-5">
          <button
            type="button"
            role="switch"
            aria-checked={autoRenew}
            aria-label="تمدید خودکار"
            disabled={busy !== null}
            onClick={toggleAutoRenew}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-right transition disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold">تمدید خودکار</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                در پایان هر دوره به‌صورت خودکار تمدید شود.
              </span>
            </span>
            <span
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                autoRenew ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full bg-background shadow-sm transition-transform",
                  autoRenew ? "-translate-x-0.5" : "-translate-x-[22px]",
                )}
              />
            </span>
          </button>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => renew("WALLET")}
              className="gap-1.5"
            >
              <Wallet className={cn("size-3.5", busy === "renew" && "animate-pulse")} aria-hidden />
              تمدید با کیف پول
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => renew("ZARINPAL")}
              className="gap-1.5"
            >
              <CreditCard className="size-3.5" aria-hidden />
              تمدید آنلاین
            </Button>
            {!subscription.cancelAtPeriodEnd ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={cancel}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <X className={cn("size-3.5", busy === "cancel" && "animate-spin")} aria-hidden />
                لغو اشتراک
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {subscription.invoices.length > 0 ? (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowInvoices((prev) => !prev)}
            aria-expanded={showInvoices}
            className="flex w-full items-center justify-between px-5 py-3 text-sm font-bold transition hover:bg-muted/40"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="size-4 text-muted-foreground" aria-hidden />
              تاریخچه صورتحساب ({toFaNumber(subscription.invoices.length)})
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                showInvoices && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {showInvoices ? (
            <ul className="divide-y divide-border border-t border-border">
              {subscription.invoices.map((invoice) => {
                const meta = INVOICE_STATUS[invoice.status] ?? {
                  label: invoice.status,
                  tone: "muted" as StatusTone,
                };
                return (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold">
                        {faDate(invoice.periodStart)} — {faDate(invoice.periodEnd)}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {invoice.paidAt
                          ? `پرداخت: ${faDate(invoice.paidAt)}`
                          : `سررسید: ${faDate(invoice.dueAt)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-bold">{formatToman(invoice.amount)}</span>
                      <StatusBadge label={meta.label} tone={meta.tone} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
