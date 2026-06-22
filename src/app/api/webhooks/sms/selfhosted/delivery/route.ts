import {
  applyDeliveryStatus,
  mapSelfhostedDeliveryStatus,
  pickString,
  readWebhookBody,
  recordWebhookEvent,
  verifyWebhookSecret,
} from "@/lib/comms/webhook";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Self-hosted SMS gateway delivery-status callback.
 *
 * Register this URL in your self-hosted gateway's delivery-report settings:
 *   POST /api/webhooks/sms/selfhosted/delivery?secret=<SELFHOSTED_WEBHOOK_SECRET>
 *
 * Expected request body (JSON):
 *   { "id": "<provider_message_id>", "status": "delivered" | "failed" | "undelivered" | <other> }
 *
 * Field parsing:
 *   - message id : body.id
 *   - status     : body.status
 *
 * Always returns 200 once authenticated so the gateway keeps the callback alive.
 */
export async function POST(request: Request) {
  if (!rateLimit(`wh:selfhosted:delivery:${clientIp(request)}`, 120, 60_000).ok) {
    return new Response("rate limited", { status: 429 });
  }

  const valid = await verifyWebhookSecret(request, "SELFHOSTED_WEBHOOK_SECRET");
  const body = await readWebhookBody(request);

  if (!valid) {
    await recordWebhookEvent({
      provider: "selfhosted",
      channel: "SMS",
      type: "delivery_status",
      rawPayload: body,
      signatureValid: false,
    });
    return new Response("unauthorized", { status: 401 });
  }

  const messageId = pickString(body, "id");
  const status = pickString(body, "status");
  let matchedLogId: string | null = null;
  if (messageId && status != null) {
    matchedLogId = await applyDeliveryStatus(messageId, mapSelfhostedDeliveryStatus(status));
  }

  await recordWebhookEvent({
    provider: "selfhosted",
    channel: "SMS",
    type: "delivery_status",
    rawPayload: body,
    matchedLogId,
    signatureValid: true,
  });

  return new Response("ok", { status: 200 });
}
