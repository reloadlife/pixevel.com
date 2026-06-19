export function formatToman(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}

export function toFaNumber(value: number | string) {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(
    Number(value)
  );
}

export function decimalToNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }

  return 0;
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
