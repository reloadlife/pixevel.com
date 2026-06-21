"use client";

import Link from "next/link";
import { useState } from "react";

import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ServerPlanPeriod = {
  variantId: string;
  periodMonths: number;
  label: string;
  price: number;
  compareAtAmount: number;
  available: boolean;
};

export type ServerPlanView = {
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  status: string;
  cpu: number | null;
  ram: number | null;
  diskGb: number | null;
  periods: ServerPlanPeriod[];
};

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-black">{value}</p>
      </div>
    </div>
  );
}

export function PlanCard({ plan }: { plan: ServerPlanView }) {
  const defaultIndex = Math.max(
    0,
    plan.periods.findIndex((period) => period.available),
  );
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex === -1 ? 0 : defaultIndex);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = plan.periods[selectedIndex];
  const planDisabled = plan.status !== "ACTIVE";
  const canAdd = !planDisabled && selected?.available;

  async function addToCart() {
    if (!selected || !canAdd || adding) {
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selected.variantId, quantity: 1 }),
      });

      const json = (await response.json().catch(() => null)) as {
        ok: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !json?.ok) {
        setError(json?.error?.message ?? "افزودن به سبد ممکن نشد.");
        return;
      }

      window.dispatchEvent(new CustomEvent("cart:changed"));
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-card p-5 text-card-foreground shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black">{plan.titleFa}</h2>
          {plan.summaryFa ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{plan.summaryFa}</p>
          ) : null}
        </div>
        {planDisabled ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-black text-muted-foreground">
            غیرفعال
          </span>
        ) : null}
      </div>

      {/* Specs */}
      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/40 p-3.5">
        <SpecRow
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
            </svg>
          }
          label="پردازنده"
          value={plan.cpu != null ? `${plan.cpu} هسته` : "—"}
        />
        <SpecRow
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="7" width="18" height="10" rx="1" />
              <path d="M7 7v10M12 7v10M17 7v10M3 11h18" />
            </svg>
          }
          label="رم"
          value={plan.ram != null ? `${plan.ram} گیگابایت` : "—"}
        />
        <SpecRow
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M22 12A10 10 0 1 1 12 2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
          label="دیسک"
          value={plan.diskGb != null ? `${plan.diskGb} گیگابایت` : "—"}
        />
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {plan.periods.map((period, index) => {
          const active = index === selectedIndex;
          return (
            <button
              key={period.variantId}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-bold transition",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30",
                !period.available && "opacity-50",
              )}
            >
              {period.label}
            </button>
          );
        })}
      </div>

      {/* Price + add */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-1">
        <div>
          {selected?.compareAtAmount && selected.compareAtAmount > selected.price ? (
            <p className="text-xs text-muted-foreground line-through">
              {formatToman(selected.compareAtAmount)}
            </p>
          ) : null}
          <p className="text-xl font-black">{selected ? formatToman(selected.price) : "—"}</p>
          <p className="text-[11px] text-muted-foreground">برای {selected?.label ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addToCart}
          disabled={!canAdd || adding}
          className={cn(
            "flex-1 rounded-xl px-4 py-3 text-sm font-black transition",
            canAdd
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {!canAdd
            ? "ناموجود"
            : adding
              ? "در حال افزودن…"
              : added
                ? "افزوده شد ✓"
                : "افزودن به سبد"}
        </button>
        <Link
          href={`/products/${plan.slug}`}
          className="rounded-xl border border-border px-4 py-3 text-sm font-bold text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
        >
          جزئیات
        </Link>
      </div>

      {error ? <p className="text-xs font-bold text-destructive">{error}</p> : null}
    </div>
  );
}
