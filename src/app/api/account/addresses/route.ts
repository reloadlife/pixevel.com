import {
  AddressError,
  type AddressInput,
  createAddress,
  listAddresses,
} from "@/lib/account/addresses";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const addresses = await listAddresses(user.id);
  return apiOk({ addresses });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<AddressInput>(request)) ?? {};

  try {
    const address = await createAddress(user.id, body);
    return apiOk({ address }, { status: 201 });
  } catch (error) {
    if (error instanceof AddressError) {
      return apiError(error.code, error.messageFa, 400);
    }
    return apiError("INTERNAL", "ثبت نشانی ممکن نشد.", 500);
  }
}
