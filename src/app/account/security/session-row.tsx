"use client";

import { LogOut, Monitor, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SessionView = {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

function faDateTime(value: string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function SessionRow({ session }: { session: SessionView }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function revoke() {
    setPending(true);
    try {
      const res = await fetch(`/api/account/sessions/${session.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "لغو نشست ممکن نشد.");
        setPending(false);
        return;
      }

      if (json?.data?.wasCurrent) {
        toast.success("از این دستگاه خارج شدید.");
        router.push("/login");
        router.refresh();
        return;
      }

      toast.success("نشست لغو شد.");
      router.refresh();
    } catch {
      toast.error("لغو نشست ممکن نشد.");
      setPending(false);
    }
  }

  return (
    <Card
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 p-4",
        session.isCurrent && "border-gold/40 bg-gold/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            session.isCurrent ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground",
          )}
        >
          {session.isCurrent ? <ShieldCheck className="size-5" /> : <Monitor className="size-5" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">{session.isCurrent ? "این دستگاه" : "نشست فعال"}</p>
            {session.isCurrent ? (
              <Badge className="border-0 bg-gold/15 text-gold">فعلی</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ورود از {faDateTime(session.createdAt)}
          </p>
          <p className="text-xs text-muted-foreground">اعتبار تا {faDateTime(session.expiresAt)}</p>
        </div>
      </div>

      <Button type="button" size="sm" variant="outline" onClick={revoke} disabled={pending}>
        <LogOut className="size-4" />
        {pending ? "در حال لغو…" : session.isCurrent ? "خروج از این دستگاه" : "لغو نشست"}
      </Button>
    </Card>
  );
}
