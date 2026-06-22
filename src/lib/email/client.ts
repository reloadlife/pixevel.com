/**
 * Transactional email delivery.
 *
 * Env-gated over the Resend HTTP API (no SDK dependency — plain `fetch`, exactly
 * like the Telegram OTP sender in `src/lib/sms/telegram.ts`). When the provider
 * is not configured the call is a no-op that returns `status: "skipped"` and
 * never throws, so checkout/payment is never blocked by a missing email config.
 *
 * Configure with:
 *   RESEND_API_KEY   — Resend API key (required to actually send).
 *   EMAIL_FROM       — From header, e.g. "Pixevel <no-reply@pixevel.com>".
 *   EMAIL_TIMEOUT_MS — Optional request timeout (default 10000ms).
 */

import { getSetting, getSettingNumber } from "@/lib/settings";

export type EmailDeliveryStatus = "sent" | "skipped" | "failed";

export type EmailDeliveryResult = {
  status: EmailDeliveryStatus;
  message: string;
  /** Provider message id when available (e.g. Resend `id`). */
  id: string | null;
};

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

type ResendSendResponse = {
  id?: string;
  // Resend error shape: { statusCode, name, message }
  name?: string;
  message?: string;
};

function formatEmailError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown email delivery error.";
}

/**
 * Send a transactional email. Best-effort: returns a status object and never
 * throws. "skipped" when unconfigured, "failed" on a provider/network error,
 * "sent" on success.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<EmailDeliveryResult> {
  const apiKey = await getSetting("RESEND_API_KEY");
  const from = await getSetting("EMAIL_FROM");

  if (!apiKey || !from) {
    // No-op fallback. Log in development so the omission is visible locally.
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[email] skipped (RESEND_API_KEY / EMAIL_FROM not configured) → to=${
          Array.isArray(to) ? to.join(", ") : to
        } subject=${subject}`,
      );
    }

    return {
      status: "skipped",
      message: "Email delivery is not configured.",
      id: null,
    };
  }

  const recipients = Array.isArray(to) ? to : [to];

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        ...(text ? { text } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(await getSettingNumber("EMAIL_TIMEOUT_MS", 10_000)),
    });

    let payload: ResendSendResponse;
    try {
      payload = (await response.json()) as ResendSendResponse;
    } catch {
      return {
        status: "failed",
        message: "Email provider response was not valid JSON.",
        id: null,
      };
    }

    if (!response.ok || !payload.id) {
      return {
        status: "failed",
        message: payload.message ?? "Email provider request failed.",
        id: null,
      };
    }

    return {
      status: "sent",
      message: "Email sent.",
      id: payload.id,
    };
  } catch (error) {
    return {
      status: "failed",
      message: formatEmailError(error),
      id: null,
    };
  }
}
