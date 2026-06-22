import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dispatch tests for sendOtpLogged — the live OTP send path. Verifies the
 * registry is the authority for which provider sends AND that the provider id
 * actually used is what gets logged (including the voice-fallback case, where
 * resolveProviderForChannel returns the kavenegar fallback).
 */

vi.mock("@/lib/sms/providers", () => {
  const make = (id: "kavenegar" | "ippanel" | "selfhosted", supportsVoice: boolean) =>
    ({
      id,
      supportsVoice,
      sendOtp: vi.fn().mockResolvedValue({ status: "sent", message: `${id} otp`, payload: null }),
      sendText: vi.fn().mockResolvedValue({ status: "sent", message: `${id} text`, payload: null }),
    }) satisfies import("@/lib/sms/providers").SmsProvider;

  const ippanel = make("ippanel", false);
  const kavenegar = make("kavenegar", true);
  const selfhosted = make("selfhosted", true);

  return {
    resolveProviderForChannel: vi.fn().mockResolvedValue({ provider: kavenegar, id: "kavenegar" }),
    __providers: { ippanel, kavenegar, selfhosted },
  };
});

// Keep the ledger write out of the DB — assert the recorded provider id instead.
vi.mock("@/lib/comms/record", () => ({
  recordOutbound: vi.fn().mockResolvedValue("log-id"),
  recordInbound: vi.fn().mockResolvedValue("log-id"),
}));

import { recordOutbound } from "@/lib/comms/record";
import { resolveProviderForChannel } from "@/lib/sms/providers";
import { sendOtpLogged } from "./send";

type MockModule = typeof import("@/lib/sms/providers") & {
  __providers: Record<string, import("@/lib/sms/providers").SmsProvider>;
};
const {
  ippanel: ippanelMock,
  kavenegar: kavenegarMock,
  selfhosted: selfhostedMock,
} = ((await import("@/lib/sms/providers")) as unknown as MockModule).__providers;

const mockResolve = vi.mocked(resolveProviderForChannel);
const mockRecord = vi.mocked(recordOutbound);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendOtpLogged — SMS channel dispatch", () => {
  it("uses the ippanel adapter and logs provider=ippanel when resolved to ippanel", async () => {
    mockResolve.mockResolvedValue({ provider: ippanelMock, id: "ippanel" });

    await sendOtpLogged("09123456789", "1234", "sms");

    expect(mockResolve).toHaveBeenCalledWith("sms");
    expect(ippanelMock.sendOtp).toHaveBeenCalledWith("09123456789", "1234", "sms");
    expect(kavenegarMock.sendOtp).not.toHaveBeenCalled();
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "ippanel", channel: "SMS", kind: "OTP" }),
    );
  });

  it("uses the kavenegar adapter and logs provider=kavenegar by default", async () => {
    mockResolve.mockResolvedValue({ provider: kavenegarMock, id: "kavenegar" });

    await sendOtpLogged("09123456789", "5678", "sms");

    expect(kavenegarMock.sendOtp).toHaveBeenCalledWith("09123456789", "5678", "sms");
    expect(ippanelMock.sendOtp).not.toHaveBeenCalled();
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ provider: "kavenegar" }));
  });
});

describe("sendOtpLogged — voice channel dispatch", () => {
  it("uses the resolved voice provider when it supports voice and logs its id", async () => {
    mockResolve.mockResolvedValue({ provider: selfhostedMock, id: "selfhosted" });

    await sendOtpLogged("09123456789", "9999", "call");

    expect(mockResolve).toHaveBeenCalledWith("call");
    expect(selfhostedMock.sendOtp).toHaveBeenCalledWith("09123456789", "9999", "call");
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "selfhosted", channel: "VOICE" }),
    );
  });

  it("logs provider=kavenegar on voice fallback (resolver returns the kavenegar fallback)", async () => {
    // resolveProviderForChannel applies the fallback internally and returns
    // { provider: kavenegar, id: "kavenegar" } when the configured voice
    // provider does not support voice.
    mockResolve.mockResolvedValue({ provider: kavenegarMock, id: "kavenegar" });

    await sendOtpLogged("09123456789", "0000", "call");

    expect(kavenegarMock.sendOtp).toHaveBeenCalledWith("09123456789", "0000", "call");
    expect(ippanelMock.sendOtp).not.toHaveBeenCalled();
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "kavenegar", channel: "VOICE" }),
    );
  });
});
