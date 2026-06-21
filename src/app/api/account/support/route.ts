import { createTicket, listMyTickets, validateNewTicket } from "@/lib/account/support";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/account/support
 * Returns the authenticated user's support tickets, newest-active first.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  try {
    const tickets = await listMyTickets(user.id);
    return apiOk({
      tickets: tickets.map((t) => ({
        id: t.id,
        subjectFa: t.subjectFa,
        status: t.status,
        orderId: t.orderId,
        messageCount: t.messageCount,
        lastMessageAt: t.lastMessageAt,
        createdAt: t.createdAt,
      })),
    });
  } catch {
    return apiError("INTERNAL", "دریافت تیکت‌ها ممکن نشد.", 500);
  }
}

type CreateTicketBody = {
  subjectFa?: string;
  bodyFa?: string;
  orderId?: string;
};

/**
 * POST /api/account/support
 * Body `{ subjectFa, bodyFa, orderId? }` — creates a ticket plus its first
 * message and stamps lastMessageAt.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = await readJson<CreateTicketBody>(request);
  if (!body) {
    return apiError("INVALID_BODY", "اطلاعات ارسالی نامعتبر است.");
  }

  const validated = validateNewTicket(body);
  if (!validated.ok) {
    return apiError(validated.code, validated.message);
  }

  try {
    const ticket = await createTicket({
      userId: user.id,
      subjectFa: validated.value.subjectFa,
      bodyFa: validated.value.bodyFa,
      orderId: validated.value.orderId,
    });

    return apiOk(
      {
        ticket: {
          id: ticket.id,
          subjectFa: ticket.subjectFa,
          status: ticket.status,
          orderId: ticket.orderId,
          lastMessageAt: ticket.lastMessageAt,
          createdAt: ticket.createdAt,
        },
      },
      { status: 201 },
    );
  } catch {
    return apiError("INTERNAL", "ثبت تیکت ممکن نشد.", 500);
  }
}
