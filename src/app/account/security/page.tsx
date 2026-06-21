import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { listActiveSessions } from "@/lib/account/sessions";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SessionRow, type SessionView } from "./session-row";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "امنیت | حساب کاربری",
};

function faDateTime(value: Date): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/security");
  }

  const db = getDb();
  const [account, sessions] = await Promise.all([
    db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, user.id),
      columns: { lastLoginAt: true },
    }),
    listActiveSessions(user.id),
  ]);

  const views: SessionView[] = sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    isCurrent: s.isCurrent,
  }));

  return (
    <main className="space-y-6" dir="rtl">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-black sm:text-3xl">
          <ShieldCheck className="size-6 text-gold" />
          امنیت
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          دستگاه‌هایی که با حساب شما وارد شده‌اند را ببینید و در صورت نیاز نشست آن‌ها را لغو کنید.
        </p>
      </header>

      <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <p className="text-sm font-black">آخرین ورود</p>
          <p className="mt-0.5 text-xs text-muted-foreground">آخرین باری که وارد حساب شدید.</p>
        </div>
        <p className="text-sm font-bold text-muted-foreground">
          {account?.lastLoginAt ? faDateTime(account.lastLoginAt) : "—"}
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-muted-foreground">نشست‌های فعال</h2>

        {views.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
              <ShieldCheck className="size-7" />
            </div>
            <div>
              <p className="text-lg font-black">نشست فعالی یافت نشد</p>
              <p className="mt-1 text-sm text-muted-foreground">
                هیچ نشست فعالی برای حساب شما ثبت نشده است.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {views.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
