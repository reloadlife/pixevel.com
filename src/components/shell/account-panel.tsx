"use client";

import {
  ChevronLeft,
  Heart,
  KeyRound,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MapPin,
  Package,
  Settings,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeSegmented } from "./theme-segmented";

type Item = { href: string; label: string; icon: LucideIcon; accent?: boolean };

/** Digikala-style vertical list: icon → label → chevron. One accented row (wallet). */
const ITEMS: Item[] = [
  { href: "/account/orders", label: "سفارش‌های من", icon: Package },
  { href: "/account/keys", label: "کدها و لایسنس‌ها", icon: KeyRound },
  { href: "/account/wallet", label: "کیف پول", icon: Wallet, accent: true },
  { href: "/account/wishlist", label: "علاقه‌مندی‌ها", icon: Heart },
  { href: "/account/rewards", label: "باشگاه مشتریان", icon: Sparkles },
  { href: "/account/addresses", label: "آدرس‌ها", icon: MapPin },
  { href: "/account/settings", label: "تنظیمات", icon: Settings },
];

const rowClass =
  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground/80 transition hover:bg-muted hover:text-foreground";

/** Up to two initials from the user's name, for the avatar fallback. */
function initials(user: CurrentUser): string | null {
  const name = user.fullName?.trim();
  if (!name) return null;
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * Account dropdown content rendered inside the shared header popover. Owns the logout call.
 * `onNavigate` lets the parent close the popover when a row is chosen.
 */
export function AccountPanel({ user, onNavigate }: { user: CurrentUser; onNavigate?: () => void }) {
  const router = useRouter();
  const ini = initials(user);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onNavigate?.();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      {/* Profile header — tap to open the account dashboard */}
      <Link
        href="/account"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted"
      >
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-black text-foreground",
            user.isPremium && "ring-2 ring-gold ring-offset-2 ring-offset-popover",
          )}
        >
          {ini ?? <UserRound className="size-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-foreground">
            {user.fullName ?? "کاربر پیسکول"}
          </p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {user.phone}
          </p>
        </div>
        {user.isPremium ? (
          <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">
            VIP
          </span>
        ) : (
          <ChevronLeft className="size-4 shrink-0 text-muted-foreground/60" />
        )}
      </Link>

      <div className="my-1.5 border-t border-border" />

      {/* Section list */}
      <nav className="flex flex-col">
        {ITEMS.map(({ href, label, icon: Icon, accent }) => (
          <Link key={href} href={href} onClick={onNavigate} className={rowClass}>
            <Icon
              className={cn("size-[18px] shrink-0", accent ? "text-gold" : "text-muted-foreground")}
            />
            <span className="flex-1">{label}</span>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground/50" />
          </Link>
        ))}
      </nav>

      {user.role === "ADMIN" ? (
        <>
          <div className="my-1.5 border-t border-border" />
          <Link href="/admin" onClick={onNavigate} className={rowClass}>
            <LayoutDashboard className="size-[18px] shrink-0 text-muted-foreground" />
            <span className="flex-1">پنل مدیریت</span>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground/50" />
          </Link>
        </>
      ) : null}

      <div className="my-1.5 border-t border-border" />
      <div className="px-1.5 pb-1">
        <p className="mb-1.5 px-1 text-xs font-bold text-muted-foreground">پوسته</p>
        <ThemeSegmented />
      </div>
      <div className="my-1.5 border-t border-border" />

      <button
        type="button"
        onClick={logout}
        className={cn(rowClass, "text-red-600 hover:bg-red-500/10 hover:text-red-600")}
      >
        <LogOut className="size-[18px] shrink-0" />
        <span className="flex-1 text-right">خروج از حساب</span>
      </button>
    </div>
  );
}
