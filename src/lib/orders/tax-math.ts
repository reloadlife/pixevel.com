/**
 * Pure VAT math — no server-only imports so this module is safe to use in
 * client components. The VAT rate itself is always fetched server-side (see
 * `getVatRatePercent` in `./tax.ts`) and passed in as a plain number.
 */

export interface TaxableLine {
  /** Pre-tax line total in Toman (unitPrice × quantity). */
  lineTotal: number;
  /** When true the line carries no VAT (zero-rated product). */
  taxExempt: boolean;
}

export interface LineTax {
  /** VAT charged on this line, in whole Toman. */
  taxAmount: number;
  /** Rate applied to this line (0 for exempt lines). */
  taxRatePercent: number;
}

export interface OrderTax {
  perLine: LineTax[];
  totalTax: number;
}

/**
 * Allocates VAT across order lines.
 *
 * An order-level discount (coupon) is spread proportionally across lines by
 * their share of the pre-discount subtotal, so each line is taxed on what the
 * customer actually pays for it. Exempt lines are never taxed. Each line's
 * tax is rounded to whole Toman and the order total is the sum of the rounded
 * lines (no drift).
 */
export function computeOrderTaxes(
  lines: TaxableLine[],
  ratePercent: number,
  discountToman = 0,
): OrderTax {
  if (ratePercent <= 0) {
    return { perLine: lines.map(() => ({ taxAmount: 0, taxRatePercent: 0 })), totalTax: 0 };
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const discount = Math.min(Math.max(discountToman, 0), subtotal);

  let totalTax = 0;
  const perLine = lines.map((line) => {
    if (line.taxExempt || line.lineTotal <= 0) {
      return { taxAmount: 0, taxRatePercent: 0 };
    }
    const discountShare = subtotal > 0 ? (discount * line.lineTotal) / subtotal : 0;
    const net = Math.max(0, line.lineTotal - discountShare);
    const taxAmount = Math.round((net * ratePercent) / 100);
    totalTax += taxAmount;
    return { taxAmount, taxRatePercent: ratePercent };
  });

  return { perLine, totalTax };
}
