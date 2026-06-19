"use client";

import { Loader2, Save, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type WatermarkImageRow = {
  id: string;
  titleFa: string;
  originalName: string;
  url: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function WatermarkImageManagement({
  initialImages,
}: {
  initialImages: WatermarkImageRow[];
}) {
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const [savingTitleId, setSavingTitleId] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateImageTitle(id: string, titleFa: string) {
    setImages((current) =>
      current.map((image) => (image.id === id ? { ...image, titleFa } : image)),
    );
  }

  async function saveImageTitle(image: WatermarkImageRow) {
    setSavingTitleId(image.id);

    try {
      const response = await fetch(`/api/admin/watermark-images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleFa: image.titleFa }),
      });
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "عنوان واترمارک ذخیره نشد.");
        return;
      }

      setImages((current) =>
        current.map((item) => (item.id === image.id ? result.data.image : item)),
      );
    } finally {
      setSavingTitleId("");
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setUploading(true);

    try {
      const body = new FormData();
      Array.from(files).forEach((file) => {
        body.append("files", file);
      });

      const response = await fetch("/api/admin/watermark-images", {
        method: "POST",
        body,
      });
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "آپلود واترمارک انجام نشد.");
        return;
      }

      setImages((current) => [...result.data.images, ...current]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0 border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">تصاویر واترمارک</h2>
            <p className="mt-1 text-xs font-bold text-zinc-500">
              {images.length.toLocaleString("fa-IR")} تصویر PNG
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                uploadImages(event.target.files);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              className="h-10 px-4 font-black"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              آپلود PNG
            </Button>
          </div>
        </div>
      </section>

      <section className="min-w-0">
        {images.length === 0 ? (
          <div className="border border-dashed border-zinc-300 bg-white p-6 text-sm font-bold text-zinc-500">
            هنوز تصویر واترمارک آپلود نشده است.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="grid min-w-0 gap-3 border border-zinc-200 bg-white p-3"
              >
                <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-zinc-50">
                  <img
                    src={image.url}
                    alt={image.titleFa || image.originalName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <label className="block min-w-0">
                    <span className="mb-2 block text-sm font-bold">عنوان واترمارک</span>
                    <input
                      value={image.titleFa}
                      onChange={(event) => updateImageTitle(image.id, event.target.value)}
                      className="h-10 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
                      placeholder={image.originalName}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingTitleId === image.id}
                    onClick={() => saveImageTitle(image)}
                  >
                    {savingTitleId === image.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    ذخیره عنوان
                  </Button>
                  <p className="mt-1 break-all text-xs text-zinc-500" dir="ltr">
                    {image.url}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-black text-zinc-600">
                  <span className="bg-zinc-100 px-2 py-1">
                    {image.width && image.height ? `${image.width}×${image.height}` : "PNG"}
                  </span>
                  <span className="bg-zinc-100 px-2 py-1">{formatBytes(image.sizeBytes)}</span>
                  <span className="bg-zinc-100 px-2 py-1">{image.mimeType}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
