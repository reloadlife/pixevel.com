"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Reconciles a domain's state from the registrar via POST /sync, then refreshes.
 * When the integration is unconfigured the server still stamps lastSyncedAt and
 * returns `synced:false`; we surface that as a subtle hint.
 */
export function SyncButton({ domainId, className }: { domainId: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function sync() {
    setPending(true);
    const res = await fetch(`/api/account/domains/${domainId}/sync`, { method: "POST" });
    const json = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message ?? "همگام‌سازی ممکن نشد.");
      return;
    }

    if (json.data?.synced === false) {
      toast.success("بررسی انجام شد.", { description: "اتصال به ثبت‌کننده برقرار نیست." });
    } else {
      toast.success("اطلاعات دامنه به‌روزرسانی شد.");
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={sync}
      className={cn("gap-1.5", className)}
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} aria-hidden />
      {pending ? "در حال بررسی…" : "همگام‌سازی"}
    </Button>
  );
}
