import { getSetting } from "@/lib/settings";
import { type PaymentProvider, registerProvider } from "./provider";

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * CARD_TO_CARD payment provider.
 *
 * Instructs the buyer to transfer the order total to a specific card number
 * and upload the transfer receipt. The admin later confirms the payment
 * manually (Task 10). The order stays PENDING/UNPAID until confirmation.
 *
 * verify() is never called in the normal flow — confirmPayment() is called
 * directly by admin action — so it throws to make misuse obvious.
 */
const cardToCardProvider: PaymentProvider = {
  method: "CARD_TO_CARD",

  async initiate(order, _payment) {
    const cardNumber = (await getSetting("CARD_TO_CARD_NUMBER")) ?? "6219-8610-0000-0000";
    const cardHolder = (await getSetting("CARD_TO_CARD_HOLDER")) ?? "پیکسول";

    const totalFormatted = new Intl.NumberFormat("fa-IR").format(
      Math.round(Number(order.totalAmount)),
    );

    return {
      instructions: {
        cardNumber,
        holder: cardHolder,
        fa: `لطفاً مبلغ ${totalFormatted} تومان را به شماره کارت ${cardNumber} به نام ${cardHolder} واریز کنید و تصویر رسید واریزی را آپلود نمایید. پس از تأیید توسط مدیر، سفارش شما پردازش خواهد شد.`,
      },
    };
  },

  async verify(_payment, _params) {
    // CARD_TO_CARD payments are confirmed via admin action (confirmPayment / failPayment),
    // not via gateway callback. Throw so any accidental call surfaces clearly.
    throw new Error(
      "CARD_TO_CARD provider does not support verify(). Use confirmPayment() / failPayment() instead.",
    );
  },
};

// Self-register when this module is imported.
registerProvider(cardToCardProvider);

export { cardToCardProvider };
