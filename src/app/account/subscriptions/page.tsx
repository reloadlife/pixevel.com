import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubscriptionsClient } from "@/components/account/subscriptions-client";
import { getCurrentUser } from "@/lib/auth";
import { listUserSubscriptions } from "@/lib/subscriptions/query";

export const metadata: Metadata = {
  title: "اشتراک‌ها",
  robots: { index: false, follow: false },
};

export default async function SubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/subscriptions");
  }

  const subscriptions = await listUserSubscriptions(user.id);

  return (
    <main className="space-y-6 pb-10">
      <header>
        <h1 className="text-xl font-black">اشتراک‌ها</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          مدیریت اشتراک‌های فعال، تمدید، تمدید خودکار و تاریخچه صورتحساب‌ها.
        </p>
      </header>

      <SubscriptionsClient subscriptions={subscriptions} />
    </main>
  );
}
