"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type { CartView } from "@/lib/cart";

export type CartLine = CartView["items"][number];

type CartState = {
  cart: CartView;
  count: number;
  loading: boolean;
  refresh: () => void;
  /** Set a line's quantity (PATCH). `quantity < 1` removes the line. */
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  /** Remove a line entirely (DELETE). */
  removeItem: (variantId: string) => Promise<void>;
};

const EMPTY_CART: CartView = {
  id: null,
  items: [],
  itemCount: 0,
  subtotal: 0,
  taxAmount: 0,
  vatRatePercent: 0,
};

const CartContext = createContext<CartState>({
  cart: EMPTY_CART,
  count: 0,
  loading: false,
  refresh: () => {},
  setQuantity: async () => {},
  removeItem: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const payload = await response.json();
      if (payload?.ok) {
        setCart(payload.data.cart as CartView);
      }
    } catch {
      // Ignore — keep the last known cart.
    } finally {
      setLoading(false);
    }
  }, []);

  // `/api/cart/item` returns the authoritative cart, so we apply it directly — every
  // useCart() consumer (header badge, bottom tabs, mini-cart) re-renders from one setState.
  const removeItem = useCallback(
    async (variantId: string) => {
      try {
        const response = await fetch("/api/cart/item", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ variantId }),
        });
        const payload = await response.json();
        if (payload?.ok) {
          setCart(payload.data.cart as CartView);
        } else {
          refresh();
        }
      } catch {
        refresh();
      }
    },
    [refresh],
  );

  const setQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (quantity < 1) {
        await removeItem(variantId);
        return;
      }
      try {
        const response = await fetch("/api/cart/item", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ variantId, quantity }),
        });
        const payload = await response.json();
        if (payload?.ok) {
          setCart(payload.data.cart as CartView);
        } else {
          refresh();
        }
      } catch {
        refresh();
      }
    },
    [refresh, removeItem],
  );

  useEffect(() => {
    refresh();
    const onChange = () => {
      refresh();
    };
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refresh]);

  return (
    <CartContext.Provider
      value={{ cart, count: cart.itemCount, loading, refresh, setQuantity, removeItem }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  return useContext(CartContext);
}
