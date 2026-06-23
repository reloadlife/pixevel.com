"use client";

import type * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BaseCurrency } from "@/db/schema";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── FormField ────────────────────────────────────────────────────────────────

export function FormField({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5" dir="rtl">
      {label ? (
        <Label htmlFor={htmlFor} className="justify-end text-right">
          {label}
        </Label>
      ) : null}
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground text-right">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive text-right">{error}</p> : null}
    </div>
  );
}

// ─── TextField ────────────────────────────────────────────────────────────────

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  hint,
  error,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <FormField label={label} hint={hint} error={error} htmlFor={id}>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        dir="rtl"
        aria-invalid={!!error}
        className="text-right"
      />
    </FormField>
  );
}

// ─── TextareaField ────────────────────────────────────────────────────────────

export function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  rows,
  hint,
  error,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  hint?: string;
  error?: string;
}) {
  return (
    <FormField label={label} hint={hint} error={error} htmlFor={id}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows ?? 3}
        dir="rtl"
        aria-invalid={!!error}
        className={cn(
          "w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1.5 text-sm text-right transition-[color,box-shadow] duration-200 outline-none resize-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          error &&
            "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
        )}
      />
    </FormField>
  );
}

// ─── NumberField ──────────────────────────────────────────────────────────────

export function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  min,
  max,
  step,
  hint,
  error,
}: {
  id: string;
  label?: string;
  value: number | string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  error?: string;
}) {
  return (
    <FormField label={label} hint={hint} error={error} htmlFor={id}>
      <Input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        dir="ltr"
        aria-invalid={!!error}
        className="text-left"
      />
    </FormField>
  );
}

// ─── SelectField ──────────────────────────────────────────────────────────────

export type SelectOption = { value: string; label: string };

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  hint,
  error,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <FormField label={label} hint={hint} error={error} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        dir="rtl"
        aria-invalid={!!error}
        className={cn(
          "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm text-right transition-[color,box-shadow] duration-200 outline-none appearance-none cursor-pointer disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          error &&
            "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

// ─── SwitchRow ────────────────────────────────────────────────────────────────

export function SwitchRow({
  id,
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-row-reverse items-center justify-between gap-3 rounded-2xl border border-transparent bg-input/30 px-3 py-2"
      dir="rtl"
    >
      <div className="flex flex-col gap-0.5 flex-1 text-right">
        <Label htmlFor={id} className="justify-end cursor-pointer">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {/* Toggle built from a styled checkbox */}
      <div className="relative flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          onClick={() => !disabled && onChange(!checked)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) onChange(!checked);
            }
          }}
          role="switch"
          aria-checked={checked}
          aria-labelledby={id}
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "h-5 w-9 rounded-full cursor-pointer transition-colors duration-200 relative",
            checked ? "bg-primary" : "bg-muted",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
              checked ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </div>
      </div>
    </div>
  );
}

// ─── MoneyField ───────────────────────────────────────────────────────────────

export function MoneyField({
  id,
  label,
  value,
  onChange,
  currency,
  rateToman,
  disabled,
  error,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  currency: BaseCurrency;
  /**
   * Toman-per-unit rate for the live conversion hint when currency is USD/EUR.
   * Supplied by the caller (rates are server-side; this client kit must not
   * import the exchange module). When omitted, no hint is shown.
   */
  rateToman?: number;
  disabled?: boolean;
  error?: string;
}) {
  // Compute the live Toman hint when currency is USD or EUR and a rate is given.
  const tomanHint = (() => {
    if (currency === "IRT" || !rateToman || rateToman <= 0) return undefined;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return undefined;
    const toman = Math.round(amount * rateToman);
    return `≈ ${formatToman(toman)}`;
  })();

  return (
    <FormField label={label} hint={tomanHint} error={error} htmlFor={id}>
      <div className="relative flex items-center">
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          dir="ltr"
          aria-invalid={!!error}
          className="text-left pl-16"
          min={0}
          step={1}
        />
        <span className="absolute left-2.5 text-xs text-muted-foreground pointer-events-none select-none">
          {currency === "IRT" ? "تومان" : currency}
        </span>
      </div>
    </FormField>
  );
}

// ─── DateField ────────────────────────────────────────────────────────────────

export function DateField({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
  error,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) {
  // Show a Jalali (Persian) caption for the selected date.
  const jalaliCaption = (() => {
    if (!value) return undefined;
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return undefined;
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch {
      return undefined;
    }
  })();

  const combinedHint = jalaliCaption ? (hint ? `${jalaliCaption} — ${hint}` : jalaliCaption) : hint;

  return (
    <FormField label={label} hint={combinedHint} error={error} htmlFor={id}>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        dir="ltr"
        aria-invalid={!!error}
        className="text-left"
      />
    </FormField>
  );
}
