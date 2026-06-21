import {
  AddressError,
  type AddressInput,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "@/lib/account/addresses";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH handles two cases:
 *  - { setDefault: true } → promote this address to default (unset others).
 *  - full address payload → update the address fields.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const body = (await readJson<AddressInput & { setDefault?: boolean }>(request)) ?? {};

  try {
    const address =
      body.setDefault === true
        ? await setDefaultAddress(user.id, id)
        : await updateAddress(user.id, id, body);
    return apiOk({ address });
  } catch (error) {
    if (error instanceof AddressError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return apiError(error.code, error.messageFa, status);
    }
    return apiError("INTERNAL", "ویرایش نشانی ممکن نشد.", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;

  try {
    await deleteAddress(user.id, id);
    return apiOk({ deleted: true });
  } catch (error) {
    if (error instanceof AddressError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return apiError(error.code, error.messageFa, status);
    }
    return apiError("INTERNAL", "حذف نشانی ممکن نشد.", 500);
  }
}
