"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AvatarUpload({
  avatarUrl,
  fallback,
}: {
  avatarUrl: string | null;
  fallback: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [preview, setPreview] = useState<string | null>(avatarUrl);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPending(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/account/avatar", { method: "POST", body: data });
    const json = await res.json().catch(() => null);
    setPending(false);
    URL.revokeObjectURL(localUrl);

    if (!res.ok) {
      setPreview(avatarUrl);
      toast.error(json?.error?.message ?? "آپلود تصویر ممکن نشد.");
      return;
    }
    setPreview(json.data.avatarUrl);
    toast.success("تصویر پروفایل به‌روزرسانی شد.");
    router.refresh();
  }

  async function onRemove() {
    setRemoving(true);
    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    setRemoving(false);
    if (!res.ok) {
      toast.error("حذف تصویر ممکن نشد.");
      return;
    }
    setPreview(null);
    toast.success("تصویر پروفایل حذف شد.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-gold/15 text-2xl font-black text-gold ring-1 ring-foreground/5",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="تصویر پروفایل" className="size-full object-cover" />
        ) : (
          fallback
        )}
        {pending ? (
          <div className="absolute inset-0 grid place-items-center bg-background/60">
            <Loader2 className="size-5 animate-spin text-foreground" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          onChange={onPick}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden />
            انتخاب تصویر
          </Button>
          {preview ? (
            <Button type="button" variant="ghost" size="sm" disabled={removing} onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden />
              حذف
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          فرمت‌های JPG، PNG یا WebP — حداکثر ۸ مگابایت.
        </p>
      </div>
    </div>
  );
}
