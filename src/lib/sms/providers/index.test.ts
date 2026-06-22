import { describe, expect, it, vi } from "vitest";
import {
  getSmsProvider,
  resolveSmsProviderId,
  resolveVoiceProvider,
  resolveVoiceProviderId,
} from "./index";

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(),
}));

import { getSetting } from "@/lib/settings";

const mockGetSetting = vi.mocked(getSetting);

describe("getSmsProvider", () => {
  it("returns kavenegar provider", () => {
    const p = getSmsProvider("kavenegar");
    expect(p.id).toBe("kavenegar");
    expect(p.supportsVoice).toBe(true);
  });

  it("returns ippanel provider", () => {
    const p = getSmsProvider("ippanel");
    expect(p.id).toBe("ippanel");
    expect(p.supportsVoice).toBe(false);
  });

  it("returns selfhosted provider", () => {
    const p = getSmsProvider("selfhosted");
    expect(p.id).toBe("selfhosted");
    expect(p.supportsVoice).toBe(true);
  });

  it("throws on unknown provider id", () => {
    expect(() => getSmsProvider("unknown-provider")).toThrow(
      'Unknown SMS provider: "unknown-provider"',
    );
  });
});

describe("resolveSmsProviderId", () => {
  it("honors SMS_PROVIDER when set", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "SMS_PROVIDER") return "ippanel";
      return undefined;
    });
    expect(await resolveSmsProviderId()).toBe("ippanel");
  });

  it("falls back to SMS_OTP_PROVIDER when SMS_PROVIDER is unset", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "SMS_PROVIDER") return undefined;
      if (key === "SMS_OTP_PROVIDER") return "ippanel";
      return undefined;
    });
    expect(await resolveSmsProviderId()).toBe("ippanel");
  });

  it("falls back to kavenegar when both are unset", async () => {
    mockGetSetting.mockImplementation(async () => undefined);
    expect(await resolveSmsProviderId()).toBe("kavenegar");
  });

  it("falls back to kavenegar on unknown provider value", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "SMS_PROVIDER") return "nonexistent";
      return undefined;
    });
    expect(await resolveSmsProviderId()).toBe("kavenegar");
  });

  it("normalizes to lowercase", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "SMS_PROVIDER") return "IPPANEL";
      return undefined;
    });
    expect(await resolveSmsProviderId()).toBe("ippanel");
  });
});

describe("resolveVoiceProviderId", () => {
  it("honors VOICE_PROVIDER when set to a known value", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "VOICE_PROVIDER") return "selfhosted";
      return undefined;
    });
    expect(await resolveVoiceProviderId()).toBe("selfhosted");
  });

  it("falls back to kavenegar when VOICE_PROVIDER is unset", async () => {
    mockGetSetting.mockImplementation(async () => undefined);
    expect(await resolveVoiceProviderId()).toBe("kavenegar");
  });

  it("falls back to kavenegar on unknown VOICE_PROVIDER value", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "VOICE_PROVIDER") return "bogus";
      return undefined;
    });
    expect(await resolveVoiceProviderId()).toBe("kavenegar");
  });
});

describe("resolveVoiceProvider", () => {
  it("returns the adapter whose id matches resolveVoiceProviderId", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "VOICE_PROVIDER") return "selfhosted";
      return undefined;
    });
    const provider = await resolveVoiceProvider();
    expect(provider.id).toBe("selfhosted");
  });

  it("returns kavenegar adapter when VOICE_PROVIDER is unset", async () => {
    mockGetSetting.mockImplementation(async () => undefined);
    const provider = await resolveVoiceProvider();
    expect(provider.id).toBe("kavenegar");
  });
});
