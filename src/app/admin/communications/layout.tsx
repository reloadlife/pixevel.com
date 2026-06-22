import { redirect } from "next/navigation";

import { CommsNav } from "@/components/admin/comms/comms-nav";
import { StatCards } from "@/components/admin/comms/shared";
import { getCurrentUser } from "@/lib/auth";
import { commStats } from "@/lib/comms/queries";

export default async function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin/communications");
  if (user.role !== "ADMIN") redirect("/admin");

  const stats = await commStats();

  return (
    <div className="grid gap-5" dir="rtl">
      <header>
        <h1 className="text-xl font-black">ارتباطات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          گزارش کامل پیامک، تماس، ایمیل و تلگرام — ارسال‌ها، دریافت‌ها، کال‌بک‌ها و کلیدها.
        </p>
      </header>

      <StatCards stats={stats} />
      <CommsNav />

      {children}
    </div>
  );
}
