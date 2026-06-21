"use client";

import { Gift, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RedeemForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("کد کارت هدیه را وارد کنید.");
      return;
    }

    setPending(true);
    setError(null);

    const res = await fetch("/api/account/wallet/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmed }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "ثبت کارت هدیه ممکن نشد.");
      return;
    }

    setCode("");
    toast.success("کارت هدیه با موفقیت به کیف پول افزوده شد.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="giftcard">کد کارت هدیه</Label>
        <Input
          id="giftcard"
          dir="ltr"
          autoComplete="off"
          placeholder="XXXX-XXXX-XXXX"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) {
              setError(null);
            }
          }}
          className="font-mono tracking-wider"
        />
      </div>

      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            در حال ثبت…
          </>
        ) : (
          <>
            <Gift className="size-4" />
            افزودن به کیف پول
          </>
        )}
      </Button>
    </form>
  );
}
