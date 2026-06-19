"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/shop/bottom-nav";
import { TopBar } from "@/components/shop/top-bar";
import type { CurrentUser } from "@/lib/auth";

/**
 * Site-wide navigation chrome (top bar + bottom nav).
 *
 * Rendered once from the root layout so navigation is present on every
 * storefront route without each page mounting it. The admin panel ships its
 * own dense operator navigation, so the storefront chrome is hidden there.
 */
export function SiteChrome({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <TopBar user={user} />
      <BottomNav user={user} />
    </>
  );
}
