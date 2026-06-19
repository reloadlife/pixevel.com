import { apiError, apiOk, readJson } from "@/lib/api";
import {
  createAdminHomeBlock,
  listAdminHomeBlocks,
  toAdminHomeBlockRow,
  type HomeBlockInput,
} from "@/lib/admin/home-blocks";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const blocks = await listAdminHomeBlocks();

  return apiOk({ blocks: blocks.map(toAdminHomeBlockRow) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<HomeBlockInput>(request);

  if (!body?.titleFa) {
    return apiError("INVALID_BLOCK", "عنوان بلاک الزامی است.");
  }

  try {
    const block = await createAdminHomeBlock(body);
    return apiOk({ block: toAdminHomeBlockRow(block) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TITLE") {
      return apiError("INVALID_TITLE", "عنوان بلاک معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_TYPE") {
      return apiError("INVALID_TYPE", "نوع نمایش بلاک معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_SOURCE") {
      return apiError("INVALID_SOURCE", "منبع محصولات بلاک معتبر نیست.");
    }

    return apiError("HOME_BLOCK_CREATE_FAILED", "بلاک خانه ذخیره نشد.", 500);
  }
}
