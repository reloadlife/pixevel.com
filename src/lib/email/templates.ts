/**
 * RTL Persian HTML email templates for transactional order mail.
 *
 * Each builder returns `{ subject, html, text }` so the caller can pass the
 * result straight into `sendEmail`. HTML uses inline styles only (email clients
 * strip <style> / external CSS) and a max-width table layout for broad support.
 *
 * Amounts are Toman-formatted via the shared `formatToman` helper to stay
 * consistent with the rest of the storefront.
 */

import { formatToman } from "@/lib/format";

const BRAND = "Pixevel";
const ACCENT = "#0f172a"; // slate-900 — neutral, premium
const MUTED = "#64748b"; // slate-500
const BORDER = "#e2e8f0"; // slate-200
const BG = "#f8fafc"; // slate-50

// ─── Public input shapes (stable; decoupled from Drizzle row types) ────────────

export type OrderEmailSummary = {
  orderNumber: string;
  customerName?: string | null;
  subtotalAmount: number | string;
  shippingAmount?: number | string | null;
  discountAmount?: number | string | null;
  totalAmount: number | string;
  couponCode?: string | null;
  giftMessage?: string | null;
};

export type OrderEmailItem = {
  titleFa: string;
  /** Optional variant descriptor, e.g. "قرمز / چرم / سایز M". */
  variantFa?: string | null;
  quantity: number;
  totalPrice: number | string;
};

export type DigitalCodeGroup = {
  /** Product / variant title shown above its code(s). */
  titleFa: string;
  codes: string[];
};

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

// ─── Escaping ──────────────────────────────────────────────────────────────────

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

// ─── Shared chrome ──────────────────────────────────────────────────────────────

export function shell(title: string, inner: string) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;font-family:Tahoma,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;direction:rtl;text-align:right;">
<tr><td style="padding:24px 28px;border-bottom:1px solid ${BORDER};">
<span style="font-size:20px;font-weight:800;letter-spacing:0.04em;color:${ACCENT};">${BRAND}</span>
</td></tr>
<tr><td style="padding:28px;color:${ACCENT};font-size:14px;line-height:1.9;">
${inner}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${BORDER};color:${MUTED};font-size:12px;line-height:1.8;">
این ایمیل به‌صورت خودکار از سوی ${BRAND} ارسال شده است. در صورت داشتن هرگونه پرسش با پشتیبانی در تماس باشید.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function totalsRow(label: string, value: string, opts: { bold?: boolean; muted?: boolean } = {}) {
  const weight = opts.bold ? "800" : "400";
  const color = opts.muted ? MUTED : ACCENT;
  return `<tr>
<td style="padding:4px 0;color:${MUTED};font-size:13px;">${escapeHtml(label)}</td>
<td style="padding:4px 0;text-align:left;font-weight:${weight};color:${color};font-size:13px;">${value}</td>
</tr>`;
}

