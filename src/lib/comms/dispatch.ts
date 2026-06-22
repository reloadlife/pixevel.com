import "server-only";

import { eq } from "drizzle-orm";

import { notificationPreferences, users } from "@/db/schema";
import { createNotification } from "@/lib/account/notifications";
import { recordOutbound } from "@/lib/comms/record";
import { sendEmailLogged } from "@/lib/comms/send";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { resolveProviderForChannel } from "@/lib/sms/providers";
import { type CommEventChannel, type CommEventKey, EVENTS } from "./events";
import { resolveAndRender } from "./templates";

/**
 * The single entrypoint for event-driven communications. Resolves the recipient
 * + their preferences, renders each enabled channel's template, sends via the
 * existing logged senders, and records every channel to the ledger.
 *
 * NEVER throws — a missing template, unconfigured provider, or DB hiccup degrades
 * to "skip channel". Call it AFTER the surrounding DB transaction commits.
 */

export type NotifyRecipient = {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  orderId?: string | null;
};

type PrefRow = typeof notificationPreferences.$inferSelect;

async function getPrefs(userId: string): Promise<PrefRow | null> {
  const db = getDb();
  const find = () =>
    db.query.notificationPreferences.findFirst({ where: (p, { eq: e }) => e(p.userId, userId) });
  let row = await find();
  if (!row) {
    await db
      .insert(notificationPreferences)
      .values({ userId })
      .onConflictDoNothing({ target: notificationPreferences.userId });
    row = await find();
  }
  return row ?? null;
}

/** Email/SMS honor the order/promo toggles; in-app/push are not gated by those in Phase 1. */
export function channelAllowed(
  channel: CommEventChannel,
  prefGate: "order" | "promo" | null,
  prefs: PrefRow | null,
): boolean {
  if (!prefGate || !prefs) return true;
  if (prefGate === "order") {
    if (channel === "EMAIL") return prefs.orderEmail;
    if (channel === "SMS") return prefs.orderSms;
    return true;
  }
  if (channel === "EMAIL") return prefs.promoEmail;
  if (channel === "SMS") return prefs.promoSms;
  return true;
}

async function adminUserIds(): Promise<string[]> {
  const rows = await getDb().select({ id: users.id }).from(users).where(eq(users.role, "ADMIN"));
  return rows.map((r) => r.id);
}

export async function notify(
  eventKey: CommEventKey,
  recipient: NotifyRecipient,
  vars: Record<string, string>,
): Promise<void> {
  try {
    const def = EVENTS[eventKey];
    if (!def) return;

    const staff = def.audience === "staff";
    const email = staff
      ? ((await getSetting("OPS_NOTIFY_EMAIL")) ?? null)
      : (recipient.email ?? null);
    const phone = staff ? null : (recipient.phone ?? null);
    const inappUserIds = staff ? await adminUserIds() : recipient.userId ? [recipient.userId] : [];

    const prefs = !staff && recipient.userId ? await getPrefs(recipient.userId) : null;
    const href = vars.href ?? null;

    for (const channel of def.channels) {
      if (!staff && !channelAllowed(channel, def.prefGate, prefs)) continue;

      const rendered = await resolveAndRender(eventKey, channel, vars);
      if (!rendered) continue;

      try {
        if (channel === "EMAIL") {
          if (!email) continue;
          await sendEmailLogged(
            {
              to: email,
              subject: rendered.subject ?? def.labelFa,
              html: rendered.html ?? rendered.text,
              text: rendered.text,
            },
            {
              userId: recipient.userId ?? null,
              orderId: recipient.orderId ?? null,
              kind: "EVENT",
              eventKey,
              templateId: rendered.templateId,
            },
          );
        } else if (channel === "SMS") {
          if (!phone) continue;
          const { provider, id } = await resolveProviderForChannel("sms");
          const res = await provider.sendText(phone, rendered.text);
          await recordOutbound({
            channel: "SMS",
            provider: id,
            kind: "EVENT",
            toAddress: phone,
            body: rendered.text,
            status: res.status,
            message: res.message,
            payload: res.payload,
            userId: recipient.userId ?? null,
            orderId: recipient.orderId ?? null,
            eventKey,
            templateId: rendered.templateId,
          });
        } else if (channel === "INAPP") {
          for (const uid of inappUserIds) {
            await createNotification({
              userId: uid,
              type: def.notificationType,
              titleFa: rendered.subject ?? def.labelFa,
              bodyFa: rendered.text,
              href,
            });
            await recordOutbound({
              channel: "INAPP",
              provider: "inapp",
              kind: "EVENT",
              toAddress: uid,
              body: rendered.text,
              status: "sent",
              userId: uid,
              orderId: recipient.orderId ?? null,
              eventKey,
              templateId: rendered.templateId,
            });
          }
        }
        // PUSH: deferred follow-up.
      } catch (channelErr) {
        console.error("[comms] channel send failed", eventKey, channel, channelErr);
      }
    }
  } catch (error) {
    console.error("[comms] notify failed", eventKey, error);
  }
}
