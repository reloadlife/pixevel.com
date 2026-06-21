"use client";

import { Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "w-full rounded-2xl border border-transparent bg-input/50 px-2.5 py-2 text-base outline-none transition-[color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export type LinkableOrder = { id: string; orderNumber: string };

export function NewTicket({ orders }: { orders: LinkableOrder[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [subjectFa, setSubjectFa] = useState("");
  const [bodyFa, setBodyFa] = useState("");
  const [orderId, setOrderId] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const res = await fetch("/api/account/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectFa,
        bodyFa,
        orderId: orderId || undefined,
      }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      toast.error(json?.error?.message ?? "ثبت تیکت ممکن نشد.");
      return;
    }

    toast.success("تیکت با موفقیت ثبت شد.");
    const newId = json?.data?.ticket?.id as string | undefined;
    if (newId) {
      router.push(`/account/support/${newId}`);
    } else {
      setOpen(false);
      setSubjectFa("");
      setBodyFa("");
      setOrderId("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        تیکت جدید
      </Button>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="subjectFa">موضوع</Label>
          <Input
            id="subjectFa"
            value={subjectFa}
            onChange={(e) => setSubjectFa(e.target.value)}
            placeholder="مثلاً مشکل در دریافت کد سفارش"
            maxLength={120}
            required
          />
        </div>

        {orders.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="orderId">سفارش مرتبط (اختیاری)</Label>
            <select
              id="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className={cn(FIELD_CLASS, "h-9 appearance-none")}
            >
              <option value="">بدون سفارش</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="bodyFa">متن پیام</Label>
          <textarea
            id="bodyFa"
            value={bodyFa}
            onChange={(e) => setBodyFa(e.target.value)}
            placeholder="مشکل یا پرسش خود را با جزئیات بنویسید…"
            rows={5}
            maxLength={4000}
            required
            className={cn(FIELD_CLASS, "min-h-28 resize-y leading-7")}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            <Send className="size-4" aria-hidden />
            {pending ? "در حال ثبت…" : "ثبت تیکت"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            انصراف
          </Button>
        </div>
      </form>
    </Card>
  );
}
