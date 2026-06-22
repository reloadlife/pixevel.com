import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { commStats } from "@/lib/comms/queries";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  return apiOk({ stats: await commStats() });
}
