"use client";

import {
  Bell,
  CreditCard,
  Gift,
  Globe,
  Heart,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  MapPin,
  Server,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true, only an exact pathname match counts as active (used for the dashboard root). */
  exact?: boolean;
};

const ITEMS: NavItem[] = [
  { href: "/account", label: "داشبورد", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "سفارش‌ها", icon: ShoppingBag },
  { href: "/account/payments", label: "پرداخت‌ها", icon: CreditCard },
  { href: "/account/keys", label: "کلیدها/کدها", icon: KeyRound },
  { href: "/account/wishlist", label: "علاقه‌مندی‌ها", icon: Heart },
  { href: "/account/addresses", label: "آدرس‌ها", icon: MapPin },
  { href: "/account/wallet", label: "کیف پول", icon: Wallet },
  { href: "/account/rewards", label: "باشگاه مشتریان", icon: Gift },
  { href: "/account/referrals", label: "معرفی دوستان", icon: Users },
  { href: "/account/reviews", label: "دیدگاه‌ها", icon: Star },
  { href: "/account/notifications", label: "اعلان‌ها", icon: Bell },
  { href: "/account/settings", label: "تنظیمات", icon: Settings },
  { href: "/account/security", label: "امنیت", icon: ShieldCheck },
  { href: "/account/domains", label: "دامنه‌ها", icon: Globe },
  { href: "/account/servers", label: "سرورها", icon: Server },
  { href: "/account/support", label: "پشتیبانی", icon: LifeBuoy },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Shared account-area navigation.
 * - Mobile: horizontally scrollable pill bar.
 * - `lg:` and up: a sticky vertical sidebar list.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="منوی حساب کاربری">
      {/* Mobile: scrollable pill bar */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max items-center gap-2">
          {ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground/70 hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop: vertical sidebar list */}
      <ul className="hidden flex-col gap-1 lg:flex">
        {ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
