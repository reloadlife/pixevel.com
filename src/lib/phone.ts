export function normalizeIranPhone(input: string) {
  const digits = input.replace(/[^\d+]/g, "");

  if (digits.startsWith("+98")) {
    return `0${digits.slice(3)}`;
  }

  if (digits.startsWith("0098")) {
    return `0${digits.slice(4)}`;
  }

  if (digits.startsWith("98") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith("9") && digits.length === 10) {
    return `0${digits}`;
  }

  return digits;
}

export function isValidIranPhone(phone: string) {
  return /^09\d{9}$/.test(phone);
}
