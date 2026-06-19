"use client";

import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Step = "phone" | "code";

export function AuthPanel({ defaultRedirect = "/" }: { defaultRedirect?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || defaultRedirect;
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setLoading(true);
    setMessage("");
    setDebugCode(null);

    const response = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const result = await response.json();

    setLoading(false);

    if (!result.ok) {
      setMessage(result.error?.message ?? "ارسال کد انجام نشد.");
      return;
    }

    setDebugCode(result.data.debugCode ?? null);
    setMessage("کد تایید ارسال شد.");
    setStep("code");
  }

  async function verifyOtp() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const result = await response.json();

    setLoading(false);

    if (!result.ok) {
      setMessage(result.error?.message ?? "ورود انجام نشد.");
      return;
    }

    router.refresh();
    window.location.href = redirectTo;
  }

  return (
    <div className="w-full border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="mb-6">
        <div className="mb-4 grid size-12 place-items-center bg-foreground text-background">
          {step === "phone" ? <Phone className="size-5" /> : <ShieldCheck className="size-5" />}
        </div>
        <h1 className="text-2xl font-black">ورود با موبایل</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          برای ورود به حساب، شماره موبایل خود را وارد کنید و کد تایید پیامکی را بزنید.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">شماره موبایل</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="09123456789"
            className="h-12 w-full border border-input bg-background px-3 text-left text-base outline-none focus:border-foreground"
            dir="ltr"
            disabled={step === "code"}
          />
        </label>

        {step === "code" ? (
          <label className="block">
            <span className="mb-2 block text-sm font-bold">کد تایید</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              className="h-12 w-full border border-input bg-background px-3 text-center text-2xl font-black tracking-[0.3em] outline-none focus:border-foreground"
              dir="ltr"
            />
          </label>
        ) : null}

        {message ? <p className="text-sm font-medium text-muted-foreground">{message}</p> : null}
        {debugCode ? (
          <p className="border border-dashed border-border p-3 text-sm">
            کد توسعه: <span className="font-black">{debugCode}</span>
          </p>
        ) : null}

        <Button
          className="h-12 w-full text-base font-black"
          onClick={step === "phone" ? requestOtp : verifyOtp}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {step === "phone" ? "دریافت کد" : "ورود"}
        </Button>

        {step === "code" ? (
          <button
            type="button"
            className="w-full text-sm font-bold text-muted-foreground underline underline-offset-4"
            onClick={() => {
              setStep("phone");
              setCode("");
              setMessage("");
            }}
          >
            تغییر شماره
          </button>
        ) : null}
      </div>
    </div>
  );
}
