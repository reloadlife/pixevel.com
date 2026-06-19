import { newsletterSubscribers } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";

// Conservative RFC-5322-lite check — good enough to reject obvious garbage
// without over-validating. Real verification happens via the opt-in email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NewsletterBody = { email?: unknown };

/**
 * Newsletter signup. Validates the email and UPSERTs into
 * `newsletter_subscribers`: a fresh address is inserted active; an existing one
 * is reactivated (isActive = true, unsubscribedAt cleared). Idempotent — the
 * contract (POST { email } -> apiOk { email, subscribed }) is stable for the
 * web frontend and a future Android client.
 */
export async function POST(request: Request) {
  const body = await readJson<NewsletterBody>(request);

  if (!body || typeof body.email !== "string") {
    return apiError("INVALID_BODY", "ایمیل ارسال نشده است.", 400);
  }

  const email = body.email.trim().toLowerCase();

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return apiError("INVALID_EMAIL", "ایمیل واردشده معتبر نیست.", 400);
  }

  await getDb()
    .insert(newsletterSubscribers)
    .values({ email, isActive: true, unsubscribedAt: null })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: { isActive: true, unsubscribedAt: null, updatedAt: new Date() },
    });

  return apiOk({ email, subscribed: true });
}
