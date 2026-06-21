"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "w-full rounded-2xl border border-transparent bg-input/50 px-2.5 py-2 text-base outline-none transition-[color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function Reply({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [bodyFa, setBodyFa] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (bodyFa.trim().length === 0) {
      return;
    }
    setPending(true);

    const res = await fetch(`/api/account/support/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyFa }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      toast.error(json?.error?.message ?? "ثبت پاسخ ممکن نشد.");
      return;
    }

    setBodyFa("");
    toast.success("پاسخ شما ثبت شد.");
    router.refresh();
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="space-y-3">
        <Label htmlFor="reply">پاسخ شما</Label>
        <textarea
          id="reply"
          value={bodyFa}
          onChange={(e) => setBodyFa(e.target.value)}
          placeholder="پاسخ خود را بنویسید…"
          rows={4}
          maxLength={4000}
          required
          className={cn(FIELD_CLASS, "min-h-24 resize-y leading-7")}
        />
        <div className="flex justify-start">
          <Button type="submit" disabled={pending || bodyFa.trim().length === 0}>
            <Send className="size-4" aria-hidden />
            {pending ? "در حال ارسال…" : "ارسال پاسخ"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
