"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { CurrentUser } from "@/lib/auth";
import { navFor } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { BottomBar } from "./bottom-bar";
import { NavDrawer } from "./nav-drawer";
import { TopAppBar } from "./top-app-bar";

/**
 * Role-aware application shell. Rendered once from the root layout, it owns the
 * persistent chrome (top app bar + navigation drawer + mobile bottom bar) and
 * the scrolling content area. The drawer is an overlay on mobile and a pinned
 * sidebar on lg+. Navigation adapts to persona and route via navFor().
 */
export function AppShell({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nav = navFor(user, pathname);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopAppBar user={user} onMenu={() => setDrawerOpen(true)} />
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <NavDrawer
          nav={nav}
          pathname={pathname}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          loggedIn={Boolean(user)}
        />
        <div
          className={cn(
            "min-w-0 flex-1 pb-24 lg:pb-10",
            nav.context === "admin" && "admin-light bg-zinc-50 px-3 py-4 text-zinc-950 sm:px-6",
          )}
        >
          {children}
        </div>
      </div>
      <BottomBar nav={nav} pathname={pathname} onMenu={() => setDrawerOpen(true)} />
    </div>
  );
}
