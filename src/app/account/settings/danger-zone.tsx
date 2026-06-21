"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM_WORD = "حذف";

export function DangerZone() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        toast.error("دریافت اطلاعات ممکن نشد.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pixevel-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("فایل اطلاعات شما دانلود شد.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (!res.ok) {
      setDeleting(false);
      toast.error("حذف حساب ممکن نشد.");
      return;
    }
    toast.success("حساب شما حذف شد.");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">دریافت اطلاعات حساب</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            دانلود کامل اطلاعات حساب، سفارش‌ها و پرداخت‌ها به‌صورت فایل JSON.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={exporting} onClick={exportData}>
          {exporting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          دریافت داده‌ها
        </Button>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-black text-destructive">حذف حساب کاربری</p>
        <p className="mt-1 text-xs text-muted-foreground">
          با حذف حساب، دسترسی شما به سفارش‌ها، کیف پول و امتیازها از بین می‌رود. این عمل قابل بازگشت
          نیست.
        </p>

        {confirming ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="confirmDelete">برای تأیید، کلمهٔ «{CONFIRM_WORD}» را وارد کنید</Label>
              <Input
                id="confirmDelete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting || confirmText.trim() !== CONFIRM_WORD}
                onClick={deleteAccount}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4" aria-hidden />
                )}
                حذف دائمی حساب
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
              >
                انصراف
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            حذف حساب
          </Button>
        )}
      </div>
    </div>
  );
}
