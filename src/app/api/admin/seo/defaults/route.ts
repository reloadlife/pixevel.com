import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getGlobalDefaultsForAdmin, seoGlobalSchema, setGlobalDefaults } from "@/lib/seo/defaults";
import { parseBody } from "@/lib/validate";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const defaults = await getGlobalDefaultsForAdmin();
  return apiOk({ defaults });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const parsed = await parseBody(request, seoGlobalSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const defaults = await setGlobalDefaults(parsed.data, admin.id);
    return apiOk({ defaults });
  } catch {
    return apiError("SEO_DEFAULTS_SAVE_FAILED", "ذخیره تنظیمات پیش‌فرض سئو ناموفق بود.", 500);
  }
}
