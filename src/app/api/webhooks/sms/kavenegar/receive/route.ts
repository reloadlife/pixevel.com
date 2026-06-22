import {
  pickString,
  readWebhookBody,
  recordInbound,
  recordWebhookEvent,
  verifyWebhookSecret,
} from "@/lib/comms/webhook";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Kavenegar inbound-SMS webhook (received messages). Configure pointing at
 * `/api/webhooks/sms/kavenegar/receive?secret=<KAVENEGAR_WEBHOOK_SECRET>`.
 * Dormant until a dedicated inbound number is provisioned at the provider.
 */
export async function POST(request: Request) {
  if (!rateLimit(`wh:kavenegar:receive:${clientIp(request)}`, 120, 60_000).ok) {
    return new Response("rate limited", { status: 429 });
  }

  const valid = await verifyWebhookSecret(request, "KAVENEGAR_WEBHOOK_SECRET");
  const body = await readWebhookBody(request);

  if (!valid) {
    await recordWebhookEvent({
      provider: "kavenegar",
      channel: "SMS",
      type: "inbound",
      rawPayload: body,
      signatureValid: false,
    });
    return new Response("unauthorized", { status: 401 });
  }

  const logId = await recordInbound({
    channel: "SMS",
    provider: "kavenegar",
    toAddress: pickString(body, "to", "receptor") ?? "",
    fromAddress: pickString(body, "from", "sender"),
    body: pickString(body, "message", "text"),
    payload: body,
  });

  await recordWebhookEvent({
    provider: "kavenegar",
    channel: "SMS",
    type: "inbound",
    rawPayload: body,
    matchedLogId: logId,
    signatureValid: true,
  });

  return new Response("ok", { status: 200 });
}
