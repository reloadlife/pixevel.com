import { apiError, apiOk, readJson } from "@/lib/api";
import {
  createAdminTag,
  listAdminTags,
  toAdminTagOption,
} from "@/lib/admin/taxonomy";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const tags = await listAdminTags();

  return apiOk({ tags: tags.map(toAdminTagOption) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<Parameters<typeof createAdminTag>[0]>(request);

  if (!body?.titleFa) {
    return apiError("INVALID_TAG", "نام تگ الزامی است.");
  }

  try {
    const tag = await createAdminTag(body);
    return apiOk({ tag: toAdminTagOption(tag) }, { status: 201 });
  } catch {
    return apiError("TAG_CREATE_FAILED", "تگ ذخیره نشد.", 500);
  }
}
