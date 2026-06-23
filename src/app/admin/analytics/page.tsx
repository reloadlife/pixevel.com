import {
  ActivityIcon,
  ArrowLeftRightIcon,
  EyeIcon,
  FileTextIcon,
  GitBranchIcon,
  LogInIcon,
  LogOutIcon,
  MegaphoneIcon,
  RadioIcon,
  SearchIcon,
  SearchXIcon,
  ShoppingCartIcon,
  TimerIcon,
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ["overview", "pages", "sources", "flow", "funnel", "search"] as const;
type Tab = (typeof TABS)[number];
const DEFAULT_TAB: Tab = "overview";

const TAB_LABELS: Record<Tab, string> = {
  overview: "نمای کلی",
  pages: "صفحه‌ها",
  sources: "منابع ورود",
  flow: "مسیر حرکت",
  funnel: "قیف تبدیل",
  search: "جست‌وجو",
};

function parseTab(value: string | undefined): Tab {
  return (TABS as readonly string[]).includes(value ?? "") ? (value as Tab) : DEFAULT_TAB;
}

const dayFormatter = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });

function formatDay(iso: string) {
  return dayFormatter.format(new Date(iso));
}

/** Pad sparse daily buckets into a continuous series across the window. */
function fillDays(buckets: { date: string; count: number }[], days: RangeDays) {
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

/** Human-friendly duration (seconds → "۲ دقیقه ۵ ثانیه"). */
function formatDuration(totalSec: number): string {
  if (totalSec <= 0) return "۰ ثانیه";
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${toFaNumber(sec)} ثانیه`;
  if (sec === 0) return `${toFaNumber(min)} دقیقه`;
  return `${toFaNumber(min)} دقیقه ${toFaNumber(sec)} ثانیه`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; tab?: string }>;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login?redirect=/admin/analytics");
  }

  const { range: rangeParam, tab: tabParam } = await searchParams;
  const days = parseRange(rangeParam);
  const tab = parseTab(tabParam);
  const range = computeRange(days);

  const data = await getAdminAnalytics(range);
  const viewsSeries = fillDays(data.viewsOverTime, days);
  const pageViewsSeries = fillDays(data.pageViewsOverTime, days);

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">تحلیل و آمار</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            رفتار بازدیدکنندگان در {RANGE_LABELS[days]} گذشته
          </p>
        </div>
        <RangeSwitcher active={days} tab={tab} />
      </div>

      <TabBar active={tab} days={days} />

      {tab === "overview" && (
        <div className="space-y-6">
          <KpiGrid overview={data.overview} sessionKpis={data.sessionKpis} />
          <ViewsChart series={viewsSeries} days={days} />
          <FunnelCard funnel={data.funnel} />
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-6">
          <PageViewsChart series={pageViewsSeries} days={days} />
          <TopPagesTable items={data.topPages} />
        </div>
      )}

      {tab === "sources" && (
        <div className="space-y-6">
          <TrafficSourcesCard items={data.trafficSources} />
          <div className="grid gap-6 lg:grid-cols-2">
            <TopReferrersTable items={data.topReferrers} />
            <TopCampaignsTable items={data.topCampaigns} />
          </div>
        </div>
      )}

      {tab === "flow" && (
        <div className="space-y-6">
          <TransitionsTable items={data.behaviorFlow.transitions} />
          <div className="grid gap-6 lg:grid-cols-2">
            <EdgePagesTable
              title="صفحه‌های ورود"
              icon={LogInIcon}
              items={data.behaviorFlow.entryPages}
            />
            <EdgePagesTable
              title="صفحه‌های خروج"
              icon={LogOutIcon}
              items={data.behaviorFlow.exitPages}
            />
          </div>
        </div>
      )}

      {tab === "funnel" && (
        <div className="space-y-6">
          <FunnelCard funnel={data.funnel} />
          <SearchConversionCard conversion={data.searchConversion} />
        </div>
      )}

      {tab === "search" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <TopSearchesTable items={data.topSearches} />
          <ZeroResultTable items={data.zeroResultSearches} />
        </div>
      )}
    </div>
  );
}

// ─── Range switcher ──────────────────────────────────────────────────────────

function RangeSwitcher({ active, tab }: { active: RangeDays; tab: Tab }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {RANGES.map((days) => (
        <Link
          key={days}
          href={`/admin/analytics?tab=${tab}&range=${days}`}
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

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, days }: { active: Tab; days: RangeDays }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
      {TABS.map((t) => (
        <Link
          key={t}
          href={`/admin/analytics?tab=${t}&range=${days}`}
          role="tab"
          aria-selected={t === active}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-bold transition-colors",
            t === active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {TAB_LABELS[t]}
        </Link>
      ))}
    </div>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

function KpiGrid({
  overview,
  sessionKpis,
}: {
  overview: AdminAnalytics["overview"];
  sessionKpis: AdminAnalytics["sessionKpis"];
}) {
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
        title="بازدیدها (نشست)"
        value={toFaNumber(sessionKpis.sessions)}
        icon={RadioIcon}
        hint="نشست‌های ثبت‌شده در بازه"
      />
      <KpiCard
        title="صفحه در هر نشست"
        value={toFaNumber(sessionKpis.pagesPerSession)}
        icon={FileTextIcon}
        hint="میانگین صفحه‌های هر نشست"
      />
      <KpiCard
        title="میانگین مدت نشست"
        value={formatDuration(sessionKpis.avgDurationSec)}
        icon={TimerIcon}
        hint="فاصله اولین تا آخرین رویداد"
      />
      <KpiCard
        title="نرخ پرش"
        value={`${toFaNumber(sessionKpis.bounceRate)}٪`}
        icon={TrendingUpIcon}
        accent={sessionKpis.bounceRate >= 70 ? "warn" : undefined}
        hint="نشست‌های تک‌صفحه‌ای"
      />
      <KpiCard
        title="جست‌وجوها"
        value={toFaNumber(overview.totalSearches)}
        icon={SearchIcon}
        hint="کل جست‌وجوهای انجام‌شده"
      />
      <KpiCard
        title="خریدها"
        value={toFaNumber(overview.purchases)}
        icon={ShoppingCartIcon}
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

function BarChart({
  title,
  series,
  days,
}: {
  title: string;
  series: { date: string; count: number }[];
  days: RangeDays;
}) {
  const max = Math.max(1, ...series.map((d) => d.count));
  const total = series.reduce((sum, d) => sum + d.count, 0);
  const labelEvery = days <= 7 ? 1 : days <= 30 ? 3 : 9;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-black">{title}</CardTitle>
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

function ViewsChart({
  series,
  days,
}: {
  series: { date: string; count: number }[];
  days: RangeDays;
}) {
  return <BarChart title="روند بازدید روزانه" series={series} days={days} />;
}

function PageViewsChart({
  series,
  days,
}: {
  series: { date: string; count: number }[];
  days: RangeDays;
}) {
  return <BarChart title="روند نمایش صفحه‌ها" series={series} days={days} />;
}

// ─── Top pages ────────────────────────────────────────────────────────────────

function TopPagesTable({ items }: { items: AdminAnalytics["topPages"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <FileTextIcon className="h-4 w-4 text-muted-foreground" />
          پربازدیدترین صفحه‌ها
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="هنوز نمایش صفحه‌ای ثبت نشده است." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-right text-xs font-black text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-2">مسیر</th>
                <th className="p-2 text-left">بازدید</th>
                <th className="p-2 text-left">بازدیدکننده یکتا</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.path} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[20rem] truncate p-2 font-medium" dir="ltr">
                    {row.path}
                  </td>
                  <td className="p-2 text-left font-bold tabular-nums">{toFaNumber(row.views)}</td>
                  <td className="p-2 text-left tabular-nums text-muted-foreground">
                    {toFaNumber(row.uniqueVisitors)}
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

// ─── Traffic sources ──────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  Direct: "مستقیم",
  Search: "موتور جست‌وجو",
  Social: "شبکه‌های اجتماعی",
  Referral: "ارجاع از سایت دیگر",
  Campaign: "کمپین (UTM)",
};

function TrafficSourcesCard({ items }: { items: AdminAnalytics["trafficSources"] }) {
  const max = Math.max(1, ...items.map((i) => i.sessions));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <RadioIcon className="h-4 w-4 text-muted-foreground" />
          منابع ورود ترافیک
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="هنوز منبع ورودی ثبت نشده است." />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.source} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-xs font-medium">
                  {SOURCE_LABELS[item.source] ?? item.source}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/80"
                    style={{ width: `${(item.sessions / max) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-left text-xs font-bold tabular-nums">
                  {toFaNumber(item.sessions)} نشست
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopReferrersTable({ items }: { items: AdminAnalytics["topReferrers"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <ArrowLeftRightIcon className="h-4 w-4 text-muted-foreground" />
          ارجاع‌دهنده‌های برتر
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="ارجاعی از سایت دیگری ثبت نشده است." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((row) => (
              <li key={row.host} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm font-medium" dir="ltr">
                  {row.host}
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                  {toFaNumber(row.sessions)} نشست
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopCampaignsTable({ items }: { items: AdminAnalytics["topCampaigns"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <MegaphoneIcon className="h-4 w-4 text-muted-foreground" />
          کمپین‌های برتر
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="هنوز کمپین UTM ثبت نشده است." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((row) => (
              <li key={row.campaign} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm font-medium">{row.campaign}</span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                  {toFaNumber(row.sessions)} نشست
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Behavior flow ────────────────────────────────────────────────────────────

function TransitionsTable({ items }: { items: AdminAnalytics["behaviorFlow"]["transitions"] }) {
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <GitBranchIcon className="h-4 w-4 text-muted-foreground" />
          مسیر حرکت کاربر (صفحه به صفحه)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="هنوز مسیری بین صفحه‌ها ثبت نشده است." />
        ) : (
          <ul className="space-y-2">
            {items.map((row) => (
              <li key={`${row.from}→${row.to}`} className="flex items-center gap-2 text-xs">
                <span className="flex min-w-0 flex-1 items-center gap-1.5" dir="ltr">
                  <span className="max-w-[40%] truncate font-medium">{row.from}</span>
                  <ArrowLeftRightIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="max-w-[40%] truncate font-medium">{row.to}</span>
                </span>
                <div className="hidden h-2 w-24 overflow-hidden rounded bg-muted sm:block">
                  <div
                    className="h-full rounded bg-primary/80"
                    style={{ width: `${(row.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-left font-bold tabular-nums">
                  {toFaNumber(row.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EdgePagesTable({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: AdminAnalytics["behaviorFlow"]["entryPages"];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow text="داده‌ای ثبت نشده است." />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.path} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-xs font-medium" dir="ltr">
                  {item.path}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/80"
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-left text-xs font-bold tabular-nums">
                  {toFaNumber(item.count)}
                </span>
              </li>
            ))}
          </ul>
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

// ─── Funnel ───────────────────────────────────────────────────────────────────

function FunnelCard({ funnel }: { funnel: AdminAnalytics["funnel"] }) {
  const steps = [
    { label: "بازدید محصول", value: funnel.productViews },
    { label: "افزودن به سبد", value: funnel.addToCart },
    { label: "شروع پرداخت", value: funnel.checkoutStarts },
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

// ─── Search → conversion ──────────────────────────────────────────────────────

function SearchConversionCard({ conversion }: { conversion: AdminAnalytics["searchConversion"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-black">
          <EyeIcon className="h-4 w-4 text-muted-foreground" />
          تبدیل جست‌وجو به خرید
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums">
              {toFaNumber(conversion.searchSessions)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">نشست با جست‌وجو</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums">
              {toFaNumber(conversion.convertedSessions)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">منجر به خرید</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums text-primary">
              {toFaNumber(conversion.conversionRate)}٪
            </p>
            <p className="mt-1 text-xs text-muted-foreground">نرخ تبدیل</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function EmptyRow({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
