"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client island for the referral page: shows the user's code and shareable
 * link with copy buttons (and the native share sheet on supporting devices).
 */
export function ShareBox({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(value: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success(which === "code" ? "کد دعوت کپی شد." : "لینک دعوت کپی شد.");
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      toast.error("کپی ممکن نشد. لطفاً دستی کپی کنید.");
    }
  }

  async function share() {
    const data = {
      title: "پیکسِوِل",
      text: "با کد دعوت من در پیکسِوِل ثبت‌نام کن و امتیاز هدیه بگیر:",
      url: link,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(data);
        return;
      } catch {
        // user cancelled or share unsupported — fall back to copy
      }
    }
    void copy(link, "link");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="referral-code">کد دعوت شما</Label>
        <div className="flex gap-2">
          <Input
            id="referral-code"
            dir="ltr"
            readOnly
            value={code}
            className="font-mono text-base font-black tracking-[0.2em] text-gold"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="کپی کد دعوت"
            onClick={() => copy(code, "code")}
          >
            {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="referral-link">لینک دعوت</Label>
        <div className="flex gap-2">
          <Input id="referral-link" dir="ltr" readOnly value={link} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="کپی لینک دعوت"
            onClick={() => copy(link, "link")}
          >
            {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </div>

      <Button type="button" className="w-full sm:w-auto" onClick={share}>
        <Share2 className="size-4" />
        اشتراک‌گذاری دعوت
      </Button>
    </div>
  );
}
