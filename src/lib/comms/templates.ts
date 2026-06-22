import "server-only";

import { and, eq } from "drizzle-orm";

import { commTemplates } from "@/db/schema";
import { getDb } from "@/lib/db";
import { escapeHtml, shell } from "@/lib/email/templates";
import type { CommEventChannel, CommEventKey } from "./events";

/**
 * Message templates. A DB row in `commTemplates` overrides the seeded code
 * default below; if neither exists for a channel the dispatcher skips it.
 * `{variable}` placeholders are interpolated at render time.
 */

export type TemplateContent = {
  /** EMAIL subject / INAPP+PUSH title. */
  subject?: string;
  /** SMS text / INAPP body / EMAIL inner HTML. */
  body: string;
  /** Optional EMAIL plaintext alternative. */
  bodyText?: string;
  /** SMS only: route via a provider-registered pattern instead of free text. */
  isPattern?: boolean;
};

type Defaults = Partial<Record<CommEventChannel, TemplateContent>>;

const P = (s: string) => `<p style="margin:0 0 12px;">${s}</p>`;
const LTR = '<span dir="ltr">'; // close with </span> in the literal

export const DEFAULT_TEMPLATES: Record<CommEventKey, Defaults> = {
  ORDER_CREATED: {
    EMAIL: {
      subject: "سفارش {order_number} ثبت شد",
      body: `${P("سلام {customer_name}،")}${P(`سفارش شماره ${LTR}{order_number}</span> با موفقیت ثبت شد و در انتظار پرداخت است.`)}`,
      bodyText: "سفارش {order_number} ثبت شد و در انتظار پرداخت است.",
    },
    INAPP: { subject: "سفارش ثبت شد", body: "سفارش {order_number} ثبت شد و در انتظار پرداخت است." },
  },
  ORDER_PAID: {
    EMAIL: {
      subject: "پرداخت سفارش {order_number} تایید شد",
      body: `${P("سلام {customer_name}،")}${P(`پرداخت سفارش ${LTR}{order_number}</span> به مبلغ {total} با موفقیت انجام شد.`)}`,
      bodyText: "پرداخت سفارش {order_number} به مبلغ {total} انجام شد.",
    },
    SMS: { body: "پیکسوِل\nسفارش شماره {order_number} با موفقیت پرداخت شد." },
    INAPP: { subject: "پرداخت تایید شد", body: "سفارش {order_number} با موفقیت پرداخت شد." },
  },
  DIGITAL_CODES_DELIVERED: {
    EMAIL: {
      subject: "کدهای سفارش {order_number}",
      body: `${P(`کد(های) سفارش ${LTR}{order_number}</span> آماده است:`)}<pre dir="ltr" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:monospace;white-space:pre-wrap;word-break:break-all;">{codes}</pre>`,
      bodyText: "کد(های) سفارش {order_number}:\n{codes}",
    },
    SMS: { body: "پیکسوِل\nکد(های) سفارش {order_number}:\n{codes}" },
  },
  PAYMENT_FAILED: {
    EMAIL: {
      subject: "پرداخت سفارش {order_number} ناموفق بود",
      body: P(`پرداخت سفارش ${LTR}{order_number}</span> ناموفق بود. می‌توانید دوباره تلاش کنید.`),
      bodyText: "پرداخت سفارش {order_number} ناموفق بود.",
    },
    INAPP: { subject: "پرداخت ناموفق", body: "پرداخت سفارش {order_number} ناموفق بود." },
  },
  ORDER_SHIPPED: {
    SMS: { body: "پیکسوِل\nسفارش {order_number} ارسال شد. {tracking}" },
    INAPP: { subject: "سفارش ارسال شد", body: "سفارش {order_number} ارسال شد." },
    EMAIL: {
      subject: "سفارش {order_number} ارسال شد",
      body: P(`سفارش ${LTR}{order_number}</span> ارسال شد. کد رهگیری: ${LTR}{tracking}</span>`),
      bodyText: "سفارش {order_number} ارسال شد. کد رهگیری: {tracking}",
    },
  },
  ORDER_DELIVERED: {
    SMS: { body: "پیکسوِل\nسفارش {order_number} تحویل داده شد." },
    INAPP: { subject: "سفارش تحویل شد", body: "سفارش {order_number} تحویل داده شد." },
  },
  ORDER_CANCELLED: {
    EMAIL: {
      subject: "سفارش {order_number} لغو شد",
      body: P(`سفارش ${LTR}{order_number}</span> لغو شد.`),
      bodyText: "سفارش {order_number} لغو شد.",
    },
    INAPP: { subject: "سفارش لغو شد", body: "سفارش {order_number} لغو شد." },
  },
  ORDER_REFUNDED: {
    EMAIL: {
      subject: "بازگشت وجه سفارش {order_number}",
      body: P(`مبلغ {amount} برای سفارش ${LTR}{order_number}</span> بازگردانده شد.`),
      bodyText: "مبلغ {amount} برای سفارش {order_number} بازگردانده شد.",
    },
    INAPP: { subject: "بازگشت وجه", body: "بازگشت وجه سفارش {order_number} انجام شد." },
  },
  TICKET_CREATED: {
    EMAIL: {
      subject: "تیکت جدید: {ticket_subject}",
      body: P(`تیکت جدید با موضوع «{ticket_subject}» ثبت شد. شناسه: ${LTR}{ticket_id}</span>`),
      bodyText: "تیکت جدید: {ticket_subject} (شناسه {ticket_id}).",
    },
    INAPP: { subject: "تیکت جدید", body: "تیکت «{ticket_subject}» ثبت شد." },
  },
  TICKET_REPLIED_TO_USER: {
    EMAIL: {
      subject: "پاسخ تیکت: {ticket_subject}",
      body: P("پشتیبانی به تیکت «{ticket_subject}» پاسخ داد."),
      bodyText: "پشتیبانی به تیکت «{ticket_subject}» پاسخ داد.",
    },
    INAPP: { subject: "پاسخ پشتیبانی", body: "پشتیبانی به تیکت «{ticket_subject}» پاسخ داد." },
  },
  TICKET_REPLIED_TO_STAFF: {
    EMAIL: {
      subject: "پاسخ کاربر به تیکت: {ticket_subject}",
      body: P(`کاربر به تیکت «{ticket_subject}» پاسخ داد. شناسه: ${LTR}{ticket_id}</span>`),
      bodyText: "کاربر به تیکت «{ticket_subject}» پاسخ داد.",
    },
    INAPP: { subject: "پاسخ کاربر", body: "کاربر به تیکت «{ticket_subject}» پاسخ داد." },
  },
};

