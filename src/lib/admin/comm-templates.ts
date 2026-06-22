import "server-only";

import { and, eq } from "drizzle-orm";

import { commTemplates } from "@/db/schema";
import {
  type CommEventChannel,
  type CommEventKey,
  EVENT_LIST,
  isCommEventKey,
} from "@/lib/comms/events";
import { DEFAULT_TEMPLATES } from "@/lib/comms/templates";
import { getDb } from "@/lib/db";

/**
 * Admin view + CRUD over message templates. Each (event × channel) cell is
 * either a DB override ("custom") or the seeded code default ("default").
 */

export type AdminTemplateCell = {
  eventKey: CommEventKey;
  channel: CommEventChannel;
  source: "custom" | "default";
  enabled: boolean;
  subject: string | null;
  body: string;
  bodyText: string | null;
  isPattern: boolean;
  updatedAt: string | null;
};

export type AdminTemplateEvent = {
  key: CommEventKey;
  labelFa: string;
  variables: string[];
  channels: CommEventChannel[];
  cells: AdminTemplateCell[];
};

const VALID_CHANNELS = new Set<CommEventChannel>(["EMAIL", "SMS", "INAPP", "PUSH"]);

export function isCommEventChannel(value: string): value is CommEventChannel {
  return VALID_CHANNELS.has(value as CommEventChannel);
}

export async function listTemplatesForAdmin(): Promise<AdminTemplateEvent[]> {
  const rows = await getDb().select().from(commTemplates);
  const byKey = new Map(rows.map((r) => [`${r.eventKey}:${r.channel}`, r]));

  return EVENT_LIST.map((def) => ({
    key: def.key,
    labelFa: def.labelFa,
    variables: def.variables,
    channels: def.channels,
    cells: def.channels.map((channel): AdminTemplateCell => {
      const row = byKey.get(`${def.key}:${channel}`);
      if (row) {
        return {
          eventKey: def.key,
          channel,
          source: "custom",
          enabled: row.enabled,
          subject: row.subject,
          body: row.body,
          bodyText: row.bodyText,
          isPattern: row.isPattern,
          updatedAt: row.updatedAt?.toISOString() ?? null,
        };
      }
      const d = DEFAULT_TEMPLATES[def.key]?.[channel];
      return {
        eventKey: def.key,
        channel,
        source: "default",
        enabled: true,
        subject: d?.subject ?? null,
        body: d?.body ?? "",
        bodyText: d?.bodyText ?? null,
        isPattern: d?.isPattern ?? false,
        updatedAt: null,
      };
    }),
  }));
}

export type UpsertTemplateInput = {
  eventKey: string;
  channel: CommEventChannel;
  subject: string | null;
  body: string;
  bodyText: string | null;
  isPattern: boolean;
  enabled: boolean;
  userId?: string | null;
};

/** Validates the event/channel pair is real before writing. */
export function isValidEventChannel(eventKey: string, channel: string): boolean {
  if (!isCommEventKey(eventKey) || !isCommEventChannel(channel)) return false;
  return EVENT_LIST.find((e) => e.key === eventKey)?.channels.includes(channel) ?? false;
}

export async function upsertTemplate(input: UpsertTemplateInput): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(commTemplates)
    .values({
      eventKey: input.eventKey,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      bodyText: input.bodyText,
      isPattern: input.isPattern,
      enabled: input.enabled,
      updatedByUserId: input.userId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [commTemplates.eventKey, commTemplates.channel],
      set: {
        subject: input.subject,
        body: input.body,
        bodyText: input.bodyText,
        isPattern: input.isPattern,
        enabled: input.enabled,
        updatedByUserId: input.userId ?? null,
        updatedAt: now,
      },
    });
}

/** Remove the DB override → the channel falls back to the code default. */
export async function resetTemplate(eventKey: string, channel: CommEventChannel): Promise<void> {
  await getDb()
    .delete(commTemplates)
    .where(and(eq(commTemplates.eventKey, eventKey), eq(commTemplates.channel, channel)));
}
