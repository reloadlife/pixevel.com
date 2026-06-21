"use client";

import { Popover } from "@base-ui/react/popover";
import { ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/shop/cart-provider";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { CurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AccountPanel } from "./account-panel";
import { MiniCart } from "./mini-cart";

type MenuKind = "account" | "cart";

/** One shared popover for both header menus, so hovering between them morphs a single surface. */
const headerMenu = Popover.createHandle<MenuKind>();

const OPEN_DELAY = 60;
const CLOSE_DELAY = 140;

const iconButton =
  "grid size-9 place-items-center rounded-md text-foreground transition hover:bg-muted data-[popup-open]:bg-muted";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * Account + cart header controls backed by a single base-ui popover (`headerMenu` handle).
 * Because both triggers drive the same popover, moving the pointer from one to the other keeps
 * the popup mounted and morphs its position, size, and content (via `Popover.Viewport`) instead
 * of flickering one closed and the other open. The cart's *click* opens the full Vaul drawer.
 */
export function HeaderMenus({ user, className }: { user: CurrentUser | null; className?: string }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {user ? (
        <Popover.Trigger
          handle={headerMenu}
          id="account"
          payload="account"
          openOnHover
          delay={OPEN_DELAY}
          closeDelay={CLOSE_DELAY}
          aria-label="حساب کاربری"
          className={iconButton}
        >
          <UserRound className="size-5" />
        </Popover.Trigger>
      ) : (
        <Link href="/login" aria-label="ورود" className={iconButton}>
          <UserRound className="size-5" />
        </Link>
      )}

      <Popover.Trigger
        handle={headerMenu}
        id="cart"
        payload="cart"
        openOnHover
        delay={OPEN_DELAY}
        closeDelay={CLOSE_DELAY}
        aria-label="سبد خرید"
        className={cn(iconButton, "relative")}
        onClick={() => setDrawerOpen(true)}
      >
        <ShoppingBag className="size-5" />
        {count > 0 ? (
          <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-background">
            {count > 9 ? "+۹" : toFaNumber(count)}
          </span>
        ) : null}
      </Popover.Trigger>

      <Popover.Root
        handle={headerMenu}
        open={open}
        triggerId={activeId}
        onOpenChange={(next, details) => {
          // Cart click → full drawer, never the popover.
          if (next && details.reason === "trigger-press" && details.trigger?.id === "cart") {
            setDrawerOpen(true);
            return;
          }
          setOpen(next);
          if (next && details.trigger?.id) {
            setActiveId(details.trigger.id);
          }
        }}
      >
        {({ payload }) => (
          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="end"
              sideOffset={10}
              className={cn(
                "z-50 h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)]",
                "transition-[top,left,right,bottom] duration-300 data-[instant]:transition-none",
                EASE,
              )}
            >
              <Popover.Popup
                dir="rtl"
                className={cn(
                  "relative h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] origin-[var(--transform-origin)]",
                  "overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl",
                  "transition-[width,height,opacity,transform] duration-300 data-[instant]:transition-none",
                  "data-starting-style:scale-95 data-starting-style:opacity-0",
                  "data-ending-style:scale-95 data-ending-style:opacity-0",
                  EASE,
                )}
              >
                <Popover.Viewport
                  className={cn(
                    "relative h-full w-full overflow-clip",
                    "[&_[data-current]]:transition-[transform,opacity] [&_[data-current]]:duration-300",
                    "[&_[data-previous]]:transition-[transform,opacity] [&_[data-previous]]:duration-300",
                    "[&_[data-current]]:ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "[&_[data-previous]]:ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "data-[activation-direction~='left']:[&_[data-current][data-starting-style]]:-translate-x-4",
                    "data-[activation-direction~='left']:[&_[data-current][data-starting-style]]:opacity-0",
                    "data-[activation-direction~='left']:[&_[data-previous][data-ending-style]]:translate-x-4",
                    "data-[activation-direction~='left']:[&_[data-previous][data-ending-style]]:opacity-0",
                    "data-[activation-direction~='right']:[&_[data-current][data-starting-style]]:translate-x-4",
                    "data-[activation-direction~='right']:[&_[data-current][data-starting-style]]:opacity-0",
                    "data-[activation-direction~='right']:[&_[data-previous][data-ending-style]]:-translate-x-4",
                    "data-[activation-direction~='right']:[&_[data-previous][data-ending-style]]:opacity-0",
                  )}
                >
                  {payload === "cart" ? (
                    <div className="w-80 max-w-[calc(100vw-2rem)]">
                      <div className="border-b border-border px-4 py-3 text-sm font-black">
                        سبد خرید
                      </div>
                      <div className="max-h-[60dvh]">
                        <MiniCart onNavigate={() => setOpen(false)} />
                      </div>
                    </div>
                  ) : user ? (
                    <div className="w-72 max-w-[calc(100vw-2rem)] p-1.5">
                      <AccountPanel user={user} onNavigate={() => setOpen(false)} />
                    </div>
                  ) : null}
                </Popover.Viewport>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </Popover.Root>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="lg:mx-auto lg:max-w-md">
          <DrawerHeader>
            <DrawerTitle>سبد خرید</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1">
            <MiniCart onNavigate={() => setDrawerOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
