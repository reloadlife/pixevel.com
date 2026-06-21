import { z } from "zod";

import { supportTicketStatus } from "@/db/schema";
import { adminReplyToTicket, getAdminTicket, setTicketStatus } from "@/lib/admin/support";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

const ReplySchema = z.object({
  bodyFa: z.string().trim().min(1).max(4000),
});

const StatusSchema = z.object({
  status: z.enum(supportTicketStatus.enumValues),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await params;
  const ticket = await getAdminTicket(id);

  if (!ticket) {
    return apiError("TICKET_NOT_FOUND", "تیکت پیدا نشد.", 404);
  }

  return apiOk({ ticket });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await params;
  const parsed = await parseBody(request, ReplySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const ticket = await adminReplyToTicket(admin.id, id, parsed.data.bodyFa);

  if (!ticket) {
    return apiError("TICKET_NOT_FOUND", "تیکت پیدا نشد.", 404);
  }

  return apiOk({ ticket });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await params;
  const parsed = await parseBody(request, StatusSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const ticket = await setTicketStatus(id, parsed.data.status);

  if (!ticket) {
    return apiError("TICKET_NOT_FOUND", "تیکت پیدا نشد.", 404);
  }

  return apiOk({ ticket });
}
