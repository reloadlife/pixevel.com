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
 * IPPanel delivery-status callback.
 *
 * Register URL in the IPPanel panel under Settings → Webhook / Delivery Report:
 *   POST /api/webhooks/sms/ippanel/delivery?secret=<IPPANEL_WEBHOOK_SECRET>
 *
 * IPPanel does NOT publish a formal push-webhook spec (as of 2026-06). The Edge
 * API docs describe only a polling endpoint (GET /api/report/recipients) whose
 * per-recipient `message_status` field uses numeric string codes:
 *   "0" Sent to operator, "1" Operator received, "2" Delivered, "3" Not delivered,
 *   "4" Blacklisted.
 * The message identifier in that report is `messages_outbox_id`.
 *
 * If IPPanel does push a delivery callback, we parse defensively across all
 * known field name variants. `mapIppanelDeliveryStatus` already handles both
 * numeric codes ("2"/"3") and string labels ("delivered"/"undelivered"/"failed").
 *
 * Fields parsed:
 *   - message id : message_id | messageId | messages_outbox_id | id | message_outbox_id
 *   - status     : message_status | status | delivery_state | state
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

  const messageId = pickString(
    body,
    "message_id",
    "messageId",
    "messages_outbox_id",
    "id",
    "message_outbox_id",
  );
  const status = pickString(body, "message_status", "status", "delivery_state", "state");
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
