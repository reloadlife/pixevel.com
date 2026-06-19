"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/shop/theme-toggle";
import { isActiveNav, type ShellNav } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function NavDrawer({
  nav,
  pathname,
  open,
  onClose,
  loggedIn,
}: {
  nav: ShellNav;
  pathname: string;
  open: boolean;
  onClose: () => void;
  loggedIn: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="بستن منو"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      ) : null}

      <aside
        aria-label="ناوبری اصلی"
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-border bg-background transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
          "lg:static lg:z-auto lg:w-60 lg:translate-x-0",
        )}
      >
        <div className="flex h-14 items-center px-5 lg:hidden">
          <span className="text-lg font-black text-gold">پیسکول</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {nav.context === "admin" ? (
            <p className="px-3 pb-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              پنل مدیریت
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {nav.items.map((item) => {
              const Icon = item.icon;
              const active = isActiveNav(item, pathname);
              return (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition",
                      active
                        ? "bg-muted text-gold"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <ThemeToggle className="grid size-9 place-items-center rounded-md text-foreground transition hover:bg-muted" />
          {loggedIn ? (
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
              خروج
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
