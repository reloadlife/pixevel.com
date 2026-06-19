import {
  FolderTree,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PackagePlus,
  ScrollText,
  ShoppingBag,
  Store,
  Tags,
  UserRound,
  Users,
} from "lucide-react";

import type { CurrentUser } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type NavContext = "shop" | "admin";

export type ShellNav = {
  context: NavContext;
  items: NavItem[];
  bottomBar: NavItem[];
};

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "محصولات", icon: Package },
  { href: "/admin/products/new", label: "افزودن محصول", icon: PackagePlus, exact: true },
  { href: "/admin/categories", label: "دسته‌ها", icon: FolderTree },
  { href: "/admin/tags", label: "تگ‌ها", icon: Tags },
  { href: "/admin/homepage", label: "صفحه خانه", icon: Home },
  { href: "/admin/watermarks", label: "واترمارک‌ها", icon: ImageIcon },
  { href: "/admin/orders", label: "سفارش‌ها", icon: ScrollText },
  { href: "/admin/users", label: "کاربران", icon: Users },
  { href: "/", label: "مشاهده سایت", icon: Store, exact: true },
];

const ADMIN_BOTTOM: NavItem[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "محصولات", icon: Package },
  { href: "/admin/orders", label: "سفارش‌ها", icon: ScrollText },
  { href: "/", label: "سایت", icon: Store, exact: true },
];

/**
 * Single source of truth for the application shell navigation.
 * Adapts to persona (guest / customer / admin) and route context.
 */
export function navFor(user: CurrentUser | null, pathname: string): ShellNav {
  const isAdmin = user?.role === "ADMIN";

  if (isAdmin && pathname.startsWith("/admin")) {
    return { context: "admin", items: ADMIN_ITEMS, bottomBar: ADMIN_BOTTOM };
  }

  const account: NavItem = user
    ? { href: "/account", label: "حساب", icon: UserRound }
    : { href: "/login", label: "ورود", icon: UserRound };

  const items: NavItem[] = [
    { href: "/", label: "خانه", icon: Home, exact: true },
    { href: "/products", label: "فروشگاه", icon: Store },
    { href: "/basket", label: "سبد خرید", icon: ShoppingBag },
    account,
  ];
  if (isAdmin) {
    items.push({ href: "/admin", label: "مدیریت", icon: LayoutDashboard });
  }

  const bottomBar: NavItem[] = [
    { href: "/", label: "خانه", icon: Home, exact: true },
    { href: "/products", label: "فروشگاه", icon: Store },
    { href: "/basket", label: "سبد", icon: ShoppingBag },
    account,
  ];

  return { context: "shop", items, bottomBar };
}

export function isActiveNav(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
