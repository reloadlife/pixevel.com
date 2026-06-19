"use client";

import { usePathname } from "next/navigation";

import type { CurrentUser } from "@/lib/auth";
import type { Category } from "@/lib/nav-items";
import { BottomTabs } from "./bottom-tabs";
import { SiteHeader } from "./site-header";

/**
 * Storefront application shell — a search-dominant header, a category browser,
 * and a mobile bottom-tab bar (Digikala/Torob pattern). Admin routes render
 * bare; src/app/admin/layout.tsx provides the admin sidebar chrome there.
 */
export function AppShell({
  user,
  categories,
  children,
}: {
  user: CurrentUser | null;
  categories: Category[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader user={user} categories={categories} />
      <main className="flex-1 pb-20 lg:pb-10">{children}</main>
      <BottomTabs user={user} categories={categories} />
    </div>
  );
}
