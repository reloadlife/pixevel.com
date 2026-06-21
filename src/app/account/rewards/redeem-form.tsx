"use client";

import { Coins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatToman, toFaNumber } from "@/lib/format";

export function RedeemForm({
  pointsBalance,
  minRedeem,
  pointValueToman,
}: {
  pointsBalance: number;
  minRedeem: number;
  pointValueToman: number;
}) {
  const router = useRouter();
  const [points, setPoints] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(points);
  const valid =
    Number.isFinite(parsed) && parsed >= minRedeem && parsed <= pointsBalance && parsed > 0;
  const creditPreview = valid ? parsed * pointValueToman : 0;
  const canRedeem = pointsBalance >= minRedeem;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) {
      return;
    }
    setPending(true);
    setError(null);

    const res = await fetch("/api/account/loyalty/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: Math.floor(parsed) }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok || !json?.ok) {
      const message = json?.error?.message ?? "تبدیل امتیاز ممکن نشد.";
      setError(message);
      toast.error(message);
      return;
    }

    setPoints("");
    toast.success(
      `${toFaNumber(json.data.pointsRedeemed)} امتیاز به ${formatToman(
        json.data.walletCreditToman,
      )} اعتبار کیف پول تبدیل شد.`,
    );
    router.refresh();
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Coins className="size-5 text-gold" aria-hidden />
        <h2 className="text-base font-black">تبدیل امتیاز به اعتبار کیف پول</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        هر {toFaNumber(1)} امتیاز معادل {formatToman(pointValueToman)} اعتبار است. حداقل تبدیل{" "}
        {toFaNumber(minRedeem)} امتیاز.
      </p>

      {canRedeem ? (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="points">تعداد امتیاز</Label>
            <Input
              id="points"
              dir="ltr"
              inputMode="numeric"
              placeholder={String(minRedeem)}
              value={points}
              onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>موجودی: {toFaNumber(pointsBalance)} امتیاز</span>
              <button
                type="button"
                className="font-bold text-gold underline-offset-2 hover:underline"
                onClick={() => setPoints(String(pointsBalance))}
              >
                استفاده از همه
              </button>
            </div>
          </div>

          {creditPreview > 0 ? (
            <div className="rounded-lg bg-gold/15 px-4 py-3 text-sm font-bold text-gold">
              اعتبار دریافتی: {formatToman(creditPreview)}
            </div>
          ) : null}

          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

          <Button type="submit" disabled={!valid || pending} className="w-full sm:w-auto">
            {pending ? "در حال تبدیل…" : "تبدیل به اعتبار"}
          </Button>
        </form>
      ) : (
        <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          برای تبدیل امتیاز، حداقل {toFaNumber(minRedeem)} امتیاز نیاز دارید. با هر خرید امتیاز جمع
          کنید.
        </p>
      )}
    </Card>
  );
}
