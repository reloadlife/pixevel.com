import {
  applyDeliveryStatus,
  mapKavenegarDeliveryStatus,
  pickString,
  readWebhookBody,
  recordWebhookEvent,
  verifyWebhookSecret,
} from "@/lib/comms/webhook";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Kavenegar delivery-status callback. Configure in the Kavenegar panel pointing
 * at `/api/webhooks/sms/kavenegar/delivery?secret=<KAVENEGAR_WEBHOOK_SECRET>`.
 * Always returns 200 once authenticated so the provider keeps the callback on.
 */
export async function POST(request: Request) {
  if (!rateLimit(`wh:kavenegar:delivery:${clientIp(request)}`, 120, 60_000).ok) {
    return new Response("rate limited", { status: 429 });
  }

  const valid = await verifyWebhookSecret(request, "KAVENEGAR_WEBHOOK_SECRET");
  const body = await readWebhookBody(request);

  if (!valid) {
    await recordWebhookEvent({
      provider: "kavenegar",
      channel: "SMS",
      type: "delivery_status",
      rawPayload: body,
      signatureValid: false,
    });
    return new Response("unauthorized", { status: 401 });
  }

  const messageId = pickString(body, "messageid", "messageId");
  const code = pickString(body, "status");
  let matchedLogId: string | null = null;
  if (messageId && code != null) {
    matchedLogId = await applyDeliveryStatus(messageId, mapKavenegarDeliveryStatus(code));
  }

  await recordWebhookEvent({
    provider: "kavenegar",
    channel: "SMS",
    type: "delivery_status",
    rawPayload: body,
    matchedLogId,
    signatureValid: true,
  });

  return new Response("ok", { status: 200 });
}
