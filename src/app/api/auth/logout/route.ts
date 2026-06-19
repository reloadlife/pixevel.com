import { apiOk } from "@/lib/api";
import { destroyCurrentSession } from "@/lib/session";

export async function POST() {
  await destroyCurrentSession();
  return apiOk({ loggedOut: true });
}
