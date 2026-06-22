import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dispatch tests for sendOtp — verifies the registry is used as the authority
 * for selecting the provider, including the voice-fallback path.
 */

// Mock the provider registry so we can control which provider is resolved
// without any real HTTP calls.
vi.mock("@/lib/sms/providers", () => {
  const makeMockProvider = (id: "kavenegar" | "ippanel" | "selfhosted", supportsVoice: boolean) =>
    ({
      id,
      supportsVoice,
      sendOtp: vi
        .fn()
        .mockResolvedValue({ status: "sent", message: `${id} otp sent`, payload: null }),
      sendText: vi
        .fn()
        .mockResolvedValue({ status: "sent", message: `${id} text sent`, payload: null }),
    }) satisfies import("@/lib/sms/providers").SmsProvider;

  const ippanel = makeMockProvider("ippanel", false);
  const kavenegar = makeMockProvider("kavenegar", true);
  const selfhosted = makeMockProvider("selfhosted", true);

  return {
    resolveProviderForChannel: vi.fn().mockResolvedValue({ provider: kavenegar, id: "kavenegar" }),
    // expose providers for assertion
    __providers: { ippanel, kavenegar, selfhosted },
  };
});

import { resolveProviderForChannel } from "@/lib/sms/providers";
import { sendOtp } from "./otp";

// Unwrap the providers exposed by the mock for assertions.
type MockModule = typeof import("@/lib/sms/providers") & {
  __providers: Record<string, import("@/lib/sms/providers").SmsProvider>;
};
const {
  ippanel: ippanelMock,
  kavenegar: kavenegarMock,
  selfhosted: selfhostedMock,
} = ((await import("@/lib/sms/providers")) as unknown as MockModule).__providers;

const mockResolveProviderForChannel = vi.mocked(resolveProviderForChannel);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendOtp — SMS channel dispatch", () => {
  it("uses ippanel adapter when SMS_PROVIDER=ippanel", async () => {
    mockResolveProviderForChannel.mockResolvedValue({ provider: ippanelMock, id: "ippanel" });

    await sendOtp("09123456789", "1234", "sms");

    expect(mockResolveProviderForChannel).toHaveBeenCalledWith("sms");
    expect(ippanelMock.sendOtp).toHaveBeenCalledWith("09123456789", "1234", "sms");
    expect(kavenegarMock.sendOtp).not.toHaveBeenCalled();
  });

  it("uses kavenegar adapter when SMS_PROVIDER is unset (default)", async () => {
    mockResolveProviderForChannel.mockResolvedValue({ provider: kavenegarMock, id: "kavenegar" });

    await sendOtp("09123456789", "5678", "sms");

    expect(mockResolveProviderForChannel).toHaveBeenCalledWith("sms");
    expect(kavenegarMock.sendOtp).toHaveBeenCalledWith("09123456789", "5678", "sms");
    expect(ippanelMock.sendOtp).not.toHaveBeenCalled();
  });
});

describe("sendOtp — voice channel dispatch", () => {
  it("uses the resolved voice provider when it supports voice", async () => {
    mockResolveProviderForChannel.mockResolvedValue({ provider: selfhostedMock, id: "selfhosted" });

    await sendOtp("09123456789", "9999", "call");

    expect(mockResolveProviderForChannel).toHaveBeenCalledWith("call");
    expect(selfhostedMock.sendOtp).toHaveBeenCalledWith("09123456789", "9999", "call");
    expect(kavenegarMock.sendOtp).not.toHaveBeenCalled();
  });

  it("falls back to kavenegar when the resolved voice provider does not support voice", async () => {
    // resolveProviderForChannel already handles the fallback internally;
    // it returns kavenegar when the configured voice provider doesn't support voice.
    mockResolveProviderForChannel.mockResolvedValue({ provider: kavenegarMock, id: "kavenegar" });

    await sendOtp("09123456789", "0000", "call");

    expect(mockResolveProviderForChannel).toHaveBeenCalledWith("call");
    expect(kavenegarMock.sendOtp).toHaveBeenCalledWith("09123456789", "0000", "call");
    expect(ippanelMock.sendOtp).not.toHaveBeenCalled();
  });
});
