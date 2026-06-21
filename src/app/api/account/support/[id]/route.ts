import {
  addUserReply,
  getMyTicketThread,
  isTicketReplyable,
  validateReply,
} from "@/lib/account/support";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/account/support/[id]
 * Returns a single ticket thread (ownership-guarded).
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;

  try {
    const thread = await getMyTicketThread(user.id, id);
    if (!thread) {
      return apiError("TICKET_NOT_FOUND", "تیکت یافت نشد.", 404);
    }

    return apiOk({
      ticket: {
        id: thread.id,
        subjectFa: thread.subjectFa,
        status: thread.status,
        orderId: thread.orderId,
        orderNumber: thread.orderNumber,
        lastMessageAt: thread.lastMessageAt,
        createdAt: thread.createdAt,
      },
      messages: thread.messages.map((m) => ({
        id: m.id,
        isStaff: m.isStaff,
        bodyFa: m.bodyFa,
        createdAt: m.createdAt,
      })),
    });
  } catch {
    return apiError("INTERNAL", "دریافت تیکت ممکن نشد.", 500);
  }
}

type ReplyBody = {
  bodyFa?: string;
};

/**
 * POST /api/account/support/[id]
 * Body `{ bodyFa }` — appends a user reply (isStaff=false) and bumps
 * lastMessageAt. Ownership-guarded.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;

  const body = await readJson<ReplyBody>(request);
  if (!body) {
    return apiError("INVALID_BODY", "اطلاعات ارسالی نامعتبر است.");
  }

  const validated = validateReply(body);
  if (!validated.ok) {
    return apiError(validated.code, validated.message);
  }

  try {
    const thread = await getMyTicketThread(user.id, id);
    if (!thread) {
      return apiError("TICKET_NOT_FOUND", "تیکت یافت نشد.", 404);
    }

    if (!isTicketReplyable(thread.status)) {
      return apiError("TICKET_CLOSED", "این تیکت بسته شده و امکان پاسخ ندارد.", 409);
    }

    const message = await addUserReply({
      ticketId: thread.id,
      userId: user.id,
      bodyFa: validated.value.bodyFa,
      currentStatus: thread.status,
    });

    return apiOk(
      {
        message: {
          id: message.id,
          isStaff: message.isStaff,
          bodyFa: message.bodyFa,
          createdAt: message.createdAt,
        },
      },
      { status: 201 },
    );
  } catch {
    return apiError("INTERNAL", "ثبت پاسخ ممکن نشد.", 500);
  }
}
