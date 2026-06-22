import { z } from "zod";

import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { sendTestSms } from "@/lib/comms/send";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validate";

const TestSchema = z.object({
  phone: z.string().min(1),
  text: z.string().min(1).max(400),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  if (!rateLimit(`comms-test:${clientIp(request)}`, 5, 60_000).ok) {
    return apiError("RATE_LIMITED", "تلاش بیش از حد. کمی بعد دوباره تلاش کنید.", 429);
  }

  const parsed = await parseBody(request, TestSchema);
  if (!parsed.ok) return parsed.response;

  const phone = normalizeIranPhone(parsed.data.phone);
  if (!isValidIranPhone(phone)) {
    return apiError("INVALID_PHONE", "شماره موبایل معتبر نیست.");
  }

  const result = await sendTestSms(phone, parsed.data.text);
  return apiOk({ status: result.status, message: result.message });
}
