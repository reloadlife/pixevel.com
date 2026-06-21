import { Globe, Headset, RefreshCw, Server, ShieldCheck, Zap } from "lucide-react";
import type { Metadata } from "next";
import { isDomainDemo, isDomainSearchEnabled } from "@/lib/domains/spaceship";
import { formatToman } from "@/lib/format";
import { DomainSearchClient } from "./domain-search-client";
import { HeroTyper } from "./hero-typer";

export const metadata: Metadata = {
  title: "ثبت دامنه | پیکس‌ول",
  description:
    "نام دامنهٔ دلخواه خود را جستجو کنید، قیمت لحظه‌ای پسوندهای مختلف را ببینید و در چند ثانیه ثبت کنید — با فعال‌سازی آنی و مدیریت کامل DNS.",
  alternates: { canonical: "/domains" },
};

/**
 * Extension catalog grouped by buyer intent. Prices are representative starting
 * points (Toman/yr); the final price is shown live at search time.
 */
const TLD_GROUPS: {
  key: string;
  label: string;
  hint: string;
  tlds: { tld: string; fromToman: number; tag?: string }[];
}[] = [
  {
    key: "popular",
    label: "محبوب",
    hint: "انتخاب امن برای هر برند",
    tlds: [
      { tld: "com", fromToman: 1_007_000, tag: "پرفروش" },
      { tld: "net", fromToman: 1_175_000 },
      { tld: "org", fromToman: 1_090_000 },
      { tld: "co", fromToman: 2_351_000 },
    ],
  },
  {
    key: "tech",
    label: "فناوری و استارتاپ",
    hint: "برای محصولات دیجیتال و تیم‌های فنی",
    tlds: [
      { tld: "io", fromToman: 3_360_000, tag: "محبوب" },
      { tld: "dev", fromToman: 1_175_000 },
      { tld: "app", fromToman: 1_260_000 },
      { tld: "ai", fromToman: 6_500_000 },
      { tld: "tech", fromToman: 2_900_000 },
    ],
  },
  {
    key: "store",
    label: "فروشگاهی",
    hint: "برای فروش آنلاین و برندهای خرده‌فروشی",
    tlds: [
      { tld: "shop", fromToman: 250_000, tag: "ارزان" },
      { tld: "store", fromToman: 1_800_000 },
      { tld: "market", fromToman: 2_400_000 },
    ],
  },
  {
    key: "business",
    label: "کسب‌وکار",
    hint: "برای شرکت‌ها، آژانس‌ها و خدمات",
    tlds: [
      { tld: "biz", fromToman: 850_000 },
      { tld: "agency", fromToman: 1_900_000 },
      { tld: "online", fromToman: 350_000, tag: "ارزان" },
      { tld: "site", fromToman: 350_000 },
    ],
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "فعال‌سازی آنی",
    body: "دامنه بلافاصله پس از پرداخت روی حساب شما فعال می‌شود.",
  },
  {
    icon: Server,
    title: "پنل کامل DNS",
    body: "رکوردهای A، AAAA، CNAME، MX و TXT را خودت مدیریت کن.",
  },
  {
    icon: ShieldCheck,
    title: "قفل انتقال و WHOIS",
    body: "قفل انتقال و مدیریت اطلاعات WHOIS برای امنیت دامنه.",
  },
  {
    icon: RefreshCw,
    title: "تمدید و انتقال آسان",
    body: "تمدید سریع و انتقال با کد EPP، همه از حساب کاربری.",
  },
];

const FAQ = [
  {
    q: "ثبت دامنه چقدر طول می‌کشد؟",
    a: "دامنه‌ها معمولاً بلافاصله پس از پرداخت فعال می‌شوند و ظرف چند دقیقه در دسترس قرار می‌گیرند.",
  },
  {
    q: "می‌توانم بعداً نِیم‌سرورها را تغییر دهم؟",
    a: "بله. از بخش «دامنه‌های من» در حساب کاربری می‌توانید نِیم‌سرورها و رکوردهای DNS را هر زمان ویرایش کنید.",
  },
  {
    q: "می‌توانم دامنه‌ام را به جای دیگری منتقل کنم؟",
    a: "بله. از بخش «دامنه‌های من» در حساب کاربری می‌توانید کد انتقال (EPP) را دریافت و دامنه را منتقل کنید.",
  },
  {
    q: "DNS و رکوردها را چطور مدیریت کنم؟",
    a: "از حساب کاربری → دامنه‌های من → مدیریت، می‌توانید نِیم‌سرورها و رکوردهای DNS را آزادانه ویرایش کنید.",
  },
];

