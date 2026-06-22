import {
  pickString,
  readWebhookBody,
  recordInbound,
  recordWebhookEvent,
  verifyWebhookSecret,
} from "@/lib/comms/webhook";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * IPPanel inbound-SMS webhook (received messages). Configure pointing at
 * `/api/webhooks/sms/ippanel/receive?secret=<IPPANEL_WEBHOOK_SECRET>`.
 */
export async function POST(request: Request) {
  if (!rateLimit(`wh:ippanel:receive:${clientIp(request)}`, 120, 60_000).ok) {
    return new Response("rate limited", { status: 429 });
  }

  const valid = await verifyWebhookSecret(request, "IPPANEL_WEBHOOK_SECRET");
  const body = await readWebhookBody(request);

  if (!valid) {
    await recordWebhookEvent({
      provider: "ippanel",
      channel: "SMS",
      type: "inbound",
      rawPayload: body,
      signatureValid: false,
    });
    return new Response("unauthorized", { status: 401 });
  }

  const logId = await recordInbound({
    channel: "SMS",
    provider: "ippanel",
    toAddress: pickString(body, "to", "receiver", "number") ?? "",
    fromAddress: pickString(body, "from", "sender"),
    body: pickString(body, "message", "text", "content"),
    payload: body,
  });

  await recordWebhookEvent({
    provider: "ippanel",
    channel: "SMS",
    type: "inbound",
    rawPayload: body,
    matchedLogId: logId,
    signatureValid: true,
  });

  return new Response("ok", { status: 200 });
}