// ─── Rendering ──────────────────────────────────────────────────────────────

/** Replace {var} with its value; empty string for unknown/absent vars. */
function interpolate(text: string, vars: Record<string, string>, escapeValues: boolean): string {
  return text.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v == null) return "";
    return escapeValues ? escapeHtml(v) : v;
  });
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type RenderedMessage = {
  templateId: string | null;
  isPattern: boolean;
  /** EMAIL subject / INAPP+PUSH title (null when none). */
  subject: string | null;
  /** EMAIL HTML (null for non-email). */
  html: string | null;
  /** SMS/INAPP/PUSH body, or EMAIL plaintext. */
  text: string;
};

/** Resolve the DB override (enabled) else the code default; null → skip channel. */
async function resolveTemplate(
  eventKey: CommEventKey,
  channel: CommEventChannel,
): Promise<{ content: TemplateContent; templateId: string | null } | null> {
  try {
    const [row] = await getDb()
      .select()
      .from(commTemplates)
      .where(and(eq(commTemplates.eventKey, eventKey), eq(commTemplates.channel, channel)))
      .limit(1);
    if (row) {
      if (!row.enabled) return null;
      return {
        content: {
          subject: row.subject ?? undefined,
          body: row.body,
          bodyText: row.bodyText ?? undefined,
          isPattern: row.isPattern,
        },
        templateId: row.id,
      };
    }
  } catch (error) {
    console.error("[comms] template lookup failed", eventKey, channel, error);
  }
  const def = DEFAULT_TEMPLATES[eventKey]?.[channel];
  return def ? { content: def, templateId: null } : null;
}

export function renderContent(
  channel: CommEventChannel,
  content: TemplateContent,
  templateId: string | null,
  vars: Record<string, string>,
): RenderedMessage {
  if (channel === "EMAIL") {
    const subject = content.subject ? interpolate(content.subject, vars, false) : null;
    const html = shell(subject ?? "", interpolate(content.body, vars, true));
    const text = interpolate(content.bodyText ?? stripTags(content.body), vars, false);
    return { templateId, isPattern: false, subject, html, text };
  }
  const subject = content.subject ? interpolate(content.subject, vars, false) : null;
  const text = interpolate(content.body, vars, false);
  return { templateId, isPattern: Boolean(content.isPattern), subject, html: null, text };
}

/** One-shot resolve + render. Returns null when no template exists (skip channel). */
export async function resolveAndRender(
  eventKey: CommEventKey,
  channel: CommEventChannel,
  vars: Record<string, string>,
): Promise<RenderedMessage | null> {
  const resolved = await resolveTemplate(eventKey, channel);
  if (!resolved) return null;
  return renderContent(channel, resolved.content, resolved.templateId, vars);
}
