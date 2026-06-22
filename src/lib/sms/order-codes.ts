export interface OrderCodesSmsInput {
  /** Iranian mobile number in normalized 09xxxxxxxxx form. */
  phone: string;
  /** Human-facing order number (e.g. PX-XXXX). */
  orderNumber: string;
  /** Digital codes to deliver. */
  codes: string[];
}

/**
 * Build a concise Persian SMS body for an order's digital codes.
 *
 * Kept short on purpose — SMS bodies are length-billed, so we list the order
 * number followed by the code(s), one per line.
 */
export function buildOrderCodesSms(orderNumber: string, codes: string[]): string {
  const lines = [`پیکسوِل`, `کد(های) سفارش ${orderNumber}:`, ...codes];
  return lines.join("\n");
}
