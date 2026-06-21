import { formatDeliveryError, type OtpDeliveryResult, resolveTimeoutMs } from "@/lib/sms/delivery";

type TelegramLoginOtpParams = {
  phone: string;
  code: string;
  host: string;
};

type TelegramApiPayload = {
  ok?: boolean;
  result?: {
    message_id?: number;
    date?: number;
    chat?: {
      id?: number | string;
      type?: string;
      title?: string;
      username?: string;
    };
  };
  error_code?: number;
  description?: string;
};

type TelegramChat = NonNullable<NonNullable<TelegramApiPayload["result"]>["chat"]>;

type TelegramLoginOtpPayload =
  | {
      ok: true;
      result: {
        messageId?: number;
        date?: number;
        chat?: TelegramChat;
      };
    }
  | {
      ok: false;
      errorCode?: number;
      description?: string;
    }
  | {
      error: string;
    };

export async function sendTelegramLoginOtp({
  phone,
  code,
  host,
}: TelegramLoginOtpParams): Promise<OtpDeliveryResult<TelegramLoginOtpPayload>> {
  const botToken = process.env.TELEGRAM_LOGIN_OTP_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_LOGIN_OTP_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

  // Relaying live OTP codes to an operator/debug Telegram chat is an
  // exfiltration backdoor — disable it entirely in production. No hardcoded
  // chat fallback: it must be explicitly configured (dev/staging only).
  if (process.env.NODE_ENV === "production" || !botToken || !chatId) {
    return {
      status: "skipped",
      message: "Telegram OTP delivery is disabled.",
      payload: null,
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        text: buildTelegramOtpMessage({ phone, code, host }),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(
        resolveTimeoutMs(process.env.TELEGRAM_LOGIN_OTP_TIMEOUT_MS, 10_000),
      ),
    });

    let payload: TelegramApiPayload;
    try {
      payload = (await response.json()) as TelegramApiPayload;
    } catch {
      return {
        status: "failed",
        message: "Telegram response was not valid JSON.",
        payload: { error: "Invalid Telegram JSON response." },
      };
    }

    if (!response.ok || payload.ok !== true) {
      const failedPayload: Extract<TelegramLoginOtpPayload, { ok: false }> = {
        ok: false,
      };

      if (payload.error_code !== undefined) {
        failedPayload.errorCode = payload.error_code;
      }

      if (payload.description) {
        failedPayload.description = payload.description;
      }

      return {
        status: "failed",
        message: payload.description ?? "Telegram request failed.",
        payload: failedPayload,
      };
    }

    const result: Extract<TelegramLoginOtpPayload, { ok: true }>["result"] = {};

    if (payload.result?.message_id !== undefined) {
      result.messageId = payload.result.message_id;
    }

    if (payload.result?.date !== undefined) {
      result.date = payload.result.date;
    }

    if (payload.result?.chat) {
      result.chat = payload.result.chat;
    }

    return {
      status: "sent",
      message: "Telegram message sent.",
      payload: {
        ok: true,
        result,
      },
    };
  } catch (error) {
    return {
      status: "failed",
      message: formatDeliveryError(error),
      payload: { error: formatDeliveryError(error) },
    };
  }
}

function buildTelegramOtpMessage({ phone, code, host }: TelegramLoginOtpParams) {
  return [
    "<b>Pixevel login OTP</b>",
    "",
    `phone number: <code>${escapeHtml(phone)}</code>`,
    `otp: <code>${escapeHtml(code)}</code>`,
    `host: <code>${escapeHtml(host)}</code>`,
  ].join("\n");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
