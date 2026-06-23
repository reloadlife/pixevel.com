import { shippingMethodErrorResponse } from "@/app/api/admin/shipping-methods/route";
import {
  deleteShippingMethod,
  type ShippingMethodPatchInput,
  toAdminShippingMethodOption,
  updateShippingMethod,
} from "@/lib/admin/shipping-methods";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<ShippingMethodPatchInput>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const row = await updateShippingMethod(id, body);
    return apiOk({ row: toAdminShippingMethodOption(row) });
  } catch (error) {
    return shippingMethodErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;

  try {
    await deleteShippingMethod(id);
    return apiOk({ deleted: true });
  } catch (error) {
    return shippingMethodErrorResponse(error);
  }
}
