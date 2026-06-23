import { slugify } from "@/lib/format";

/**
 * Pure helpers for the generic product-option model (option → option value →
 * variant). Shared by the admin product builder, the order snapshotter, and the
 * seed so the deterministic `optionsKey` / SKU / title composition stay in sync.
 */

export type OptionSelectionPair = {
  optionSlug: string;
  valueSlug: string;
};

/**
 * Deterministic fingerprint of a variant's selected option values. Sorted by
 * option slug and joined as `optionSlug:valueSlug|...`. Stable across creation
 * and storefront resolution, and unique per product (enforced by a unique index).
 * An empty selection (a product with no options) yields "".
 */
export function optionsKeyFromPairs(pairs: OptionSelectionPair[]): string {
  return [...pairs]
    .sort((a, b) => a.optionSlug.localeCompare(b.optionSlug))
    .map((pair) => `${pair.optionSlug}:${pair.valueSlug}`)
    .join("|");
}

/** Image/override key for a single option value, e.g. "color:red". */
export function optionValueKey(optionSlug: string, valueSlug: string): string {
  return `${optionSlug}:${valueSlug}`;
}

/** Compose a human variant title from the selected value labels, e.g. "گلوبال / ماهانه". */
export function composeVariantTitle(valueLabels: string[], fallback: string): string {
  const composed = valueLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .join(" / ");
  return composed || fallback;
}

/** Build a variant SKU from the product slug and selected value slugs. */
export function composeVariantSku(productSlug: string, valueSlugs: string[]): string {
  return [productSlug, ...valueSlugs].join("-").replace(/-+/g, "-").toUpperCase();
}

/** Build the frozen options snapshot persisted on an order line. */
export function composeOptionsSnapshot(
  pairs: Array<{ nameFa: string; valueFa: string; slug: string }>,
): Array<{ nameFa: string; valueFa: string; slug: string }> {
  return pairs.map((pair) => ({ nameFa: pair.nameFa, valueFa: pair.valueFa, slug: pair.slug }));
}

/** Build the frozen human options summary persisted on an order line, e.g. "منطقه: گلوبال · مدت: ماهانه". */
export function composeOptionsSummary(
  pairs: Array<{ nameFa: string; valueFa: string }>,
): string | null {
  const summary = pairs
    .map((pair) => `${pair.nameFa}: ${pair.valueFa}`)
    .filter(Boolean)
    .join(" · ");
  return summary || null;
}

/** Slug a raw option / value label, with a positional fallback. */
export function optionSlug(raw: string | undefined, label: string, index: number): string {
  return slugify(raw || label) || `option-${index + 1}`;
}

/** Cartesian product of option-value lists. Returns one row per combination. */
export function cartesian<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((combo) => group.map((value) => [...combo, value])),
    [[]],
  );
}

/** Billing interval → approximate Persian label for UI/snapshots. */
export function billingIntervalLabelFa(unit: string, count = 1): string {
  const base: Record<string, string> = {
    DAY: "روزانه",
    WEEK: "هفتگی",
    MONTH: "ماهانه",
    YEAR: "سالانه",
  };
  if (count <= 1) return base[unit] ?? unit;
  const every: Record<string, string> = { DAY: "روز", WEEK: "هفته", MONTH: "ماه", YEAR: "سال" };
  return `هر ${count} ${every[unit] ?? unit}`;
}

/** Format a date as a Persian (Jalali) calendar date, e.g. "۱۴۰۵/۰۴/۰۲". */
export function faDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat("fa-IR").format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Advance a date by an interval (used by the renewal engine and provisioning). */
export function addInterval(from: Date, unit: string, count = 1): Date {
  const next = new Date(from.getTime());
  switch (unit) {
    case "DAY":
      next.setUTCDate(next.getUTCDate() + count);
      break;
    case "WEEK":
      next.setUTCDate(next.getUTCDate() + count * 7);
      break;
    case "MONTH":
      next.setUTCMonth(next.getUTCMonth() + count);
      break;
    case "YEAR":
      next.setUTCFullYear(next.getUTCFullYear() + count);
      break;
  }
  return next;
}
