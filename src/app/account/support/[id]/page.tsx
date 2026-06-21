import { Headset, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getMyTicketThread, isTicketReplyable, ticketStatusMeta } from "@/lib/account/support";
import { getCurrentUser } from "@/lib/auth";
import { toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import { Reply } from "./reply";

interface PageProps {
  params: Promise<{ id: string }>;
}

function faDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SupportTicketPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirect=/account/support/${id}`);
  }

  const thread = await getMyTicketThread(user.id, id);
  if (!thread) {
    notFound();
  }

  const meta = ticketStatusMeta(thread.status);
  const replyable = isTicketReplyable(thread.status);

  return (
    <main className="text-foreground" dir="rtl">
      <header className="mb-6">
        <Link
          href="/account/support"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          → بازگشت به پشتیبانی
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black sm:text-3xl">{thread.subjectFa}</h1>
          <Badge className={cn("border-0", toneClass(meta.tone))}>{meta.label}</Badge>
        </div>
        {thread.orderNumber ? (
          <p className="mt-2 text-sm text-muted-foreground">
            سفارش مرتبط:{" "}
            <Link
              href={`/account/orders/${thread.orderId}`}
              className="font-mono underline underline-offset-4"
              dir="ltr"
            >
              {thread.orderNumber}
            </Link>
          </p>
        ) : null}
      </header>

      <div className="space-y-3">
        {thread.messages.map((message) => {
          const isStaff = message.isStaff;
          const Icon = isStaff ? Headset : UserRound;
          return (
            <Card
              key={message.id}
              className={cn("p-4", isStaff ? "border-gold/30 bg-gold/5" : "bg-card")}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full",
                    isStaff ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <p className="text-sm font-black">{isStaff ? "پشتیبانی پیسکول" : "شما"}</p>
                <span className="text-xs text-muted-foreground">
                  {faDateTime(message.createdAt)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{message.bodyFa}</p>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        {replyable ? (
          <Reply ticketId={thread.id} />
        ) : (
          <Card className="p-5 text-center text-sm text-muted-foreground">
            این تیکت بسته شده است. برای پیگیری جدید، یک تیکت تازه ثبت کنید.
          </Card>
        )}
      </div>
    </main>
  );
}
