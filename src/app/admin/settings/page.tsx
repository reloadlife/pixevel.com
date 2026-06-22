import { redirect } from "next/navigation";

import { ExchangeRateManagement } from "@/components/admin/exchange-rate-management";
import { SettingsManagement } from "@/components/admin/settings-management";
import { getCurrentUser } from "@/lib/auth";
import { getRatesForAdmin } from "@/lib/pricing/exchange";
import { getSettingsForAdmin } from "@/lib/settings";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/settings");
  }
  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [rates, allSettings] = await Promise.all([getRatesForAdmin(), getSettingsForAdmin()]);
  // SMS/email config now lives in the dedicated /admin/communications hub.
  const settings = allSettings.filter((s) => s.group !== "sms" && s.group !== "email");

  return (
    <div className="grid gap-8" dir="rtl">
      <header>
        <h1 className="text-xl font-black">تنظیمات</h1>
        <p className="mt-1 text-sm text-muted-foreground">پیکربندی فروشگاه.</p>
      </header>

      <section>
        <h2 className="mb-1 font-black">نرخ تبدیل ارز</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          محصولاتی که قیمتشان به دلار یا یورو تعیین شده، با این نرخ به تومان نمایش داده و فروخته
          می‌شوند. با تغییر نرخ، همهٔ قیمت‌های ارزی بلافاصله به‌روز می‌شوند.
        </p>
        <ExchangeRateManagement initialRates={rates} />
      </section>

      <section>
        <h2 className="mb-1 font-black">پیکربندی سرویس‌ها</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          کلیدها و تنظیمات سرویس‌های خارجی (پرداخت، دامنه، سرور و عمومی). مقادیر حساس رمزنگاری‌شده
          ذخیره می‌شوند. اگر خالی بماند، از متغیر محیطی یا پیش‌فرض استفاده می‌شود. تنظیمات پیامک و
          ایمیل به صفحهٔ «ارتباطات» منتقل شده‌اند.
        </p>
        <SettingsManagement initialSettings={settings} />
      </section>
    </div>
  );
}
