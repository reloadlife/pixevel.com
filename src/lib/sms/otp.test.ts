import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dispatch tests for sendOtp — verifies the registry is used as the authority
 * for selecting the provider, including the voice-fallback path.
 */

// Mock the provider registry so we can control which provider is resolved
// without any real HTTP calls.
vi.mock("@/lib/sms/providers", () => {
  const makeMockProvider = (id: string, supportsVoice: boolean) => ({
    id,
    supportsVoice,
    sendOtp: vi
      .fn()
      .mockResolvedValue({ status: "sent", message: `${id} otp sent`, payload: null }),
    sendText: vi
      .fn()
      .mockResolvedValue({ status: "sent", message: `${id} text sent`, payload: null }),
  });

  const ippanel = makeMockProvider("ippanel", false);
  const kavenegar = makeMockProvider("kavenegar", true);
  const selfhosted = makeMockProvider("selfhosted", true);

  return {
    getSmsProvider: vi.fn((id: string) => {
      if (id === "kavenegar") return kavenegar;
      if (id === "ippanel") return ippanel;
      if (id === "selfhosted") return selfhosted;
      throw new Error(`Unknown SMS provider: "${id}"`);
    }),
    resolveSmsProvider: vi.fn().mockResolvedValue(kavenegar),
    resolveVoiceProvider: vi.fn().mockResolvedValue(kavenegar),
    // expose providers for assertion
    __providers: { ippanel, kavenegar, selfhosted },
  };
});

import { getSmsProvider, resolveSmsProvider, resolveVoiceProvider } from "@/lib/sms/providers";
import { sendOtp } from "./otp";

// Unwrap the providers exposed by the mock for assertions.
// The mock factory attaches __providers which vitest's type doesn't know about;
// cast through unknown to avoid the noExplicitAny rule.
type MockModule = typeof import("@/lib/sms/providers") & {
  __providers: Record<
    string,
    ReturnType<typeof import("vitest")["vi"]["fn"]> & {
      sendOtp: ReturnType<typeof import("vitest")["vi"]["fn"]>;
      sendText: ReturnType<typeof import("vitest")["vi"]["fn"]>;
      supportsVoice: boolean;
    }
  >;
};
const {
  ippanel: ippanelMock,
  kavenegar: kavenegarMock,
  selfhosted: selfhostedMock,
} = ((await import("@/lib/sms/providers")) as unknown as MockModule).__providers;

const mockResolveSmsProvider = vi.mocked(resolveSmsProvider);
const mockResolveVoiceProvider = vi.mocked(resolveVoiceProvider);
const mockGetSmsProvider = vi.mocked(getSmsProvider);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendOtp — SMS channel dispatch", () => {
  it("uses ippanel adapter when SMS_PROVIDER=ippanel", async () => {
    mockResolveSmsProvider.mockResolvedValue(ippanelMock);

    await sendOtp("09123456789", "1234", "sms");

    expect(ippanelMock.sendOtp).toHaveBeenCalledWith("09123456789", "1234", "sms");
    expect(kavenegarMock.sendOtp).not.toHaveBeenCalled();
  });

  it("uses kavenegar adapter when SMS_PROVIDER is unset (default)", async () => {
    mockResolveSmsProvider.mockResolvedValue(kavenegarMock);

    await sendOtp("09123456789", "5678", "sms");

    expect(kavenegarMock.sendOtp).toHaveBeenCalledWith("09123456789", "5678", "sms");
    expect(ippanelMock.sendOtp).not.toHaveBeenCalled();
  });
});

describe("sendOtp — voice channel dispatch", () => {
  it("uses the resolved voice provider when it supports voice", async () => {
    mockResolveVoiceProvider.mockResolvedValue(selfhostedMock);

    await sendOtp("09123456789", "9999", "call");

    expect(selfhostedMock.sendOtp).toHaveBeenCalledWith("09123456789", "9999", "call");
    expect(kavenegarMock.sendOtp).not.toHaveBeenCalled();
    // resolveSmsProvider must NOT be called for voice
    expect(mockResolveSmsProvider).not.toHaveBeenCalled();
  });

  it("falls back to kavenegar when the resolved voice provider does not support voice", async () => {
    // ippanel.supportsVoice === false
    mockResolveVoiceProvider.mockResolvedValue(ippanelMock);
    mockGetSmsProvider.mockReturnValue(kavenegarMock);

    await sendOtp("09123456789", "0000", "call");

    // getSmsProvider("kavenegar") must have been called for the fallback
    expect(mockGetSmsProvider).toHaveBeenCalledWith("kavenegar");
    expect(kavenegarMock.sendOtp).toHaveBeenCalledWith("09123456789", "0000", "call");
    expect(ippanelMock.sendOtp).not.toHaveBeenCalled();
  });
});
