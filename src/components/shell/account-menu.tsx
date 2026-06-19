"use client";

import { Popover } from "@base-ui/react/popover";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeSegmented } from "./theme-segmented";

const rowClass =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground";

/**
 * Account control. Guests get a login link; users get a hover-opening Popover
 * (account / admin / theme switch / logout). Click also toggles it (touch + a11y).
 */
export function AccountMenu({ user, className }: { user: CurrentUser | null; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!user) {
    return (
      <Link href="/login" aria-label="ورود" className={className}>
        <UserRound className="size-5" />
      </Link>
    );
  }

  const openNow = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 160);
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-label="حساب کاربری"
            className={className}
            onMouseEnter={openNow}
            onMouseLeave={closeSoon}
          />
        }
      >
        <UserRound className="size-5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={10} className="z-50">
          <Popover.Popup
            onMouseEnter={openNow}
            onMouseLeave={closeSoon}
            className="w-60 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          >
            <p className="px-2.5 py-1.5 text-xs text-muted-foreground" dir="ltr">
              {user.phone}
            </p>
            <Link href="/account" className={rowClass} onClick={() => setOpen(false)}>
              <UserRound className="size-4" />
              حساب کاربری
            </Link>
            {user.role === "ADMIN" ? (
              <Link href="/admin" className={rowClass} onClick={() => setOpen(false)}>
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

            <button type="button" onClick={logout} className={cn(rowClass)}>
              <LogOut className="size-4" />
              خروج
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
