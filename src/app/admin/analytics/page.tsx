import {
  ActivityIcon,
  EyeIcon,
  SearchIcon,
  SearchXIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AdminAnalytics, type DateRange, getAdminAnalytics } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Range handling ─────────────────────────────────────────────────────────

const RANGES = [7, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];
const DEFAULT_RANGE: RangeDays = 30;

const RANGE_LABELS: Record<RangeDays, string> = {
  7: "۷ روز",
  30: "۳۰ روز",
  90: "۹۰ روز",
};

function parseRange(value: string | undefined): RangeDays {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : DEFAULT_RANGE;
}

/** A half-open window `[from, to)` covering the trailing `days` (incl. today). */
function computeRange(days: RangeDays): DateRange {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // end of today
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to };
}

const dayFormatter = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });

function formatDay(iso: string) {
  return dayFormatter.format(new Date(iso));
}

/** Pad the sparse daily buckets into a continuous series across the window. */
function fillDays(buckets: AdminAnalytics["viewsOverTime"], days: RangeDays) {
  const byDate = new Map(buckets.map((b) => [b.date, b.count]));
  const out: { date: string; count: number }[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (days - 1));

  for (let i = 0; i < days; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    out.push({ date: iso, count: byDate.get(iso) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login?redirect=/admin/analytics");
  }

  const { range: rangeParam } = await searchParams;
  const days = parseRange(rangeParam);
  const range = computeRange(days);

  const data = await getAdminAnalytics(range);
  const series = fillDays(data.viewsOverTime, days);

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">تحلیل و آمار</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            رفتار بازدیدکنندگان در {RANGE_LABELS[days]} گذشته
          </p>
        </div>
        <RangeSwitcher active={days} />
      </div>

      <KpiGrid overview={data.overview} />

      <ViewsChart series={series} days={days} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TopSearchesTable items={data.topSearches} />
        <ZeroResultTable items={data.zeroResultSearches} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopProductsTable items={data.topProducts} />
        <TopCategoriesTable items={data.topCategories} />
      </div>

      <FunnelCard funnel={data.funnel} />
    </div>
  );
}

// ─── Range switcher ──────────────────────────────────────────────────────────

function RangeSwitcher({ active }: { active: RangeDays }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {RANGES.map((days) => (
        <Link
          key={days}
          href={`/admin/analytics?range=${days}`}
          className={cn(
            "px-3 py-1.5 text-xs font-bold transition-colors",
            days === active
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {RANGE_LABELS[days]}
        </Link>
      ))}
    </div>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

function KpiGrid({ overview }: { overview: AdminAnalytics["overview"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="کل رویدادها"
        value={toFaNumber(overview.totalEvents)}
        icon={ActivityIcon}
        hint="مجموع رویدادهای ثبت‌شده"
      />
      <KpiCard
        title="بازدیدکنندگان یکتا"
        value={toFaNumber(overview.uniqueVisitors)}
        icon={UsersIcon}
        hint="بر اساس شناسه ناشناس"
      />
      <KpiCard
        title="جست‌وجوها"
        value={toFaNumber(overview.totalSearches)}
        icon={SearchIcon}
        hint="کل جست‌وجوهای انجام‌شده"
      />
      <KpiCard
        title="جست‌وجوی بدون نتیجه"
        value={toFaNumber(overview.zeroResultSearches)}
        icon={SearchXIcon}
        accent={overview.zeroResultSearches > 0 ? "warn" : undefined}
        hint="فرصت‌های ازدست‌رفته فروش"
      />
      <KpiCard
        title="بازدید محصول"
        value={toFaNumber(overview.productViews)}
        icon={EyeIcon}
        hint="نمایش صفحه محصولات"
      />
      <KpiCard
        title="بازدید دسته"
        value={toFaNumber(overview.categoryViews)}
        icon={EyeIcon}
        hint="نمایش صفحه دسته‌ها"
      />
      <KpiCard
        title="افزودن به سبد"
        value={toFaNumber(overview.addToCart)}
        icon={ShoppingCartIcon}
        hint="افزودن محصول به سبد خرید"
      />
      <KpiCard
        title="خریدها"
        value={toFaNumber(overview.purchases)}
        icon={TrendingUpIcon}
        hint="سفارش‌های نهایی‌شده"
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

// ─── Views over time (CSS bars) ──────────────────────────────────────────────

function ViewsChart({
  series,
  days,
}: {
  series: { date: string; count: number }[];
  days: RangeDays;
}) {
  const max = Math.max(1, ...series.map((d) => d.count));
  const total = series.reduce((sum, d) => sum + d.count, 0);
  // For 90-day windows the per-day label is too dense — thin it out.
  const labelEvery = days <= 7 ? 1 : days <= 30 ? 3 : 9;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-black">روند بازدید روزانه</CardTitle>
          <span className="text-xs text-muted-foreground">
            مجموع: <span className="font-bold">{toFaNumber(total)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            در این بازه هیچ بازدیدی ثبت نشده است.
          </p>
        ) : (
          <div className="flex h-44 items-end gap-px sm:gap-0.5" dir="ltr">
            {series.map((d, index) => (
              <div key={d.date} className="group flex h-full flex-1 flex-col justify-end">
                <div className="relative flex flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0)}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                </div>
                <span className="mt-1 h-3 truncate text-center text-[9px] text-muted-foreground">
                  {index % labelEvery === 0 ? formatDay(d.date) : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top searches ─────────────────────────────────────────────────────────────

function TopSearchesTable({ items }: { items: AdminAnalytics["topSearches"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          پرجست‌وجوترین عبارت‌ها
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="هنوز جست‌وجویی ثبت نشده است." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-right text-xs font-black text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-2">عبارت</th>
                <th className="p-2 text-left">دفعات</th>
                <th className="p-2 text-left">میانگین نتایج</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.query} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[16rem] truncate p-2 font-medium">{row.query}</td>
                  <td className="p-2 text-left font-bold tabular-nums">{toFaNumber(row.count)}</td>
                  <td className="p-2 text-left tabular-nums">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-bold",
                        row.avgResultCount === 0
                          ? "bg-red-100 text-red-800"
                          : "text-muted-foreground",
                      )}
                    >
                      {toFaNumber(row.avgResultCount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Zero-result searches ────────────────────────────────────────────────────

function ZeroResultTable({ items }: { items: AdminAnalytics["zeroResultSearches"] }) {
  return (
    <Card className={cn(items.length > 0 && "border-amber-300")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <SearchXIcon className="h-4 w-4 text-amber-600" />
          جست‌وجوهای بدون نتیجه
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            همه جست‌وجوها نتیجه داشته‌اند. 👌
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-amber-700">
              این عبارت‌ها مشتری داشته‌اند اما محصولی پیدا نشده — فرصت تکمیل کاتالوگ.
            </p>
            <ul className="divide-y divide-border">
              {items.map((row) => (
                <li key={row.query} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm font-medium">{row.query}</span>
                  <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 tabular-nums">
                    {toFaNumber(row.count)} بار
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top products ─────────────────────────────────────────────────────────────

function TopProductsTable({ items }: { items: AdminAnalytics["topProducts"] }) {
  const max = Math.max(1, ...items.map((i) => i.views));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <EyeIcon className="h-4 w-4 text-muted-foreground" />
          پربازدیدترین محصولات
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="هنوز بازدیدی ثبت نشده است." />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center gap-3">
                <Link
                  href={`/products/${item.slug}`}
                  className="w-40 shrink-0 truncate text-xs font-medium text-primary hover:underline"
                >
                  {item.titleFa}
                </Link>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/80"
                    style={{ width: `${(item.views / max) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-left text-xs font-bold tabular-nums">
                  {toFaNumber(item.views)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top categories ───────────────────────────────────────────────────────────

function TopCategoriesTable({ items }: { items: AdminAnalytics["topCategories"] }) {
  const max = Math.max(1, ...items.map((i) => i.views));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <EyeIcon className="h-4 w-4 text-muted-foreground" />
          پربازدیدترین دسته‌ها
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="هنوز بازدیدی ثبت نشده است." />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.categoryId} className="flex items-center gap-3">
                <Link
                  href={`/category/${item.slug}`}
                  className="w-40 shrink-0 truncate text-xs font-medium text-primary hover:underline"
                >
                  {item.titleFa}
                </Link>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/80"
                    style={{ width: `${(item.views / max) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-left text-xs font-bold tabular-nums">
                  {toFaNumber(item.views)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function FunnelCard({ funnel }: { funnel: AdminAnalytics["funnel"] }) {
  const steps = [
    { label: "بازدید محصول", value: funnel.productViews },
    { label: "افزودن به سبد", value: funnel.addToCart },
    { label: "خرید", value: funnel.purchases },
  ];
  const top = Math.max(1, funnel.productViews);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          قیف تبدیل
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {steps.map((step, index) => {
            const prev = index === 0 ? step.value : steps[index - 1].value;
            const stepRate = index === 0 ? 100 : percent(step.value, prev);
            return (
              <li key={step.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{step.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="flex h-full items-center rounded bg-primary/80 px-2"
                    style={{
                      width: `${Math.max(percent(step.value, top), step.value > 0 ? 6 : 0)}%`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-primary-foreground tabular-nums">
                      {toFaNumber(step.value)}
                    </span>
                  </div>
                </div>
                <span className="w-12 shrink-0 text-left text-xs font-bold tabular-nums text-muted-foreground">
                  {index === 0 ? "—" : `${toFaNumber(stepRate)}٪`}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function EmptyRow({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
