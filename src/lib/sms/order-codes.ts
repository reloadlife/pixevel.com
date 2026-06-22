import type { OtpDeliveryResult } from "@/lib/sms/delivery";
import { resolveSmsProvider } from "@/lib/sms/providers";

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

/**
 * Send an order's digital code(s) to a phone number via the registry-resolved
 * SMS provider. Never throws — always resolves to a delivery status so callers
 * can treat it as best-effort. A missing SMS config must never break checkout
 * or payment (the resolved provider's sendText handles env-gating).
 */
export async function sendOrderCodesSms(
  input: OrderCodesSmsInput,
): Promise<OtpDeliveryResult<unknown>> {
  const { phone, orderNumber, codes } = input;

  if (!phone) {
    return { status: "skipped", message: "No recipient phone number provided.", payload: null };
  }

  if (codes.length === 0) {
    return { status: "skipped", message: "No codes to deliver.", payload: null };
  }

  const provider = await resolveSmsProvider();
  return provider.sendText(phone, buildOrderCodesSms(orderNumber, codes));
}
