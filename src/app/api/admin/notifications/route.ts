import { z } from "zod";

import {
  broadcastNotification,
  listRecentNotifications,
  NotificationBroadcastError,
} from "@/lib/admin/notifications";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

function parseInt10(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Maps domain errors to stable, client-safe Persian messages. */
const BROADCAST_ERRORS: Record<string, { message: string; status: number }> = {
  USER_REQUIRED: { message: "برای ارسال به یک کاربر، کاربر را انتخاب کنید.", status: 400 },
  USER_NOT_FOUND: { message: "کاربر پیدا نشد.", status: 404 },
  TITLE_REQUIRED: { message: "عنوان اعلان الزامی است.", status: 400 },
};

/** Recent sent notifications (audit list), newest first, paginated. */
export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { searchParams } = new URL(request.url);

  const result = await listRecentNotifications({
    page: parseInt10(searchParams.get("page")),
    pageSize: parseInt10(searchParams.get("pageSize")),
  });

  return apiOk(result);
}

const BroadcastSchema = z
  .object({
    target: z.enum(["user", "all"]),
    userId: z.string().uuid().optional(),
    type: z.enum(["PROMO", "SYSTEM"]),
    titleFa: z.string().trim().min(1),
    bodyFa: z.string().trim().optional(),
    href: z.string().trim().optional(),
  })
  .refine((value) => value.target !== "user" || Boolean(value.userId), {
    path: ["userId"],
    message: "userId is required when target is user",
  });

/** Broadcast a notification to one user or all active users. */
export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const parsed = await parseBody(request, BroadcastSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { target, userId, type, titleFa, bodyFa, href } = parsed.data;

  try {
    const result = await broadcastNotification({
      target,
      userId,
      type,
      titleFa,
      bodyFa,
      href,
    });

    return apiOk(result);
  } catch (error) {
    if (error instanceof NotificationBroadcastError) {
      const mapped = BROADCAST_ERRORS[error.code] ?? {
        message: "ارسال اعلان انجام نشد.",
        status: 400,
      };
      return apiError(error.code, mapped.message, mapped.status);
    }
    return apiError("INTERNAL", "خطای داخلی سرور.", 500);
  }
}
