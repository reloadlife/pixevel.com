"use client";

import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Step = "phone" | "code";

const OTP_COOLDOWN_SECONDS = 60;

export function AuthPanel({ defaultRedirect = "/" }: { defaultRedirect?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || defaultRedirect;
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown() {
    setCooldownRemaining(OTP_COOLDOWN_SECONDS);

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }

    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  function formatCooldown(seconds: number) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function requestOtp(method: "sms" | "call" = "sms") {
    setLoading(true);
    setMessage("");
    setIsError(false);
    setDebugCode(null);

    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, method }),
      });
      const result = await response.json();

      if (!result.ok) {
        setIsError(true);
        setMessage(result.error?.message ?? "ارسال کد انجام نشد.");
        return;
      }

      setDebugCode(result.data.debugCode ?? null);
      setIsError(false);
      setMessage(method === "call" ? "تماس برقرار می‌شود؛ کد را بشنوید." : "کد تایید پیامک شد.");
      setStep("code");
      startCooldown();
    } catch {
      setIsError(true);
      setMessage("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const result = await response.json();

      if (!result.ok) {
        setIsError(true);
        setMessage(result.error?.message ?? "ورود انجام نشد.");
        return;
      }

      router.refresh();
      window.location.href = redirectTo;
    } catch {
      setIsError(true);
      setMessage("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  const resendDisabled = loading || cooldownRemaining > 0;

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
            autoComplete="tel"
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
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="------"
              className="h-12 w-full border border-input bg-background px-3 text-center text-2xl font-black tracking-[0.3em] outline-none focus:border-foreground"
              dir="ltr"
            />
          </label>
        ) : null}

        {message ? (
          <p
            className={`text-sm font-medium ${isError ? "text-destructive" : "text-muted-foreground"}`}
          >
            {message}
          </p>
        ) : null}
        {debugCode ? (
          <p className="border border-dashed border-border p-3 text-sm">
            کد توسعه: <span className="font-black">{debugCode}</span>
          </p>
        ) : null}

        <Button
          className="h-12 w-full text-base font-black"
          onClick={step === "phone" ? () => requestOtp("sms") : verifyOtp}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {step === "phone" ? "دریافت کد" : "ورود"}
        </Button>

        {step === "code" ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="text-sm font-bold text-muted-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => requestOtp("call")}
              disabled={resendDisabled}
            >
              {cooldownRemaining > 0
                ? `ارسال مجدد تا ${formatCooldown(cooldownRemaining)}`
                : "دریافت کد با تماس"}
            </button>
            <button
              type="button"
              className="text-sm font-bold text-muted-foreground underline underline-offset-4"
              onClick={() => {
                setStep("phone");
                setCode("");
                setMessage("");
                setIsError(false);
                if (cooldownTimerRef.current) {
                  clearInterval(cooldownTimerRef.current);
                  cooldownTimerRef.current = null;
                }
                setCooldownRemaining(0);
              }}
            >
              تغییر شماره
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
