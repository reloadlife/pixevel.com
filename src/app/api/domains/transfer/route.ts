import { domainRegistrations } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type TransferBody = { domainName?: string; authCode?: string };

/**
 * POST /api/domains/transfer  { domainName, authCode }
 *
 * Records a domain-transfer request for the authenticated user. The EPP/auth
 * code is stored on the registration payload so an operator (or a future
 * registrar integration) can complete the inbound transfer.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "برای انتقال دامنه ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<TransferBody>(request)) ?? {};
  const domainName = (body.domainName ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const authCode = (body.authCode ?? "").trim();

  if (!domainName.includes(".") || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domainName)) {
    return apiError("INVALID_DOMAIN", "نام دامنه معتبر نیست.");
  }
  if (authCode.length < 4) {
    return apiError("INVALID_AUTHCODE", "کد انتقال (EPP) معتبر نیست.");
  }

  if (!rateLimit(`transfer:${clientIp(request)}:${user.id}`, 10, 60_000).ok) {
    return apiError("RATE_LIMITED", "تلاش بیش از حد. کمی بعد دوباره امتحان کنید.", 429);
  }

  const tld = domainName.slice(domainName.indexOf(".") + 1);

  await getDb()
    .insert(domainRegistrations)
    .values({
      userId: user.id,
      domainName,
      tld,
      years: 1,
      status: "PENDING",
      registrarPayload: { transfer: true, authCode },
    });

  return apiOk({ requested: true, domainName });
}
