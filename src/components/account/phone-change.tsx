"use client";

import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "idle" | "phone" | "code";

export function PhoneChange({ currentPhone }: { currentPhone: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("idle");
    setPhone("");
    setCode("");
    setError(null);
  }

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/account/phone/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "ارسال کد ممکن نشد.");
      return;
    }
    if (json?.data?.debugCode) {
      toast.message(`کد تست: ${json.data.debugCode}`);
    }
    setStep("code");
    toast.success("کد تأیید به شماره جدید ارسال شد.");
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/account/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "تأیید کد ممکن نشد.");
      return;
    }
    toast.success("شماره موبایل با موفقیت تغییر کرد.");
    reset();
    router.refresh();
  }

  if (step === "idle") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">شماره موبایل</p>
          <p className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
            {currentPhone ?? "—"}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setStep("phone")}>
          <Phone className="size-4" aria-hidden />
          تغییر شماره
        </Button>
      </div>
    );
  }

  if (step === "phone") {
    return (
      <form onSubmit={requestOtp} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="newPhone">شماره موبایل جدید</Label>
          <Input
            id="newPhone"
            dir="ltr"
            inputMode="numeric"
            placeholder="09xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">یک کد تأیید به شماره جدید پیامک می‌شود.</p>
        </div>
        {error ? <p className="text-sm font-bold text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "در حال ارسال…" : "ارسال کد"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            انصراف
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="otpCode">کد تأیید</Label>
        <Input
          id="otpCode"
          dir="ltr"
          inputMode="numeric"
          maxLength={6}
          placeholder="------"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
        <p className="text-xs text-muted-foreground" dir="ltr">
          {phone}
        </p>
      </div>
      {error ? <p className="text-sm font-bold text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "در حال تأیید…" : "تأیید و تغییر شماره"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep("phone")}>
          ویرایش شماره
        </Button>
      </div>
    </form>
  );
}