export default function DomainsPage() {
  const configured = isDomainSearchEnabled();
  const demo = isDomainDemo();

  return (
    <main className="bg-background text-foreground" dir="rtl">
      {/* ── Hero band: the registry counter ───────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-zinc-950 px-4 pb-28 pt-16 text-white sm:px-8 sm:pb-32 sm:pt-20">
        {/* gold glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[640px] max-w-full -translate-x-1/2 rounded-full bg-gold/20 blur-[130px]"
        />
        {/* dotted grid, faded toward edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
        />

        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-gold">
            <Globe className="size-3.5" aria-hidden />
            Pixevel Domains
          </span>
          <h1 className="mt-5 text-balance text-4xl font-black leading-[1.12] sm:text-6xl">
            دامنه‌ی خودت را <span className="text-gold">ثبت کن</span>
          </h1>

          {/* signature: live registry-console motif (cycling extension) */}
          <div className="mt-5 inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur-sm">
            <HeroTyper />
          </div>

          <p className="mx-auto mt-4 max-w-md text-sm text-zinc-400 sm:text-base">
            نام را بنویس، قیمت لحظه‌ای پسوندها را ببین و در چند ثانیه ثبت کن.
          </p>

          {/* trust row — gives the dark band substance */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-gold" aria-hidden />
              فعال‌سازی آنی
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Server className="size-3.5 text-gold" aria-hidden />
              مدیریت کامل DNS
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-3.5 text-gold" aria-hidden />
              +۱۶ پسوند
            </span>
          </div>
        </div>
      </section>

      {/* Search card straddles the hero's bottom edge. */}
      <div id="domain-search" className="relative z-10 mx-auto -mt-20 max-w-2xl scroll-mt-24 px-4">
        <DomainSearchClient configured={configured} demo={demo} />
      </div>

      {/* ── Extensions & pricing ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-8">
        <header className="mb-8">
          <h2 className="text-2xl font-black">پسوندها و قیمت‌ها</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            بر اساس نوع کسب‌وکار دسته‌بندی شده؛ قیمت شروع سالانه — مبلغ نهایی هنگام جست‌وجو نمایش داده
            می‌شود.
          </p>
        </header>

        <div className="space-y-10">
          {TLD_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="mb-4 flex items-baseline gap-3">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-gold">
                  {group.label}
                </h3>
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span className="text-xs text-muted-foreground">{group.hint}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.tlds.map(({ tld, fromToman, tag }) => (
                  <a
                    key={tld}
                    href="#domain-search"
                    className="group rounded-2xl border border-border bg-card p-4 transition hover:border-gold/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="font-mono text-2xl font-black tracking-tight text-foreground"
                        dir="ltr"
                      >
                        .{tld}
                      </p>
                      {tag ? (
                        <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">
                          {tag}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">از</p>
                    <p className="text-sm font-black">
                      {formatToman(fromToman)}
                      <span className="ms-1 text-xs font-medium text-muted-foreground">/ سال</span>
                    </p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why register here ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-8">
        <h2 className="mb-6 text-2xl font-black">چرا دامنه را از پیکس‌ول بگیرم؟</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-gold/10 text-gold">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-black">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:px-8">
        <h2 className="mb-6 text-2xl font-black">سوال‌های پرتکرار</h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between gap-3 font-bold marker:content-none">
                {q}
                <span className="text-muted-foreground transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Headset className="size-4" aria-hidden />
          سوال دیگری دارید؟{" "}
          <a href="/contact" className="font-bold text-foreground underline underline-offset-4">
            با ما در تماس باشید
          </a>
        </div>
      </section>
    </main>
  );
}