function num(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

// ─── Receipt email ──────────────────────────────────────────────────────────────

export function orderReceiptEmail(order: OrderEmailSummary, items: OrderEmailItem[]): EmailContent {
  const subject = `رسید سفارش ${order.orderNumber} — ${BRAND}`;

  const itemRows = items
    .map(
      (item) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BORDER};">
<div style="font-weight:700;color:${ACCENT};font-size:13px;">${escapeHtml(item.titleFa)}</div>
${
  item.variantFa
    ? `<div style="color:${MUTED};font-size:12px;margin-top:2px;">${escapeHtml(item.variantFa)}</div>`
    : ""
}
<div style="color:${MUTED};font-size:12px;margin-top:2px;">تعداد: ${item.quantity}</div>
</td>
<td style="padding:10px 0;border-bottom:1px solid ${BORDER};text-align:left;white-space:nowrap;font-weight:700;color:${ACCENT};font-size:13px;">${escapeHtml(
        formatToman(item.totalPrice),
      )}</td>
</tr>`,
    )
    .join("");

  const hasShipping = num(order.shippingAmount) > 0;
  const hasDiscount = num(order.discountAmount) > 0;

  const inner = `
<p style="margin:0 0 6px;font-size:16px;font-weight:800;">${
    order.customerName ? `${escapeHtml(order.customerName)} عزیز،` : "سلام،"
  }</p>
<p style="margin:0 0 20px;color:${MUTED};">از خرید شما سپاسگزاریم. رسید سفارش شما در ادامه آمده است.</p>

<div style="background:${BG};border:1px solid ${BORDER};border-radius:8px;padding:12px 16px;margin-bottom:20px;">
<span style="color:${MUTED};font-size:12px;">شماره سفارش</span><br />
<span style="font-family:monospace;font-size:15px;font-weight:700;letter-spacing:0.04em;direction:ltr;display:inline-block;">${escapeHtml(
    order.orderNumber,
  )}</span>
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
${itemRows}
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
${totalsRow("جمع کالاها", escapeHtml(formatToman(order.subtotalAmount)))}
${hasShipping ? totalsRow("هزینه ارسال", escapeHtml(formatToman(order.shippingAmount))) : ""}
${
  hasDiscount
    ? totalsRow(
        order.couponCode ? `تخفیف (${escapeHtml(order.couponCode)})` : "تخفیف",
        `-${escapeHtml(formatToman(order.discountAmount))}`,
      )
    : ""
}
<tr><td colspan="2" style="border-top:1px solid ${BORDER};padding-top:6px;"></td></tr>
${totalsRow("مبلغ کل", escapeHtml(formatToman(order.totalAmount)), { bold: true })}
</table>
`;

  const textLines = [
    `${BRAND} — رسید سفارش`,
    "",
    `شماره سفارش: ${order.orderNumber}`,
    "",
    "اقلام:",
    ...items.map(
      (item) =>
        `- ${item.titleFa}${item.variantFa ? ` (${item.variantFa})` : ""} × ${item.quantity} — ${formatToman(
          item.totalPrice,
        )}`,
    ),
    "",
    `جمع کالاها: ${formatToman(order.subtotalAmount)}`,
    ...(hasShipping ? [`هزینه ارسال: ${formatToman(order.shippingAmount)}`] : []),
    ...(hasDiscount ? [`تخفیف: -${formatToman(order.discountAmount)}`] : []),
    `مبلغ کل: ${formatToman(order.totalAmount)}`,
  ];

  return { subject, html: shell(subject, inner), text: textLines.join("\n") };
}

// ─── Digital codes email ────────────────────────────────────────────────────────

export function digitalCodesEmail({
  order,
  codes,
}: {
  order: OrderEmailSummary;
  codes: DigitalCodeGroup[];
}): EmailContent {
  const subject = `کدهای دیجیتال سفارش ${order.orderNumber} — ${BRAND}`;

  const groupBlocks = codes
    .map((group) => {
      const codeBoxes = group.codes
        .map(
          (code) =>
            `<div style="background:${BG};border:1px solid ${BORDER};border-radius:6px;padding:10px 12px;margin-top:6px;font-family:monospace;font-size:14px;font-weight:700;letter-spacing:0.06em;color:${ACCENT};direction:ltr;text-align:left;word-break:break-all;">${escapeHtml(
              code,
            )}</div>`,
        )
        .join("");

      return `<div style="margin-bottom:18px;">
<div style="font-weight:700;color:${ACCENT};font-size:14px;margin-bottom:2px;">${escapeHtml(
        group.titleFa,
      )}</div>
${codeBoxes}
</div>`;
    })
    .join("");

  const giftBlock = order.giftMessage
    ? `<div style="background:${BG};border:1px dashed ${BORDER};border-radius:8px;padding:14px 16px;margin:0 0 20px;">
<span style="color:${MUTED};font-size:12px;">پیام هدیه</span><br />
<span style="color:${ACCENT};font-size:14px;line-height:1.9;">${escapeHtml(order.giftMessage)}</span>
</div>`
    : "";

  const inner = `
<p style="margin:0 0 6px;font-size:16px;font-weight:800;">کدهای دیجیتال شما آماده است</p>
<p style="margin:0 0 20px;color:${MUTED};">کدهای زیر مربوط به سفارش <span style="font-family:monospace;direction:ltr;display:inline-block;">${escapeHtml(
    order.orderNumber,
  )}</span> هستند. لطفاً آن‌ها را در جای امنی نگه دارید.</p>

${giftBlock}

${groupBlocks}

<p style="margin:18px 0 0;color:${MUTED};font-size:12px;line-height:1.9;">این کدها در حساب کاربری شما نیز در دسترس هستند.</p>
`;

  const textLines = [
    `${BRAND} — کدهای دیجیتال`,
    "",
    `شماره سفارش: ${order.orderNumber}`,
    ...(order.giftMessage ? ["", `پیام هدیه: ${order.giftMessage}`] : []),
    "",
    ...codes.flatMap((group) => [
      `${group.titleFa}:`,
      ...group.codes.map((code) => `  ${code}`),
      "",
    ]),
    "این کدها در حساب کاربری شما نیز در دسترس هستند.",
  ];

  return { subject, html: shell(subject, inner), text: textLines.join("\n") };
}
