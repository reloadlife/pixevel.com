import {
  getVariantStockSummary,
  InventoryError,
  importInventoryCodes,
  listInventoryUnits,
  listInventoryVariantOptions,
  setInventoryUnitStatus,
} from "@/lib/admin/inventory";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

function inventoryErrorResponse(error: unknown) {
  if (error instanceof InventoryError) {
    switch (error.message) {
      case "INVALID_STATUS":
        return apiError("INVALID_STATUS", "تغییر وضعیت مجاز نیست.");
      case "UNIT_NOT_FOUND":
        return apiError("UNIT_NOT_FOUND", "واحد موجودی پیدا نشد.", 404);
      case "UNIT_LOCKED":
        return apiError("UNIT_LOCKED", "این واحد رزرو یا فروخته شده و قابل ویرایش دستی نیست.", 409);
      case "VARIANT_NOT_FOUND":
        return apiError("VARIANT_NOT_FOUND", "تنوع انتخاب‌شده پیدا نشد.", 404);
      default:
        return apiError("INVENTORY_ERROR", "عملیات موجودی انجام نشد.", 500);
    }
  }

  return null;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? undefined;
  const variantId = url.searchParams.get("variantId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const code = url.searchParams.get("code") ?? undefined;
  const pageParam = Number(url.searchParams.get("page"));
  const pageSizeParam = Number(url.searchParams.get("pageSize"));
  const includeOptions = url.searchParams.get("includeOptions") === "1";

  const [list, summary, variantOptions] = await Promise.all([
    listInventoryUnits({
      productId,
      variantId,
      status,
      code,
      page: Number.isFinite(pageParam) ? pageParam : undefined,
      pageSize: Number.isFinite(pageSizeParam) ? pageSizeParam : undefined,
    }),
    getVariantStockSummary({ productId, variantId }),
    includeOptions ? listInventoryVariantOptions() : Promise.resolve(null),
  ]);

  return apiOk({
    units: list.units,
    pagination: list.pagination,
    summary,
    ...(variantOptions ? { variantOptions } : {}),
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<{ unitId?: string; status?: string }>(request);

  if (!body?.unitId || !body.status) {
    return apiError("INVALID_BODY", "شناسه واحد و وضعیت الزامی است.");
  }

  try {
    const unit = await setInventoryUnitStatus(body.unitId, body.status);
    return apiOk({ unit });
  } catch (error) {
    const handled = inventoryErrorResponse(error);

    if (handled) {
      return handled;
    }

    return apiError("INVENTORY_UPDATE_FAILED", "وضعیت واحد ذخیره نشد.", 500);
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<{ variantId?: string; codes?: string[] }>(request);

  if (!body?.variantId || !Array.isArray(body.codes) || body.codes.length === 0) {
    return apiError("INVALID_BODY", "تنوع و حداقل یک کد الزامی است.");
  }

  try {
    const result = await importInventoryCodes(body.variantId, body.codes);
    return apiOk({ result }, { status: 201 });
  } catch (error) {
    const handled = inventoryErrorResponse(error);

    if (handled) {
      return handled;
    }

    return apiError("INVENTORY_IMPORT_FAILED", "وارد کردن کدها انجام نشد.", 500);
  }
}
