"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type { CartView } from "@/lib/cart";

export type CartLine = CartView["items"][number];

type CartState = {
  cart: CartView;
  count: number;
  loading: boolean;
  refresh: () => void;
};

const EMPTY_CART: CartView = { id: null, items: [], itemCount: 0, subtotal: 0 };

const CartContext = createContext<CartState>({
  cart: EMPTY_CART,
  count: 0,
  loading: false,
  refresh: () => {},
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
    <CartContext.Provider value={{ cart, count: cart.itemCount, loading, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  return useContext(CartContext);
}
