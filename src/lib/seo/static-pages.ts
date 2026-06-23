/**
 * Catalog of indexable standalone/static routes managed by the SEO hub.
 *
 * These are the routes that historically exported a hardcoded `export const
 * metadata`. They are NOT backed by a catalog/blog entity, so their SEO lives in
 * the `PageSeo` table. This module is the single source of truth for:
 *
 *  - the seed/upsert that creates one `PageSeo` row per route (copying the
 *    current hardcoded title/description so the rendered head stays
 *    byte-identical until an operator edits it),
 *  - the static rows shown in the admin SEO hub,
 *  - the hardcoded fallback used by the resolver when a `PageSeo` row is missing.
 *
 * `/account/*` and `/checkout` are intentionally excluded — they are disallowed
 * in `robots.ts` and never indexed.
 */

export type StaticPageDef = {
  /** Stable route identifier and `PageSeo.pathKey`, e.g. "/", "/about". */
  pathKey: string;
  /** Human label for the admin list. */
  labelFa: string;
  /** Current hardcoded `<title>` (the page's own title, before the global template). */
  title: string;
  /** Current hardcoded meta description. */
  description: string;
  /** Default sitemap priority (0.0–1.0) for this route. */
  sitemapPriority: number;
  /** Default sitemap change frequency for this route. */
  sitemapChangefreq: SitemapChangefreq;
};

export type SitemapChangefreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export const SITEMAP_CHANGEFREQS: readonly SitemapChangefreq[] = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

/**
 * The indexable static routes. Titles/descriptions mirror the values that were
 * previously hardcoded in each page's `export const metadata` so the seed keeps
 * the rendered head identical. The home page (`/`) uses the site-wide default
 * title/description from the root layout.
 */
export const STATIC_PAGES: readonly StaticPageDef[] = [
  {
    pathKey: "/",
    labelFa: "صفحه اصلی",
    title: "پیسکول | فروشگاه آنلاین همه‌چیز",
    description:
      "پیسکول؛ فروشگاه آنلاین برای خرید کالای فیزیکی، محصولات دیجیتال، سرویس‌ها و اشتراک‌ها با تجربه‌ای سریع، امن و مدرن.",
    sitemapPriority: 1,
    sitemapChangefreq: "daily",
  },
  {
    pathKey: "/products",
    labelFa: "محصولات",
    title: "محصولات",
    description:
      "همه محصولات دیجیتال پیسکول؛ گیفت کارت، سی‌دی‌کی بازی و سرویس‌های آنلاین با تحویل آنی.",
    sitemapPriority: 0.9,
    sitemapChangefreq: "daily",
  },
  {
    pathKey: "/domains",
    labelFa: "ثبت دامنه",
    title: "ثبت دامنه | پیکس‌ول",
    description:
      "نام دامنهٔ دلخواه خود را جستجو کنید، قیمت لحظه‌ای پسوندهای مختلف را ببینید و در چند ثانیه ثبت کنید — با فعال‌سازی آنی و مدیریت کامل DNS.",
    sitemapPriority: 0.7,
    sitemapChangefreq: "weekly",
  },
  {
    pathKey: "/servers",
    labelFa: "سرور ابری و VPS",
    title: "سرور ابری و VPS | Pixevel",
    description:
      "سرورهای مجازی و ابری با تحویل سریع، آپ‌تایم بالا و پلن‌های ماهانه، سه‌ماهه و سالانه.",
    sitemapPriority: 0.7,
    sitemapChangefreq: "weekly",
  },
  {
    pathKey: "/blog",
    labelFa: "بلاگ",
    title: "بلاگ",
    description: "راهنماها و اخبار دنیای گیفت‌کارت، سی‌دی‌کی، دامنه و سرویس‌های دیجیتال در پیسکول.",
    sitemapPriority: 0.6,
    sitemapChangefreq: "daily",
  },
  {
    pathKey: "/faq",
    labelFa: "سوالات متداول",
    title: "سوالات متداول",
    description: "پاسخ پرتکرارترین سوال‌ها درباره خرید، تحویل و پرداخت در پیسکول.",
    sitemapPriority: 0.5,
    sitemapChangefreq: "monthly",
  },
  {
    pathKey: "/about",
    labelFa: "درباره ما",
    title: "درباره ما",
    description:
      "پیسکول، فروشگاه تخصصی محصولات دیجیتال: گیفت کارت، سی‌دی‌کی بازی و سرویس‌های آنلاین با تحویل آنی.",
    sitemapPriority: 0.4,
    sitemapChangefreq: "yearly",
  },
  {
    pathKey: "/contact",
    labelFa: "تماس با ما",
    title: "تماس با ما",
    description: "راه‌های ارتباط با پشتیبانی پیسکول: تلفن، ایمیل و تلگرام.",
    sitemapPriority: 0.4,
    sitemapChangefreq: "yearly",
  },
  {
    pathKey: "/support",
    labelFa: "پشتیبانی",
    title: "پشتیبانی",
    description: "مرکز پشتیبانی پیسکول؛ راهنمای خرید، رفع مشکل کد و راه‌های ارتباط با تیم پشتیبانی.",
    sitemapPriority: 0.4,
    sitemapChangefreq: "monthly",
  },
  {
    pathKey: "/refund",
    labelFa: "رویه بازگشت وجه",
    title: "رویه بازگشت وجه",
    description: "شرایط و رویه بازگشت وجه و تعویض کد در فروشگاه دیجیتال پیسکول.",
    sitemapPriority: 0.4,
    sitemapChangefreq: "yearly",
  },
  {
    pathKey: "/terms",
    labelFa: "قوانین و مقررات",
    title: "قوانین و مقررات",
    description: "قوانین و مقررات استفاده از فروشگاه دیجیتال پیسکول.",
    sitemapPriority: 0.3,
    sitemapChangefreq: "yearly",
  },
  {
    pathKey: "/privacy",
    labelFa: "حریم خصوصی",
    title: "حریم خصوصی",
    description: "سیاست حریم خصوصی پیسکول؛ نحوه جمع‌آوری، استفاده و محافظت از اطلاعات کاربران.",
    sitemapPriority: 0.3,
    sitemapChangefreq: "yearly",
  },
] as const;

const BY_PATH_KEY = new Map(STATIC_PAGES.map((p) => [p.pathKey, p]));

/** Looks up a static page definition by its route path. */
export function getStaticPage(pathKey: string): StaticPageDef | undefined {
  return BY_PATH_KEY.get(pathKey);
}

/** All managed static path keys (for membership checks). */
export const STATIC_PATH_KEYS: readonly string[] = STATIC_PAGES.map((p) => p.pathKey);
