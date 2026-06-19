"use client";

import { PreviewCard } from "@base-ui/react/preview-card";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";

import { useCart } from "@/components/shop/cart-provider";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MiniCart } from "./mini-cart";

/**
 * Cart entry point. Desktop: hover shows a mini-cart preview (base-ui PreviewCard);
 * clicking opens a Vaul drawer. Mobile: tap opens the drawer. The full /basket page
 * is reached from inside the mini-cart.
 */
export function CartButton({ className }: { className?: string }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  const button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="سبد خرید"
      className={cn("relative", className)}
    >
      <ShoppingBag className="size-5" />
      {count > 0 ? (
        <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-background">
          {count > 9 ? "+۹" : toFaNumber(count)}
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      <PreviewCard.Root>
        <PreviewCard.Trigger render={button} />
        <PreviewCard.Portal>
          <PreviewCard.Positioner side="bottom" align="end" sideOffset={10} className="z-50">
            <PreviewCard.Popup className="hidden w-80 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl lg:block">
              <div className="border-b border-border px-4 py-3 text-sm font-black">سبد خرید</div>
              <div className="max-h-[60dvh]">
                <MiniCart />
              </div>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="lg:mx-auto lg:max-w-md">
          <DrawerHeader>
            <DrawerTitle>سبد خرید</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1">
            <MiniCart onNavigate={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
