import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getWalletWithLedger, walletReasonLabel } from "@/lib/account/wallet";
import { getCurrentUser } from "@/lib/auth";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RedeemForm } from "./redeem-form";

function faDateTime(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/wallet");
  }

  const { wallet, transactions } = await getWalletWithLedger(user.id);

  return (
    <main className="space-y-6" dir="rtl">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">کیف پول</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          موجودی، تاریخچه تراکنش‌ها و ثبت کارت هدیه.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Balance card */}
        <Card className="justify-between bg-gold/10 p-6 ring-gold/20">
          <div className="flex items-center gap-2 text-gold">
            <WalletIcon className="size-5" />
            <span className="text-sm font-black">موجودی کیف پول</span>
          </div>
          <div className="mt-6">
            <p className="text-4xl font-black text-gold sm:text-5xl">
              {formatToman(wallet.balanceAmount)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              این موجودی هنگام پرداخت سفارش‌ها قابل استفاده است.
            </p>
          </div>
        </Card>

        {/* Redeem gift card */}
        <Card className="p-6">
          <h2 className="font-black">ثبت کارت هدیه</h2>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">
            کد کارت هدیه را وارد کنید تا موجودی آن به کیف پول شما افزوده شود.
          </p>
          <RedeemForm />
        </Card>
      </div>

      {/* Ledger */}
      <Card className="p-0">
        <div className="px-5 pt-5 sm:px-6">
          <h2 className="font-black">تاریخچه تراکنش‌ها</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <WalletIcon className="size-6" />
            </div>
            <div>
              <p className="font-black">هنوز تراکنشی نداری</p>
              <p className="mt-1 text-sm text-muted-foreground">
                با ثبت کارت هدیه یا خرید، تراکنش‌های کیف پول اینجا نمایش داده می‌شود.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {transactions.map((txn) => {
              const isCredit = txn.direction === "CREDIT";
              return (
                <li key={txn.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <div
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full",
                      isCredit
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400",
                    )}
                  >
                    {isCredit ? (
                      <ArrowDownLeft className="size-5" />
                    ) : (
                      <ArrowUpRight className="size-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{walletReasonLabel(txn.reason)}</p>
                    {txn.note ? (
                      <p className="truncate text-xs text-muted-foreground">{txn.note}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {faDateTime(txn.createdAt)}
                    </p>
                  </div>

                  <div className="shrink-0 text-left">
                    <p
                      className={cn(
                        "font-black",
                        isCredit
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                      dir="ltr"
                    >
                      {isCredit ? "+" : "−"}
                      {formatToman(txn.amount)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                      {formatToman(txn.balanceAfter)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
