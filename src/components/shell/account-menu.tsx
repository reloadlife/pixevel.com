"use client";

import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/auth";

/** Account control — a login link for guests, a menu (account / admin / logout) for users. */
export function AccountMenu({ user, className }: { user: CurrentUser | null; className?: string }) {
  const router = useRouter();

  if (!user) {
    return (
      <Link href="/login" aria-label="ورود" className={className}>
        <UserRound className="size-5" />
      </Link>
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" aria-label="حساب کاربری" className={className} />}
      >
        <UserRound className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRound className="size-4" />
          حساب کاربری
        </DropdownMenuItem>
        {user.role === "ADMIN" ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <LayoutDashboard className="size-4" />
            پنل مدیریت
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="size-4" />
          خروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
