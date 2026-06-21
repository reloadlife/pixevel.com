import { ChevronLeft, LifeBuoy, MessageSquare } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listLinkableOrders, listMyTickets, ticketStatusMeta } from "@/lib/account/support";
import { getCurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import { NewTicket } from "./new-ticket";

export const metadata = {
  title: "پشتیبانی",
};

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/support");
  }

  const [tickets, orders] = await Promise.all([
    listMyTickets(user.id),
    listLinkableOrders(user.id),
  ]);

  return (
    <main className="text-foreground" dir="rtl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">پشتیبانی</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          سؤال یا مشکلی دارید؟ تیکت جدید ثبت کنید تا تیم پشتیبانی پاسخ دهد.
          {tickets.length > 0 ? ` (${toFaNumber(tickets.length)} تیکت)` : null}
        </p>
      </header>

      <div className="mb-6">
        <NewTicket orders={orders} />
      </div>

      {tickets.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
            <LifeBuoy className="size-7" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-black">هنوز تیکتی ثبت نکرده‌اید</p>
            <p className="mt-1 text-sm text-muted-foreground">
              برای پیگیری سفارش‌ها یا هر پرسش دیگری، اولین تیکت خود را ایجاد کنید.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {tickets.map((ticket) => {
            const meta = ticketStatusMeta(ticket.status);
            return (
              <Link
                key={ticket.id}
                href={`/account/support/${ticket.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:px-5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <MessageSquare className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black">{ticket.subjectFa}</p>
                    <Badge className={cn("border-0", toneClass(meta.tone))}>{meta.label}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{toFaNumber(ticket.messageCount)} پیام</span>
                    <span aria-hidden>·</span>
                    <span>
                      {ticket.lastMessageAt
                        ? `آخرین پیام ${faDate(ticket.lastMessageAt)}`
                        : faDate(ticket.createdAt)}
                    </span>
                  </div>
                </div>
                <ChevronLeft className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            );
          })}
        </Card>
      )}
    </main>
  );
}
