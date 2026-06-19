import { apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  return apiOk({ user: await getCurrentUser() });
}
