"use client";

import { useForm } from "@tanstack/react-form";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal shape expected from useAdminMutation / any react-query mutation. */
interface Mutation<TVars> {
  mutateAsync: (vars: TVars) => Promise<unknown>;
}

// ─── useAdminForm ─────────────────────────────────────────────────────────────

/**
 * Thin wrapper around TanStack Form's `useForm` that wires up a
 * `useAdminMutation` result as the submit handler.
 *
 * The caller still binds fields via `form.Field` in their own component —
 * this hook only handles the mutation plumbing + success callback.
 */
export function useAdminForm<TValues>({
  defaultValues,
  mutation,
  onSuccess,
}: {
  defaultValues: TValues;
  mutation: Mutation<TValues>;
  onSuccess?: () => void;
}) {
  return useForm({
    defaultValues,
    onSubmit: async ({ value }: { value: TValues }) => {
      await mutation.mutateAsync(value);
      onSuccess?.();
    },
  });
}

// ─── SheetForm ────────────────────────────────────────────────────────────────

interface SheetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Persian submit label; defaults to "ذخیره". */
  submitLabel?: string;
  /** TanStack Form instance returned by useAdminForm or useForm. */
  form: {
    handleSubmit: () => Promise<void>;
    state: { isSubmitting: boolean };
  };
  children: React.ReactNode;
}

/**
 * A right-side Sheet shell for admin create/edit forms.
 *
 * Renders a <Sheet> → <SheetContent side="right"> with:
 * - SheetHeader containing the title
 * - A <form> whose onSubmit calls form.handleSubmit()
 * - SheetFooter with submit + cancel buttons
 *
 * Field children are passed from the caller, bound via form.Field.
 * SheetForm itself is generic — it does not hardcode any fields.
 */
export function SheetForm({
  open,
  onOpenChange,
  title,
  submitLabel = "ذخیره",
  form,
  children,
}: SheetFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" dir="rtl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4"
        >
          {children}

          {/* Hidden submit so Enter key works in nested inputs */}
          <button type="submit" className="sr-only" aria-hidden="true" />
        </form>

        <SheetFooter>
          <Button
            type="button"
            onClick={() => form.handleSubmit()}
            disabled={form.state.isSubmitting}
            className="w-full"
          >
            {form.state.isSubmitting ? "در حال ارسال…" : submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={form.state.isSubmitting}
            className="w-full"
          >
            انصراف
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
