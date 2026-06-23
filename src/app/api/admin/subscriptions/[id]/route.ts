import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { PaymentMethod } from "@/lib/payments/provider";
import {
  cancelSubscription,
  renewNow,
  SubscriptionError,
  setAutoRenew,
} from "@/lib/subscriptions/lifecycle";

type PatchBody = {
  action?: "cancel" | "setAutoRenew" | "renewNow";
  immediate?: boolean;
  autoRenew?: boolean;
  method?: PaymentMethod;
};

async function lookupOwnerId(subId: string): Promise<string | null> {
  const sub = await getDb().query.subscriptions.findFirst({
    where: (s, { eq }) => eq(s.id, subId),
    columns: { userId: true },
  });

  return sub?.userId ?? null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<PatchBody>(request);

  if (!body?.action) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  // The lifecycle helpers enforce ownership, so we operate as the subscription's
  // own user when acting on behalf of the operator.
  const userId = await lookupOwnerId(id);

  if (!userId) {
    return apiError("SUBSCRIPTION_NOT_FOUND", "اشتراک پیدا نشد.", 404);
  }

  try {
    switch (body.action) {
      case "cancel": {
        await cancelSubscription(id, userId, { immediate: Boolean(body.immediate) });
        return apiOk({ id, action: "cancel", immediate: Boolean(body.immediate) });
      }

      case "setAutoRenew": {
        await setAutoRenew(id, userId, Boolean(body.autoRenew));
        return apiOk({ id, action: "setAutoRenew", autoRenew: Boolean(body.autoRenew) });
      }

      case "renewNow": {
        // Default to the instantly-settling wallet method for operator renewals.
        const method = (body.method ?? "WALLET") as PaymentMethod;
        const result = await renewNow(id, userId, method);
        return apiOk({ id, action: "renewNow", ...result });
      }

      default:
        return apiError("INVALID_ACTION", "عملیات معتبر نیست.");
    }
  } catch (error) {
    if (error instanceof SubscriptionError) {
      return apiError(error.code, error.message);
    }

    return apiError("SUBSCRIPTION_UPDATE_FAILED", "عملیات اشتراک انجام نشد.", 500);
  }
}
