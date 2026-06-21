"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared "تمدید" (renew) action for a domain or server.
 * `endpoint` is the POST route; on success we toast and refresh the server page.
 */
export function RenewButton({ endpoint, className }: { endpoint: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function renew() {
    setPending(true);
    const res = await fetch(endpoint, { method: "POST" });
    const json = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message ?? "تمدید ممکن نشد.");
      return;
    }

    toast.success("سرویس با موفقیت تمدید شد.");
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={renew}
      className={cn("gap-1.5", className)}
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} aria-hidden />
      {pending ? "در حال تمدید…" : "تمدید"}
    </Button>
  );
}
