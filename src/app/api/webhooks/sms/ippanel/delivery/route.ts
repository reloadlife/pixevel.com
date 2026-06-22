import {
  applyDeliveryStatus,
  mapIppanelDeliveryStatus,
  pickString,
  readWebhookBody,
  recordWebhookEvent,
  verifyWebhookSecret,
} from "@/lib/comms/webhook";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * IPPanel delivery-status callback. Configure pointing at
 * `/api/webhooks/sms/ippanel/delivery?secret=<IPPANEL_WEBHOOK_SECRET>`.
 * IPPanel's payload shape is loosely documented — parse defensively.
 */
export async function POST(request: Request) {
  if (!rateLimit(`wh:ippanel:delivery:${clientIp(request)}`, 120, 60_000).ok) {
    return new Response("rate limited", { status: 429 });
  }

  const valid = await verifyWebhookSecret(request, "IPPANEL_WEBHOOK_SECRET");
  const body = await readWebhookBody(request);

  if (!valid) {
    await recordWebhookEvent({
      provider: "ippanel",
      channel: "SMS",
      type: "delivery_status",
      rawPayload: body,
      signatureValid: false,
    });
    return new Response("unauthorized", { status: 401 });
  }

  const messageId = pickString(body, "message_id", "messageId", "id", "message_outbox_id");
  const status = pickString(body, "status", "delivery_state", "state");
  let matchedLogId: string | null = null;
  if (messageId && status != null) {
    matchedLogId = await applyDeliveryStatus(messageId, mapIppanelDeliveryStatus(status));
  }

  await recordWebhookEvent({
    provider: "ippanel",
    channel: "SMS",
    type: "delivery_status",
    rawPayload: body,
    matchedLogId,
    signatureValid: true,
  });

  return new Response("ok", { status: 200 });
}
