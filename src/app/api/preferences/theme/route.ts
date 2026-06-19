import { cookies } from "next/headers";

import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const THEME_COOKIE = "pixevel_theme";
const THEME_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

type ThemeBody = { theme: string };

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("UNAUTHORIZED", "ابتدا وارد حساب کاربری خود شوید.", 401);
  }

  if (!user.isPremium) {
    return apiError("FORBIDDEN", "این ویژگی فقط برای کاربران ویژه در دسترس است.", 403);
  }

  const body = await readJson<ThemeBody>(request);

  if (!body || (body.theme !== "dark" && body.theme !== "light")) {
    return apiError("INVALID_THEME", "مقدار theme باید dark یا light باشد.", 400);
  }

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, body.theme, {
    path: "/",
    maxAge: THEME_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
  });

  return apiOk({ theme: body.theme });
}
