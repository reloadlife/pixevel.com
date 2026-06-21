import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { type ForeignCurrency, getRatesForAdmin, setExchangeRate } from "@/lib/pricing/exchange";

const CURRENCIES: ForeignCurrency[] = ["USD", "EUR"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }
  return apiOk({ rates: await getRatesForAdmin() });
}

type Body = { currency?: string; rateToman?: number };

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = (await readJson<Body>(request)) ?? {};
  const currency = body.currency as ForeignCurrency;
  const rate = Number(body.rateToman);

  if (!CURRENCIES.includes(currency)) {
    return apiError("INVALID_CURRENCY", "ارز انتخاب‌شده معتبر نیست.");
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return apiError("INVALID_RATE", "نرخ تبدیل باید عددی مثبت باشد.");
  }

  await setExchangeRate(currency, Math.round(rate), admin.id);
  return apiOk({ rates: await getRatesForAdmin() });
}
