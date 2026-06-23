"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type * as React from "react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Presentational ConfirmDialog
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="confirm-dialog-overlay"
          className={cn(
            "fixed inset-0 z-50 bg-black/30 transition-opacity duration-150",
            "data-ending-style:opacity-0 data-starting-style:opacity-0",
            "supports-backdrop-filter:backdrop-blur-sm",
          )}
        />
        <DialogPrimitive.Popup
          data-slot="confirm-dialog-content"
          className={cn(
            "fixed start-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rtl:translate-x-1/2",
            "flex flex-col gap-4 rounded-2xl border border-border bg-popover p-6 shadow-xl",
            "text-sm text-popover-foreground",
            "transition duration-200 ease-in-out",
            "data-ending-style:opacity-0 data-ending-style:scale-95",
            "data-starting-style:opacity-0 data-starting-style:scale-95",
          )}
        >
          <DialogPrimitive.Title
            data-slot="confirm-dialog-title"
            className="font-heading text-base font-medium text-foreground"
          >
            {title}
          </DialogPrimitive.Title>

          {description && (
            <DialogPrimitive.Description
              data-slot="confirm-dialog-description"
              className="text-sm text-muted-foreground"
            >
              {description}
            </DialogPrimitive.Description>
          )}

          <div className="flex flex-row-reverse gap-2 pt-2">
            <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <DialogPrimitive.Close render={<Button variant="outline" />}>
              {cancelLabel}
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// useConfirm — promise-based imperative API
// ---------------------------------------------------------------------------

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface UseConfirmReturn {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dialog: React.ReactNode;
}

export function useConfirm(): UseConfirmReturn {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "" });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setOpen(false);
      resolverRef.current?.(false);
      resolverRef.current = null;
    }
  }, []);

  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={opts.title}
      description={opts.description}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      destructive={opts.destructive}
      onConfirm={handleConfirm}
    />
  );

  return { confirm, dialog };
}
