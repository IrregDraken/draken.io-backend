// Design reminder: Quiet Maroon Hospitality — cart behaviour is direct, calm, and never pretends a missing menu is live.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  id: string;
  name: string;
  quantity: number;
  unitPriceKobo: number;
  options: string[];
};

type OrderingContextValue = {
  cart: CartLine[];
  cartCount: number;
  cartSubtotalKobo: number;
  addLine: (line: CartLine) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeLine: (id: string) => void;
  clearCart: () => void;
};

const OrderingContext = createContext<OrderingContextValue | undefined>(undefined);

export function OrderingProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);

  const value = useMemo(
    () => ({
      cart,
      cartCount: cart.reduce((total, line) => total + line.quantity, 0),
      cartSubtotalKobo: cart.reduce((total, line) => total + line.unitPriceKobo * line.quantity, 0),
      addLine: (line: CartLine) => {
        setCart((current) => {
          const existing = current.find((entry) => entry.id === line.id);
          if (!existing) return [...current, line];
          return current.map((entry) => entry.id === line.id ? { ...entry, quantity: entry.quantity + line.quantity } : entry);
        });
      },
      updateQuantity: (id: string, quantity: number) => {
        setCart((current) => quantity <= 0 ? current.filter((entry) => entry.id !== id) : current.map((entry) => entry.id === id ? { ...entry, quantity } : entry));
      },
      removeLine: (id: string) => setCart((current) => current.filter((entry) => entry.id !== id)),
      clearCart: () => setCart([]),
    }),
    [cart],
  );

  return <OrderingContext.Provider value={value}>{children}</OrderingContext.Provider>;
}

export function useOrdering() {
  const context = useContext(OrderingContext);
  if (!context) {
    throw new Error("useOrdering must be used inside OrderingProvider");
  }
  return context;
}
