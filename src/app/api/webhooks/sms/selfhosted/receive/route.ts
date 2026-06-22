import {
  pickString,
  readWebhookBody,
  recordInbound,
  recordWebhookEvent,
  verifyWebhookSecret,
} from "@/lib/comms/webhook";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Self-hosted SMS gateway inbound-message webhook.
 *
 * Register this URL in your self-hosted gateway's receive/inbound settings:
 *   POST /api/webhooks/sms/selfhosted/receive?secret=<SELFHOSTED_WEBHOOK_SECRET>
 *
 * Expected request body (JSON):
 *   { "from": "<sender_number>", "to": "<our_number>", "message": "<text>" }
 *
 * Field parsing:
 *   - to      : body.to
 *   - from    : body.from
 *   - message : body.message
 */
export async function POST(request: Request) {
  if (!rateLimit(`wh:selfhosted:receive:${clientIp(request)}`, 120, 60_000).ok) {
    return new Response("rate limited", { status: 429 });
  }

  const valid = await verifyWebhookSecret(request, "SELFHOSTED_WEBHOOK_SECRET");
  const body = await readWebhookBody(request);

  if (!valid) {
    await recordWebhookEvent({
      provider: "selfhosted",
      channel: "SMS",
      type: "inbound",
      rawPayload: body,
      signatureValid: false,
    });
    return new Response("unauthorized", { status: 401 });
  }

  const logId = await recordInbound({
    channel: "SMS",
    provider: "selfhosted",
    toAddress: pickString(body, "to") ?? "",
    fromAddress: pickString(body, "from"),
    body: pickString(body, "message"),
    payload: body,
  });

  await recordWebhookEvent({
    provider: "selfhosted",
    channel: "SMS",
    type: "inbound",
    rawPayload: body,
    matchedLogId: logId,
    signatureValid: true,
  });

  return new Response("ok", { status: 200 });
}
