"use client";

import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeSegmented } from "./theme-segmented";

const rowClass =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground";

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
      <div className="flex items-center gap-3 px-2.5 py-2">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-black text-foreground",
            user.isPremium && "ring-2 ring-gold ring-offset-2 ring-offset-popover",
          )}
        >
          {ini ?? <UserRound className="size-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
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
        ) : null}
      </div>

      <div className="my-1.5 border-t border-border" />

      <Link href="/account" className={rowClass} onClick={onNavigate}>
        <UserRound className="size-4" />
        حساب کاربری
      </Link>
      {user.role === "ADMIN" ? (
        <Link href="/admin" className={rowClass} onClick={onNavigate}>
          <LayoutDashboard className="size-4" />
          پنل مدیریت
        </Link>
      ) : null}

      <div className="my-1.5 border-t border-border" />
      <div className="px-1.5 pb-1.5">
        <p className="mb-1.5 px-1 text-xs font-bold text-muted-foreground">پوسته</p>
        <ThemeSegmented />
      </div>
      <div className="my-1.5 border-t border-border" />

      <button type="button" onClick={logout} className={rowClass}>
        <LogOut className="size-4" />
        خروج
      </button>
    </div>
  );
}
