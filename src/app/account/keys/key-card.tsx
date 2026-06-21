"use client";

import { Check, Copy, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KeyCardKey = {
  id: string;
  code: string;
};

export type KeyCardProduct = {
  variantId: string;
  titleFa: string;
  variantFa: string | null;
  keys: KeyCardKey[];
};

export type KeyCardOrder = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  keyCount: number;
  hasEmail: boolean;
  products: KeyCardProduct[];
};

function faDate(value: string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Mask a code, keeping only the last 4 chars visible as a hint. */
function maskCode(code: string): string {
  if (code.length <= 4) {
    return "•".repeat(code.length);
  }
  return `${"•".repeat(Math.max(4, code.length - 4))}${code.slice(-4)}`;
}

function CodeRow({ code }: { code: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("کد کپی شد.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی کد ممکن نشد.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-xs tracking-wide",
          !revealed && "select-none text-muted-foreground",
        )}
        dir="ltr"
      >
        {revealed ? code : maskCode(code)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "پنهان کردن کد" : "نمایش کد"}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={copy}
          aria-label="کپی کد"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function KeyCard({ order }: { order: KeyCardOrder }) {
  const [resending, setResending] = useState(false);

  async function resend() {
    setResending(true);
    try {
      const res = await fetch("/api/account/keys/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "ارسال مجدد کدها ممکن نشد.");
        return;
      }
      toast.success("کدها دوباره به ایمیل شما ارسال شد.");
    } catch {
      toast.error("ارسال مجدد کدها ممکن نشد.");
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/account/orders/${order.orderId}`}
              className="font-mono text-sm font-black underline-offset-4 hover:underline"
              dir="ltr"
            >
              {order.orderNumber}
            </Link>
            <Badge className="border-0 bg-gold/15 text-gold">
              <KeyRound className="ms-0.5 size-3" />
              {order.keyCount} کد
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{faDate(order.createdAt)}</p>
        </div>
        {order.hasEmail ? (
          <Button type="button" size="sm" variant="outline" onClick={resend} disabled={resending}>
            <Mail className="size-4" />
            {resending ? "در حال ارسال…" : "ارسال مجدد به ایمیل"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {order.products.map((product) => (
          <div key={product.variantId}>
            <p className="text-sm font-bold">{product.titleFa}</p>
            {product.variantFa ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{product.variantFa}</p>
            ) : null}
            <div className="mt-2 space-y-2">
              {product.keys.map((key) => (
                <CodeRow key={key.id} code={key.code} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
