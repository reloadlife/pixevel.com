export type OtpDeliveryStatus = "sent" | "pending" | "skipped" | "failed";

export type OtpDeliveryResult<TPayload> = {
  status: OtpDeliveryStatus;
  message: string;
  payload: TPayload | null;
};

export function formatDeliveryError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown delivery error.";
}

export function resolveTimeoutMs(value: string | undefined, fallbackMs: number) {
  const timeoutMs = Number(value ?? fallbackMs);

  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : fallbackMs;
}
