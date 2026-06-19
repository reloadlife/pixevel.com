import { type PaymentProvider, registerProvider } from "./provider";

/**
 * MANUAL payment provider.
 *
 * Used for orders that will be confirmed by an admin operator rather than
 * an automated gateway. initiate() returns Persian instructions to show
 * the customer. verify() is never called in the normal flow — confirmPayment()
 * is called directly by admin action — so it throws to make misuse obvious.
 */
const manualProvider: PaymentProvider = {
  method: "MANUAL",

  async initiate(_order, _payment) {
    return {
      instructions: {
        fa: "سفارش ثبت شد. پرداخت پس از تایید مدیر.",
      },
    };
  },

  async verify(_payment, _params) {
    // MANUAL payments are confirmed via admin action (confirmPayment / failPayment),
    // not via gateway callback. Throw so any accidental call surfaces clearly.
    throw new Error(
      "MANUAL provider does not support verify(). Use confirmPayment() / failPayment() instead.",
    );
  },
};

// Self-register when this module is imported.
registerProvider(manualProvider);

export { manualProvider };
