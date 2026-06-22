import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ippanelProvider } from "./ippanel";

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(),
  getSettingNumber: vi.fn(),
}));

// Mock the underlying sendIppanelOtp so we don't test its internals here
vi.mock("@/lib/sms/ippanel", () => ({
  sendIppanelOtp: vi.fn(),
  toE164Iran: (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("98")) return `+${digits}`;
    if (digits.startsWith("0")) return `+98${digits.slice(1)}`;
    return `+98${digits}`;
  },
}));

import { getSetting, getSettingNumber } from "@/lib/settings";
import { sendIppanelOtp } from "@/lib/sms/ippanel";

const mockGetSetting = vi.mocked(getSetting);
const mockGetSettingNumber = vi.mocked(getSettingNumber);
const mockSendIppanelOtp = vi.mocked(sendIppanelOtp);

describe("ippanelProvider.sendOtp", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns skipped for voice channel", async () => {
    const result = await ippanelProvider.sendOtp("09123456789", "123456", "call");
    expect(result.status).toBe("skipped");
    expect(result.message).toContain("voice");
    expect(mockSendIppanelOtp).not.toHaveBeenCalled();
  });

  it("delegates to sendIppanelOtp for sms channel", async () => {
    mockSendIppanelOtp.mockResolvedValueOnce({ status: "sent", message: "ok", payload: null });

    const result = await ippanelProvider.sendOtp("09123456789", "123456", "sms");
    expect(mockSendIppanelOtp).toHaveBeenCalledWith("09123456789", "123456");
    expect(result.status).toBe("sent");
  });
});

describe("ippanelProvider.sendText", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockGetSetting.mockImplementation(async (key: string) => {
      const vals: Record<string, string> = {
        IPPANEL_API_KEY: "test-api-key",
        IPPANEL_SENDER: "+989001234567",
      };
      return vals[key];
    });
    mockGetSettingNumber.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns skipped when API key is missing", async () => {
    mockGetSetting.mockImplementation(async () => undefined);
    const result = await ippanelProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns skipped when IPPANEL_SENDER is missing", async () => {
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "IPPANEL_API_KEY") return "test-api-key";
      return undefined;
    });
    const result = await ippanelProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("builds correct request for sendText", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          meta: { status: true, message: "ok" },
          data: { message_outbox_ids: [42] },
        }),
        {
          status: 200,
        },
      ),
    );

    const result = await ippanelProvider.sendText("09123456789", "test message");
    expect(result.status).toBe("sent");

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://edge.ippanel.com/v1/api/send");
    expect((init.headers as Record<string, string>).Authorization).toBe("test-api-key");
    const body = JSON.parse(init.body as string);
    expect(body.sending_type).toBe("webservice");
    expect(body.recipients).toContain("+989123456789");
    expect(body.message).toBe("test message");
  });

  it("returns failed on non-2xx", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ meta: { status: false, message: "error" } }), { status: 400 }),
    );
    const result = await ippanelProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("failed");
  });
});
