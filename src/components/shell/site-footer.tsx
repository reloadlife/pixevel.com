import { BadgeCheck, Headphones, Landmark, ShieldCheck, Wallet, Zap } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { type Category, categoryHref } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { NewsletterSignup } from "./newsletter-signup";

type IconType = ComponentType<{ className?: string }>;

type FooterLink = { href: string; label: string };

const accountLinks: FooterLink[] = [
  { href: "/account", label: "حساب کاربری" },
  { href: "/account", label: "سفارش‌های من" },
  { href: "/basket", label: "سبد خرید" },
  { href: "/login", label: "ورود / ثبت‌نام" },
];

const supportLinks: FooterLink[] = [
  { href: "/contact", label: "تماس با ما" },
  { href: "/faq", label: "سوال‌های پرتکرار" },
  { href: "/support", label: "پشتیبانی" },
  { href: "/blog", label: "بلاگ" },
  { href: "/about", label: "درباره پیسکول" },
];

const legalLinks: FooterLink[] = [
  { href: "/terms", label: "قوانین و مقررات" },
  { href: "/privacy", label: "حریم خصوصی" },
  { href: "/refund", label: "بازگشت وجه" },
];

const trustItems: { icon: IconType; label: string }[] = [
  { icon: Zap, label: "تحویل آنی کد" },
  { icon: ShieldCheck, label: "پرداخت امن بانکی" },
  { icon: Headphones, label: "پشتیبانی هر روز" },
  { icon: BadgeCheck, label: "ضمانت اصالت کد" },
];

// Trust / payment seals. eNamad + the gateways are placeholders — swap the
// icon tiles for the real eNamad embed and gateway logos when available.
const trustBadges: { icon: IconType; title: string; subtitle: string; href?: string }[] = [
  {
    icon: ShieldCheck,
    title: "نماد اعتماد الکترونیکی",
    subtitle: "ثبت‌شده در enamad",
    href: "https://enamad.ir",
  },
  { icon: Wallet, title: "زرین‌پال", subtitle: "درگاه پرداخت امن", href: "https://zarinpal.com" },
  { icon: Landmark, title: "شبکه شتاب", subtitle: "همه کارت‌های بانکی" },
];

// Brand glyphs (lucide lacks these); simple-icons paths on a 24×24 viewBox.
const BRAND_PATHS = {
  telegram:
    "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z",
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
} as const;

const socials: { label: string; href: string; path: string }[] = [
  { label: "تلگرام پیسکول", href: "https://t.me/pixevel", path: BRAND_PATHS.telegram },
  {
    label: "اینستاگرام پیسکول",
    href: "https://instagram.com/pixevel",
    path: BRAND_PATHS.instagram,
  },
  { label: "پیسکول در ایکس", href: "https://x.com/pixevel", path: BRAND_PATHS.x },
];

const year = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date());

function BrandGlyph({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function TrustBadge({
  icon: Icon,
  title,
  subtitle,
  href,
}: {
  icon: IconType;
  title: string;
  subtitle: string;
  href?: string;
}) {
  const base =
    "inline-flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-2.5";
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.06] text-foreground">
        <Icon className="size-[18px]" />
      </span>
      <span className="leading-tight">
        <span className="block text-xs font-black text-foreground">{title}</span>
        <span className="block text-[10px] text-muted-foreground">{subtitle}</span>
      </span>
    </>
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={title}
      className={cn(base, "transition-colors hover:border-foreground/40")}
    >
      {body}
    </a>
  ) : (
    <div className={base}>{body}</div>
  );
}

function FooterColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: FooterLink[];
  className?: string;
}) {
  return (
    <nav aria-label={title} className={className}>
      <h3 className="mb-3.5 text-xs font-black text-foreground">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={`${title}-${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Storefront footer — a distinct band that follows the light/dark theme (muted
 * surface, solid top border): a benefits trust strip, real category links, a
 * Telegram-bot CTA, trust / payment seals, and socials. Single typeface (Vazir)
 * with weight for hierarchy; the accent colour is reserved for the one real
 * action (the newsletter CTA). Storefront-only (never /admin). Bottom padding
 * clears the ~5rem mobile tab bar.
 */
export function SiteFooter({ categories = [] }: { categories?: Category[] }) {
  const categoryLinks: FooterLink[] = categories.length
    ? categories.slice(0, 5).map((c) => ({
        href: categoryHref(c.slug),
        label: c.titleFa,
      }))
    : [{ href: "/products", label: "همه محصولات" }];

  return (
    <footer className="relative border-t border-border bg-muted text-foreground" dir="rtl">
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:pb-10">
        {/* Benefits / trust strip */}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-border py-7 sm:grid-cols-4">
          {trustItems.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground/[0.06] text-foreground">
                <Icon className="size-4" />
              </span>
              <span className="text-xs font-bold text-foreground sm:text-[13px]">{label}</span>
            </li>
          ))}
        </ul>

        {/* Main */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-11 lg:grid-cols-12 lg:gap-10">
          <div className="col-span-2 lg:col-span-4">
            <Link href="/" className="inline-flex items-baseline gap-2" aria-label="پیسکول، خانه">
              <span className="text-xl font-black tracking-wide text-foreground">پیسکول</span>
              <span className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground">
                DIGITAL
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              کد بازی، گیفت‌کارت و اشتراک سرویس‌های دیجیتال — آنی، اصل، و با پشتیبانی واقعی.
            </p>
            <NewsletterSignup className="mt-6 max-w-sm" />

            {/* Telegram bot CTA */}
            <a
              href="https://t.me/PixevelBot"
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-5 inline-flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition-colors hover:border-foreground/40 focus-visible:border-foreground/40 focus-visible:outline-none"
            >
              <span className="text-foreground">
                <BrandGlyph path={BRAND_PATHS.telegram} />
              </span>
              <span className="font-bold text-foreground">خرید سریع از ربات تلگرام</span>
              <span className="text-xs font-bold text-muted-foreground" dir="ltr">
                @PixevelBot
              </span>
            </a>
          </div>

          <FooterColumn title="دسته‌بندی" links={categoryLinks} className="lg:col-span-2" />
          <FooterColumn title="حساب من" links={accountLinks} className="lg:col-span-2" />
          <FooterColumn title="پشتیبانی" links={supportLinks} className="lg:col-span-2" />
          <FooterColumn title="قوانین" links={legalLinks} className="lg:col-span-2" />
        </div>

        {/* Trust / payment seals */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border py-7">
          {trustBadges.map((badge) => (
            <TrustBadge key={badge.title} {...badge} />
          ))}
        </div>

        {/* Bottom bar: copyright + socials */}
        <div className="flex flex-col gap-4 border-t border-border py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              © {year} پیسکول · تمام حقوق این فروشگاه محفوظ است.
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              خرید مطمئن گیفت‌کارت، سی‌دی‌کی و اشتراک سرویس‌های دیجیتال در ایران.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {socials.map((social) => (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:border-foreground/40 focus-visible:text-foreground focus-visible:outline-none"
              >
                <BrandGlyph path={social.path} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
