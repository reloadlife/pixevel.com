import { ProfileError, type ProfileInput, updateProfile } from "@/lib/account";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "برای ویرایش پروفایل ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<ProfileInput>(request)) ?? {};

  try {
    const updated = await updateProfile(user.id, {
      fullName: body.fullName,
      email: body.email,
      defaultAddressLine: body.defaultAddressLine,
      defaultCity: body.defaultCity,
      defaultProvince: body.defaultProvince,
      defaultPostalCode: body.defaultPostalCode,
    });
    return apiOk({ user: updated });
  } catch (error) {
    if (error instanceof ProfileError) {
      if (error.code === "EMAIL_TAKEN") {
        return apiError("EMAIL_TAKEN", "این ایمیل قبلاً ثبت شده است.", 409);
      }
      return apiError("INVALID_EMAIL", "ایمیل وارد شده معتبر نیست.", 400);
    }
    return apiError("INTERNAL", "ذخیره پروفایل ممکن نشد.", 500);
  }
}
