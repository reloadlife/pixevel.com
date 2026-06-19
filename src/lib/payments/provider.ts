import type { orders, payments } from "@/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod =
  | "ZARINPAL"
  | "CARD_TO_CARD"
  | "BEHPARDAKHT"
  | "SAMAN"
  | "SNAPPPAY"
  | "DIGIPAY";

type Order = typeof orders.$inferSelect;
type Payment = typeof payments.$inferSelect;

export interface PaymentProvider {
  method: PaymentMethod;
  /**
   * Initiate a payment for the given order + payment row.
   * Returns either a redirectUrl (for gateway redirects) or instructions (for manual flows).
   */
  initiate(
    order: Order,
    payment: Payment,
  ): Promise<{ redirectUrl?: string; instructions?: unknown }>;
  /**
   * Verify a payment result from a gateway callback or manual confirmation.
   * Returns the canonical status and optional gateway reference.
   */
  verify(
    payment: Payment,
    params: Record<string, unknown>,
  ): Promise<{ status: "PAID" | "FAILED"; reference?: string }>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<PaymentMethod, PaymentProvider>();

export function registerProvider(provider: PaymentProvider): void {
  registry.set(provider.method, provider);
}

export function getProvider(method: PaymentMethod): PaymentProvider {
  const provider = registry.get(method);
  if (!provider) {
    throw new Error(`No payment provider registered for method: ${method}`);
  }
  return provider;
}
