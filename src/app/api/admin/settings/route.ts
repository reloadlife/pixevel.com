import { z } from "zod";

import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { clearSetting, getSettingsForAdmin, SETTING_KEYS, setSetting } from "@/lib/settings";
import { parseBody } from "@/lib/validate";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  return apiOk({ settings: await getSettingsForAdmin() });
}

const PutSchema = z.object({
  key: z.string().min(1),
  // empty string / null → clear the override (revert to env/default)
  value: z.string().nullable().optional(),
});

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const parsed = await parseBody(request, PutSchema);
  if (!parsed.ok) return parsed.response;

  const { key, value } = parsed.data;
  if (!SETTING_KEYS.has(key)) {
    return apiError("UNKNOWN_SETTING", "کلید تنظیم نامعتبر است.");
  }

  try {
    if (value == null || value === "") {
      await clearSetting(key, admin.id);
    } else {
      await setSetting(key, value, admin.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطا در ذخیره تنظیم.";
    // APP_VAULT_KEY-missing is the only expected failure worth surfacing.
    return apiError(
      "SETTING_SAVE_FAILED",
      message.includes("APP_VAULT_KEY") ? message : "ذخیره ناموفق بود.",
      400,
    );
  }

  return apiOk({ settings: await getSettingsForAdmin() });
}
