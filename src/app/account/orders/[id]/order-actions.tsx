"use client";

import { Ban, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  orderId: string;
  cancellable: boolean;
};

export function OrderActions({ orderId, cancellable }: Props) {
  const router = useRouter();
  const [reordering, setReordering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function reorder() {
    setReordering(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(json?.error?.message ?? "افزودن به سبد خرید ممکن نشد.");
        return;
      }
      const { added, skipped } = json.data as { added: number; skipped: number };
      if (skipped > 0) {
        toast.success(
          `${added.toLocaleString("fa-IR")} کالا به سبد اضافه شد. ${skipped.toLocaleString("fa-IR")} کالا دیگر قابل خرید نبود.`,
        );
      } else {
        toast.success("کالاهای سفارش به سبد خرید اضافه شد.");
      }
      router.push("/basket");
      router.refresh();
    } finally {
      setReordering(false);
    }
  }

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(json?.error?.message ?? "لغو سفارش ممکن نشد.");
        return;
      }
      toast.success("سفارش لغو شد.");
      setConfirmingCancel(false);
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={reorder} disabled={reordering}>
        {reordering ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        خرید دوباره
      </Button>

      {cancellable ? (
        confirmingCancel ? (
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={cancel} disabled={cancelling}>
              {cancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              تأیید لغو
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmingCancel(false)}
              disabled={cancelling}
            >
              انصراف
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirmingCancel(true)}>
            <Ban className="size-4" />
            لغو سفارش
          </Button>
        )
      ) : null}
    </div>
  );
}
