import "server-only";

import { getSettingNumber } from "@/lib/settings";

/**
 * VAT (مالیات بر ارزش افزوده) for Iran is a single national rate, configured at
 * runtime via the `TAX_VAT_PERCENT` AppSetting. Returns 0 (tax disabled) for any
 * out-of-range or unset value, so totals stay unchanged until an operator opts in.
 */
export async function getVatRatePercent(): Promise<number> {
  const rate = await getSettingNumber("TAX_VAT_PERCENT", 0);
  return rate > 0 && rate < 100 ? rate : 0;
}

// Re-export pure tax math so server-side callers (place-order, etc.) keep the
// same import path they already use.
export type { LineTax, OrderTax, TaxableLine } from "./tax-math";
export { computeOrderTaxes } from "./tax-math";
