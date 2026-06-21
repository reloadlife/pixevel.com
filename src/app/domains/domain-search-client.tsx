"use client";

import {
  ArrowLeftRight,
  Check,
  Layers,
  Loader2,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";

type DomainResult = {
  domainName: string;
  tld: string;
  available: boolean;
  premium: boolean;
  priceToman: number | null;
};

type SearchResponse = {
  ok: boolean;
  data?: { configured: boolean; years: number; results: DomainResult[] };
  error?: { code: string; message: string };
};

const POPULAR_TLDS = ["com", "net", "org", "io", "shop", "dev"];

type Tab = "single" | "bulk" | "transfer";

const TABS: { key: Tab; label: string; icon: typeof Search }[] = [
  { key: "single", label: "جستجو", icon: Search },
  { key: "bulk", label: "گروهی", icon: Layers },
  { key: "transfer", label: "انتقال", icon: ArrowLeftRight },
];

function bareName(value: string): string {
  const clean = value.trim().toLowerCase().replace(/\.+$/, "");
  const dot = clean.indexOf(".");
  return dot > 0 ? clean.slice(0, dot) : clean;
}

/** Ensures a search term is a full domain (defaults to .com when no TLD typed). */
function toDomain(value: string): string {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return clean.includes(".") ? clean : `${clean}.com`;
}

/** Name variations for the smart-suggestions row (checked for availability). */
function suggestionCandidates(sld: string): string[] {
  if (!sld) return [];
  const variations = [`get${sld}`, `${sld}hq`, `try${sld}`, `${sld}app`, `${sld}online`];
  const out = [`${sld}.io`, `${sld}.co`, ...variations.map((v) => `${v}.com`)];
  return [...new Set(out)].slice(0, 6);
}

/** Fetch availability+price for a single full domain via the shared search API. */
async function checkOne(domain: string, years: number): Promise<DomainResult | null> {
  try {
    const res = await fetch(`/api/domains/search?q=${encodeURIComponent(domain)}&years=${years}`, {
      cache: "no-store",
    });
    const payload = (await res.json()) as SearchResponse;
    return payload.ok ? (payload.data?.results.find((r) => r.domainName === domain) ?? null) : null;
  } catch {
    return null;
  }
}

export function DomainSearchClient({
  configured,
  demo = false,
}: {
  configured: boolean;
  demo?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("single");

  // single
  const [query, setQuery] = useState("");
  const [years, setYears] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [suggestions, setSuggestions] = useState<DomainResult[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // bulk
  const [bulkInput, setBulkInput] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<DomainResult[]>([]);

  // transfer
  const [transferDomain, setTransferDomain] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [transferring, setTransferring] = useState(false);

  const addToCart = useCallback(
    async (domainName: string) => {
      setAdding(domainName);
      try {
        const res = await fetch("/api/domains/add", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domainName, years }),
        });
        const payload = (await res.json()) as SearchResponse;
        if (payload.ok) {
          window.dispatchEvent(new CustomEvent("cart:changed"));
          toast.success(`${domainName} به سبد خرید اضافه شد.`);
        } else {
          toast.error(payload.error?.message ?? "افزودن به سبد ناموفق بود.");
        }
      } catch {
        toast.error("اتصال به سرویس برقرار نشد.");
      } finally {
        setAdding(null);
      }
    },
    [years],
  );

  const runSearch = useCallback(
    async (term?: string) => {
      const q = (term ?? query).trim();
      if (q.length < 2) {
        toast.error("حداقل دو حرف وارد کنید.");
        inputRef.current?.focus();
        return;
      }

      setLoading(true);
      setSearched(true);
      setSuggestions([]);
      try {
        const res = await fetch(`/api/domains/search?q=${encodeURIComponent(q)}&years=${years}`, {
          cache: "no-store",
        });
        const payload = (await res.json()) as SearchResponse;
        setResults(payload.ok && payload.data ? payload.data.results : []);
        if (!payload.ok) toast.error(payload.error?.message ?? "جستجو ناموفق بود.");
      } catch {
        setResults([]);
        toast.error("اتصال به سرویس برقرار نشد.");
      } finally {
        setLoading(false);
      }

      // Smart suggestions: check name variations, surface the available ones.
      const sld = bareName(q);
      const candidates = suggestionCandidates(sld);
      if (candidates.length > 0) {
        const checked = await Promise.all(candidates.map((c) => checkOne(c, years)));
        setSuggestions(checked.filter((r): r is DomainResult => !!r && r.available).slice(0, 4));
      }
    },
    [query, years],
  );

  const searchTld = useCallback(
    (tld: string) => {
      const sld = bareName(query);
      if (!sld) {
        inputRef.current?.focus();
        return;
      }
      const next = `${sld}.${tld}`;
      setQuery(next);
      runSearch(next);
    },
    [query, runSearch],
  );

  const runBulk = useCallback(async () => {
    const names = [
      ...new Set(
        bulkInput
          .split(/[\s,\n]+/)
          .map((n) => n.trim())
          .filter((n) => n.length >= 2)
          .map(toDomain),
      ),
    ].slice(0, 20);

    if (names.length === 0) {
      toast.error("حداقل یک نام دامنه وارد کنید.");
      return;
    }

    setBulkLoading(true);
    try {
      const checked = await Promise.all(names.map((n) => checkOne(n, years)));
      setBulkResults(checked.filter((r): r is DomainResult => !!r));
    } finally {
      setBulkLoading(false);
    }
  }, [bulkInput, years]);

  const runTransfer = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setTransferring(true);
      try {
        const res = await fetch("/api/domains/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domainName: transferDomain, authCode }),
        });
        const payload = (await res.json()) as { ok: boolean; error?: { message: string } };
        if (payload.ok) {
          toast.success("درخواست انتقال ثبت شد. به‌زودی پردازش می‌شود.");
          setTransferDomain("");
          setAuthCode("");
        } else {
          toast.error(payload.error?.message ?? "ثبت انتقال ناموفق بود.");
        }
      } catch {
        toast.error("اتصال به سرویس برقرار نشد.");
      } finally {
        setTransferring(false);
      }
    },
    [transferDomain, authCode],
  );

  if (!configured) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold/10 text-gold">
          <Search className="size-7" aria-hidden />
        </div>
        <h2 className="mt-5 text-2xl font-black">به‌زودی</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          ثبت دامنه به‌زودی در پیکس‌ول فعال می‌شود.
        </p>
      </div>
    );
  }

  const featured =
    results.find((r) => bareName(query) && r.domainName === query.trim().toLowerCase()) ??
    results.find((r) => r.tld === "com") ??
    null;
  const rest = featured ? results.filter((r) => r.domainName !== featured.domainName) : results;

  return (
    <div className="rounded-3xl border border-border bg-card p-3 shadow-2xl shadow-black/10 ring-1 ring-black/5 sm:p-4">
      {/* Tabs */}
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl py-2.5 text-sm font-black transition",
              tab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* ── Single search ─────────────────────────────────────────────────── */}
      {tab === "single" ? (
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
            className="space-y-2.5"
          >
            <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-muted/30 px-4 transition focus-within:border-gold/50 focus-within:bg-card focus-within:ring-4 focus-within:ring-gold/10">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                type="search"
                name="domain"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="yourname"
                className="w-full bg-transparent py-4 font-mono text-lg tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                dir="ltr"
                autoComplete="off"
              />
            </div>
            <div className="flex items-stretch gap-2">
              <label className="shrink-0">
                <span className="sr-only">مدت ثبت</span>
                <select
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="h-full cursor-pointer rounded-2xl border border-border bg-muted/30 px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gold/30"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((y) => (
                    <option key={y} value={y}>
                      {y} سال
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-12 flex-1 gap-2 text-base"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <Search className="size-5" aria-hidden />
                )}
                جستجوی دامنه
              </Button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">پیشنهاد سریع:</span>
            {POPULAR_TLDS.map((tld) => (
              <button
                key={tld}
                type="button"
                onClick={() => searchTld(tld)}
                className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs font-bold text-foreground/80 transition hover:border-gold/50 hover:text-foreground"
                dir="ltr"
              >
                .{tld}
              </button>
            ))}
          </div>

          {demo ? (
            <p className="mt-3 text-xs text-muted-foreground/70">
              حالت آزمایشی — نتایج و قیمت‌ها شبیه‌سازی شده‌اند.
            </p>
          ) : null}

          {loading || searched ? (
            <div className="mt-6">
              {loading ? (
                <ResultsSkeleton />
              ) : results.length === 0 ? (
                <EmptyResults />
              ) : (
                <div className="space-y-3">
                  {featured ? (
                    <DomainCard
                      result={featured}
                      featured
                      adding={adding === featured.domainName}
                      onAdd={() => addToCart(featured.domainName)}
                    />
                  ) : null}
                  {rest.map((r) => (
                    <DomainCard
                      key={r.domainName}
                      result={r}
                      adding={adding === r.domainName}
                      onAdd={() => addToCart(r.domainName)}
                    />
                  ))}
                </div>
              )}

              {!loading && suggestions.length > 0 ? (
                <div className="mt-6">
                  <p className="mb-3 flex items-center gap-1.5 text-sm font-black">
                    <Sparkles className="size-4 text-gold" aria-hidden />
                    پیشنهادهای جایگزین
                  </p>
                  <div className="space-y-2.5">
                    {suggestions.map((r) => (
                      <DomainCard
                        key={r.domainName}
                        result={r}
                        adding={adding === r.domainName}
                        onAdd={() => addToCart(r.domainName)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Bulk search ───────────────────────────────────────────────────── */}
      {tab === "bulk" ? (
        <div className="px-1">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            rows={4}
            dir="ltr"
            placeholder={"yourname\nmybrand.io\nanother.shop"}
            className="w-full rounded-2xl border border-border bg-muted/30 p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gold/50 focus:outline-none focus:ring-4 focus:ring-gold/10"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">هر دامنه در یک خط (تا ۲۰ مورد).</p>
            <Button type="button" onClick={runBulk} disabled={bulkLoading} className="gap-2">
              {bulkLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Layers className="size-4" aria-hidden />
              )}
              بررسی همه
            </Button>
          </div>

          {bulkLoading ? (
            <div className="mt-6">
              <ResultsSkeleton />
            </div>
          ) : bulkResults.length > 0 ? (
            <div className="mt-6 space-y-3">
              {bulkResults.map((r) => (
                <DomainCard
                  key={r.domainName}
                  result={r}
                  adding={adding === r.domainName}
                  onAdd={() => addToCart(r.domainName)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Transfer ──────────────────────────────────────────────────────── */}
      {tab === "transfer" ? (
        <form onSubmit={runTransfer} className="space-y-3 px-1">
          <p className="text-sm text-muted-foreground">
            دامنه‌ات را از ثبت‌کنندهٔ دیگری به پیکس‌ول منتقل کن. به کد انتقال (EPP/Auth Code) از پنل
            فعلی‌ات نیاز داری.
          </p>
          <div>
            <span className="mb-1.5 block text-sm font-bold">نام دامنه</span>
            <input
              value={transferDomain}
              onChange={(e) => setTransferDomain(e.target.value)}
              placeholder="yourname.com"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-3 font-mono text-sm focus:border-gold/50 focus:outline-none focus:ring-4 focus:ring-gold/10"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-bold">کد انتقال (EPP)</span>
            <input
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="Auth-Code"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-3 font-mono text-sm focus:border-gold/50 focus:outline-none focus:ring-4 focus:ring-gold/10"
            />
          </div>
          <Button type="submit" size="lg" disabled={transferring} className="w-full gap-2">
            {transferring ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowLeftRight className="size-4" aria-hidden />
            )}
            شروع انتقال
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-2xl border border-border bg-muted/40"
        />
      ))}
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <p className="text-sm font-bold">نتیجه‌ای پیدا نشد</p>
      <p className="mt-1 text-xs text-muted-foreground">یک نام دیگر را امتحان کنید.</p>
    </div>
  );
}

function DomainCard({
  result,
  adding,
  onAdd,
  featured = false,
}: {
  result: DomainResult;
  adding: boolean;
  onAdd: () => void;
  featured?: boolean;
}) {
  const available = result.available;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition sm:px-5",
        available
          ? "border-border bg-card hover:border-gold/40 hover:shadow-sm"
          : "border-border/50 bg-muted/20",
        featured && available && "border-gold/40 bg-gold/[0.04] ring-1 ring-gold/20",
      )}
    >
      <div className="min-w-0">
        {featured && available ? (
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">
            بهترین انتخاب
          </span>
        ) : null}
        <p
          className={cn(
            "truncate font-mono text-lg font-bold tracking-tight sm:text-xl",
            !available && "text-muted-foreground line-through decoration-1",
          )}
          dir="ltr"
        >
          {result.domainName}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          {available ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
              <Check className="size-3" aria-hidden />
              قابل ثبت
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-bold text-muted-foreground">
              قبلاً ثبت شده
            </span>
          )}
          {result.premium ? (
            <span className="inline-flex items-center rounded-full bg-gold/15 px-2 py-0.5 font-bold text-gold">
              ویژه
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {available && result.priceToman != null ? (
          <div className="text-end">
            <p className="font-black leading-none">{formatToman(result.priceToman)}</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">سالانه</p>
          </div>
        ) : null}

        {available ? (
          <Button
            type="button"
            size={featured ? "lg" : "default"}
            onClick={onAdd}
            disabled={adding}
            className="gap-2"
          >
            {adding ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ShoppingBag className="size-4" aria-hidden />
            )}
            افزودن
          </Button>
        ) : null}
      </div>
    </div>
  );
}
