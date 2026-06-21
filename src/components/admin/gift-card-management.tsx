"use client";

import { CheckIcon, CopyIcon, GiftIcon, Loader2, PowerIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatToman, toFaNumber } from "@/lib/format";

type GiftCardStatus = "ACTIVE" | "REDEEMED" | "DISABLED" | "EXPIRED";

type GiftCard = {
  id: string;
  code: string;
  initialAmount: string;
  balanceAmount: string;
  currency: string;
  status: GiftCardStatus;
  issuedToUserId: string | null;
  redeemedByUserId: string | null;
  redeemedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type StatusCounts = Record<GiftCardStatus, number>;

type GenerateForm = {
  count: string;
  amount: string;
  currency: string;
  expiresAt: string;
};

const EMPTY_FORM: GenerateForm = {
  count: "10",
  amount: "",
  currency: "IRR",
  expiresAt: "",
};

const STATUS_META: Record<
  GiftCardStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACTIVE: { label: "فعال", variant: "default" },
  REDEEMED: { label: "استفاده‌شده", variant: "secondary" },
  DISABLED: { label: "غیرفعال", variant: "outline" },
  EXPIRED: { label: "منقضی", variant: "destructive" },
};

const FILTERS: { value: GiftCardStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "ACTIVE", label: "فعال" },
  { value: "REDEEMED", label: "استفاده‌شده" },
  { value: "DISABLED", label: "غیرفعال" },
  { value: "EXPIRED", label: "منقضی" },
];

const FA_DATE = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : FA_DATE.format(date);
}

