import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type { PaymentMethod } from "@/lib/payments/provider";
import {
  cancelSubscription,
  renewNow,
  SubscriptionError,
  setAutoRenew,
} from "@/lib/subscriptions/lifecycle";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// "WALLET" is a virtual renewal method (settled from the wallet, not a gateway);
// renewNow() handles it before the gateway provider lookup.
type RenewMethod = PaymentMethod | "WALLET";

type PatchBody = {
  action?: "cancel" | "setAutoRenew" | "renewNow";
  immediate?: boolean;
  autoRenew?: boolean;
  method?: RenewMethod;
};

/**
 * PATCH manages a single subscription owned by the authenticated user:
 *  - { action: "cancel", immediate? } → cancel now or at period end.
 *  - { action: "setAutoRenew", autoRenew } → toggle auto-renew.
 *  - { action: "renewNow", method } → start a renewal payment. WALLET settles
 *    instantly; gateway methods return a redirectUrl for the client to follow.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const body = (await readJson<PatchBody>(request)) ?? {};

  try {
    switch (body.action) {
      case "cancel": {
        await cancelSubscription(id, user.id, { immediate: body.immediate === true });
        return apiOk({ canceled: true, immediate: body.immediate === true });
      }
      case "setAutoRenew": {
        if (typeof body.autoRenew !== "boolean") {
          return apiError("INVALID_INPUT", "مقدار تمدید خودکار نامعتبر است.", 400);
        }
        await setAutoRenew(id, user.id, body.autoRenew);
        return apiOk({ autoRenew: body.autoRenew });
      }
      case "renewNow": {
        if (!body.method) {
          return apiError("INVALID_INPUT", "روش پرداخت را انتخاب کنید.", 400);
        }
        const result = await renewNow(id, user.id, body.method as PaymentMethod);
        return apiOk({
          paid: result.paid,
          redirectUrl: result.redirectUrl ?? null,
          instructions: result.instructions ?? null,
        });
      }
      default:
        return apiError("INVALID_ACTION", "عملیات نامعتبر است.", 400);
    }
  } catch (error) {
    if (error instanceof SubscriptionError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return apiError(error.code, error.message, status);
    }
    return apiError("INTERNAL", "انجام عملیات روی اشتراک ممکن نشد.", 500);
  }
}
