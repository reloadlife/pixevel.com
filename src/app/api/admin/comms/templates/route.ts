import { z } from "zod";

import {
  isValidEventChannel,
  listTemplatesForAdmin,
  resetTemplate,
  upsertTemplate,
} from "@/lib/admin/comm-templates";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import type { CommEventChannel } from "@/lib/comms/events";
import { parseBody } from "@/lib/validate";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  return apiOk({ events: await listTemplatesForAdmin() });
}

const PutSchema = z.object({
  action: z.enum(["save", "reset"]),
  eventKey: z.string().min(1),
  channel: z.string().min(1),
  subject: z.string().nullable().optional(),
  body: z.string().optional(),
  bodyText: z.string().nullable().optional(),
  isPattern: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const parsed = await parseBody(request, PutSchema);
  if (!parsed.ok) return parsed.response;
  const d = parsed.data;

  if (!isValidEventChannel(d.eventKey, d.channel)) {
    return apiError("INVALID_TEMPLATE", "رویداد یا کانال نامعتبر است.");
  }
  const channel = d.channel as CommEventChannel;

  if (d.action === "reset") {
    await resetTemplate(d.eventKey, channel);
  } else {
    if (!d.body || d.body.trim() === "") {
      return apiError("EMPTY_BODY", "متن قالب نمی‌تواند خالی باشد.");
    }
    await upsertTemplate({
      eventKey: d.eventKey,
      channel,
      subject: d.subject ?? null,
      body: d.body,
      bodyText: d.bodyText ?? null,
      isPattern: d.isPattern ?? false,
      enabled: d.enabled ?? true,
      userId: admin.id,
    });
  }

  return apiOk({ events: await listTemplatesForAdmin() });
}