/** `datetime-local` value → ISO string (or undefined when empty). */
function fromLocalInput(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function GiftCardManagement({
  initialGiftCards,
  initialPage,
  initialTotalPages,
  initialTotal,
  initialCounts,
}: {
  initialGiftCards: GiftCard[];
  initialPage: number;
  initialTotalPages: number;
  initialTotal: number;
  initialCounts: StatusCounts;
}) {
  const [cards, setCards] = useState(initialGiftCards);
  const [counts, setCounts] = useState(initialCounts);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [total, setTotal] = useState(initialTotal);
  const [statusFilter, setStatusFilter] = useState<GiftCardStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState<GenerateForm>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GiftCard[]>([]);

  // Skip the very first run: the initial list is already server-rendered.
  const firstRender = useRef(true);

  const load = useCallback(async (nextPage: number, status: GiftCardStatus | "ALL", q: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    if (status !== "ALL") {
      params.set("status", status);
    }
    if (q.trim()) {
      params.set("q", q.trim());
    }
    try {
      const response = await fetch(`/api/admin/gift-cards?${params.toString()}`);
      const result = await response.json();
      if (!result.ok) {
        toast.error(result.error?.message ?? "دریافت کارت‌های هدیه ناموفق بود.");
        return;
      }
      setCards(result.data.giftCards);
      setPage(result.data.page);
      setTotalPages(result.data.totalPages);
      setTotal(result.data.total);
      setCounts(result.data.counts);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when the status filter changes (resets to page 1). We deliberately
  // do NOT depend on `search`/`load` here — search is applied via the form, and
  // re-running on every keystroke is not wanted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filter-only re-fetch is intentional.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    load(1, statusFilter, search);
  }, [statusFilter]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    load(1, statusFilter, search);
  }

  async function generate() {
    const count = Number(form.count);
    const amount = Number(form.amount);
    if (!Number.isInteger(count) || count < 1 || count > 1000) {
      toast.error("تعداد باید عددی بین ۱ تا ۱۰۰۰ باشد.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("مبلغ باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/admin/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          amount,
          currency: form.currency.trim() || undefined,
          expiresAt: fromLocalInput(form.expiresAt),
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        toast.error(result.error?.message ?? "تولید کارت‌های هدیه ناموفق بود.");
        return;
      }
      setGenerated(result.data.giftCards);
      setForm((prev) => ({ ...EMPTY_FORM, count: prev.count, currency: prev.currency }));
      toast.success(`${toFaNumber(result.data.giftCards.length)} کارت هدیه ساخته شد.`);
      // Refresh the list/counts so the new cards appear.
      await load(1, statusFilter, "");
      setSearch("");
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(card: GiftCard, status: "ACTIVE" | "DISABLED") {
    setBusyId(card.id);
    try {
      const response = await fetch(`/api/admin/gift-cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!result.ok) {
        toast.error(result.error?.message ?? "تغییر وضعیت انجام نشد.");
        return;
      }
      toast.success(status === "DISABLED" ? "کارت هدیه غیرفعال شد." : "کارت هدیه فعال شد.");
      await load(page, statusFilter, search);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">کارت‌های هدیه</h1>
          <p className="mt-1 text-sm text-muted-foreground">{toFaNumber(total)} کارت ثبت‌شده</p>
        </div>
      </div>

      {/* ── Generate form ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-black">تولید کارت هدیه</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="تعداد کارت">
            <input
              value={form.count}
              onChange={(event) => setForm({ ...form, count: event.target.value })}
              inputMode="numeric"
              dir="ltr"
              placeholder="10"
              className={fieldClass}
            />
          </Field>
          <Field label="مبلغ هر کارت (تومان)">
            <input
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              inputMode="numeric"
              dir="ltr"
              placeholder="500000"
              className={fieldClass}
            />
          </Field>
          <Field label="واحد پول" hint="پیش‌فرض IRR">
            <input
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
              dir="ltr"
              placeholder="IRR"
              className={fieldClass}
            />
          </Field>
          <Field label="تاریخ انقضا" hint="اختیاری">
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
              dir="ltr"
              className={fieldClass}
            />
          </Field>
        </div>
        <Button className="mt-4 font-black" onClick={generate} disabled={generating}>
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GiftIcon className="size-4" />
          )}
          تولید کارت‌ها
        </Button>

        {generated.length > 0 && (
          <GeneratedCodes cards={generated} onDismiss={() => setGenerated([])} />
        )}
      </section>

      {/* ── Filters + search ────────────────────────────────────── */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value;
            const badgeCount =
              filter.value === "ALL" ? total : (counts[filter.value as GiftCardStatus] ?? 0);
            return (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
                <span className="text-xs opacity-70">({toFaNumber(badgeCount)})</span>
              </Button>
            );
          })}
        </div>

        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی کد..."
              dir="ltr"
              className={`${fieldClass} ps-9 w-56`}
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SearchIcon className="size-4" />
            )}
            جستجو
          </Button>
        </form>
      </section>

      {/* ── Table ───────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:p-3 [&>th]:text-start [&>th]:font-bold">
                <th>کد</th>
                <th>مبلغ اولیه</th>
                <th>مانده</th>
                <th>وضعیت</th>
                <th>استفاده‌شده توسط</th>
                <th>انقضا</th>
                <th className="text-end">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    کارت هدیه‌ای یافت نشد.
                  </td>
                </tr>
              ) : (
                cards.map((card) => {
                  const meta = STATUS_META[card.status];
                  const isBusy = busyId === card.id;
                  return (
                    <tr key={card.id} className="[&>td]:p-3 [&>td]:align-top">
                      <td>
                        <span className="font-mono font-bold" dir="ltr">
                          {card.code}
                        </span>
                      </td>
                      <td className="font-bold">{formatToman(card.initialAmount)}</td>
                      <td className="text-muted-foreground">{formatToman(card.balanceAmount)}</td>
                      <td>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        <div dir="ltr">{card.redeemedByUserId ?? "—"}</div>
                        {card.redeemedAt && <div>{formatDate(card.redeemedAt)}</div>}
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {formatDate(card.expiresAt)}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {card.status === "ACTIVE" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={isBusy}
                              onClick={() => setStatus(card, "DISABLED")}
                            >
                              {isBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <PowerIcon className="size-3.5" />
                              )}
                              غیرفعال
                            </Button>
                          )}
                          {card.status === "DISABLED" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => setStatus(card, "ACTIVE")}
                            >
                              {isBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <PowerIcon className="size-3.5" />
                              )}
                              فعال‌سازی
                            </Button>
                          )}
                          {(card.status === "REDEEMED" || card.status === "EXPIRED") && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => load(page - 1, statusFilter, search)}
            >
              قبلی
            </Button>
            <span className="text-xs text-muted-foreground">
              صفحه {toFaNumber(page)} از {toFaNumber(totalPages)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => load(page + 1, statusFilter, search)}
            >
              بعدی
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

/** One-time display of freshly generated codes for copying. */
function GeneratedCodes({ cards, onDismiss }: { cards: GiftCard[]; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const text = cards.map((card) => card.code).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("کدها کپی شد.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی ناموفق بود.");
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">
          {toFaNumber(cards.length)} کد جدید — این کدها فقط همین یک‌بار نمایش داده می‌شوند.
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copyAll}>
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            کپی همه
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            بستن
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" dir="ltr">
        {cards.map((card) => (
          <code
            key={card.id}
            className="rounded-lg bg-background px-2.5 py-1.5 text-xs font-bold text-foreground"
          >
            {card.code}
          </code>
        ))}
      </div>
    </div>
  );
}

const fieldClass =
  "h-10 w-full rounded-2xl border border-border bg-input/50 px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">({hint})</span>}
      </span>
      {children}
    </div>
  );
}
