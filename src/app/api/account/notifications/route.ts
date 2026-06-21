import {
  getNotificationsOverview,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/account/notifications";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/account/notifications
 * Returns the user's notifications (newest first) plus the unread count.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  try {
    const overview = await getNotificationsOverview(user.id);

    return apiOk({
      unreadCount: overview.unreadCount,
      notifications: overview.notifications.map((n) => ({
        id: n.id,
        type: n.type,
        titleFa: n.titleFa,
        bodyFa: n.bodyFa,
        href: n.href,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    });
  } catch {
    return apiError("INTERNAL", "دریافت اعلان‌ها ممکن نشد.", 500);
  }
}

type MarkReadBody = {
  id?: string;
  all?: boolean;
};

/**
 * PATCH /api/account/notifications
 * Body `{ all: true }` marks every notification read; body `{ id }` marks one.
 * Returns the resulting unread count so clients can refresh badges.
 */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = await readJson<MarkReadBody>(request);
  if (!body || (!body.all && !body.id)) {
    return apiError("INVALID_INPUT", "شناسه اعلان یا گزینه «همه» را مشخص کنید.", 400);
  }

  try {
    if (body.all) {
      await markAllNotificationsRead(user.id);
    } else if (body.id) {
      const ok = await markNotificationRead(user.id, body.id);
      if (!ok) {
        // Idempotent: already read or not found for this user — not an error,
        // but surface a clear code so clients can decide what to do.
        const overview = await getNotificationsOverview(user.id);
        return apiOk({ unreadCount: overview.unreadCount, updated: false });
      }
    }

    const overview = await getNotificationsOverview(user.id);
    return apiOk({ unreadCount: overview.unreadCount, updated: true });
  } catch {
    return apiError("INTERNAL", "به‌روزرسانی اعلان‌ها ممکن نشد.", 500);
  }
}
