"use client";

import { createContext, useContext, useEffect, useState } from "react";

type CartState = { count: number };

const CartContext = createContext<CartState>({ count: 0 });

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        const payload = await response.json();

        if (active && payload?.ok) {
          setCount(payload.data.cart.itemCount ?? 0);
        }
      } catch {
        // Ignore — badge keeps its last known value.
      }
    }

    load();
    window.addEventListener("cart:changed", load);
    window.addEventListener("focus", load);

    return () => {
      active = false;
      window.removeEventListener("cart:changed", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  return <CartContext.Provider value={{ count }}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  return useContext(CartContext);
}
