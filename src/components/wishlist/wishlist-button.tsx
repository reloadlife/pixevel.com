"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WishlistButtonProps = {
  productId: string;
  /** Initial wishlist state, usually resolved on the server. */
  initial?: boolean;
  /**
   * "icon" → compact heart toggle (product cards, galleries).
   * "full" → heart + label, used in detail pages.
   */
  variant?: "icon" | "full";
  className?: string;
  /** Optional callback fired after a successful toggle (e.g. to refetch a list). */
  onChange?: (wishlisted: boolean) => void;
};

/**
 * Reusable heart toggle that adds/removes a product from the wishlist.
 * Optimistic: flips immediately, rolls back on failure, shows a sonner toast.
 * Anonymous users are redirected to login with a return path.
 */
export function WishlistButton({
  productId,
  initial = false,
  variant = "icon",
  className,
  onChange,
}: WishlistButtonProps) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(initial);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    const next = !wishlisted;
    // Optimistic flip.
    setWishlisted(next);

    try {
      const res = await fetch("/api/wishlist", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const payload = await res.json().catch(() => null);

      if (res.status === 401) {
        setWishlisted(!next);
        toast.error("برای افزودن به علاقه‌مندی‌ها وارد شوید.");
        router.push(
          `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
        return;
      }

      if (!res.ok || !payload?.ok) {
        // Roll back.
        setWishlisted(!next);
        toast.error(payload?.error?.message ?? "عملیات ناموفق بود.");
        return;
      }

      toast.success(next ? "به علاقه‌مندی‌ها اضافه شد." : "از علاقه‌مندی‌ها حذف شد.");
      onChange?.(next);
      // Keep server components (e.g. the wishlist page) in sync.
      startTransition(() => router.refresh());
    } catch {
      setWishlisted(!next);
      toast.error("ارتباط با سرور برقرار نشد.");
    }
  }

  const label = wishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها";

  if (variant === "full") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={toggle}
        disabled={pending}
        aria-pressed={wishlisted}
        className={cn(wishlisted && "border-gold/40 text-gold", className)}
      >
        <Heart className={cn("size-4", wishlisted && "fill-current")} aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={wishlisted}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-background/80 text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-colors hover:text-foreground disabled:opacity-50",
        wishlisted && "text-gold hover:text-gold",
        className,
      )}
    >
      <Heart className={cn("size-4", wishlisted && "fill-current")} aria-hidden />
    </button>
  );
}
