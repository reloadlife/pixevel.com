import { Home, LayoutGrid, type LucideIcon, ShoppingBag, UserRound } from "lucide-react";

import type { CurrentUser } from "@/lib/auth";

export type Category = { id: string; slug: string; titleFa: string };

export type BottomTab = {
  key: "home" | "categories" | "basket" | "account";
  label: string;
  icon: LucideIcon;
  href?: string;
  exact?: boolean;
};

/** Mobile bottom-tab bar — Digikala-style: home, categories (opens sheet), basket, account. */
export function bottomTabs(user: CurrentUser | null): BottomTab[] {
  return [
    { key: "home", label: "خانه", icon: Home, href: "/", exact: true },
    { key: "categories", label: "دسته‌بندی", icon: LayoutGrid },
    { key: "basket", label: "سبد", icon: ShoppingBag, href: "/basket" },
    user
      ? { key: "account", label: "حساب", icon: UserRound, href: "/account" }
      : { key: "account", label: "ورود", icon: UserRound, href: "/login" },
  ];
}

export function isActivePath(href: string, pathname: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

/**
 * World categories that own a dedicated storefront instead of the generic
 * product listing. Keep in sync with the storefront routes under `src/app/*`.
 */
export const WORLD_ROUTES: Record<string, string> = {
  domains: "/domains",
  hosting: "/servers",
};

/**
 * Link target for a category slug: its dedicated storefront when it has one
 * (e.g. domains → /domains), otherwise its indexable category route
 * (`/category/<slug>`).
 */
export function categoryHref(slug: string): string {
  return WORLD_ROUTES[slug] ?? `/category/${slug}`;
}
