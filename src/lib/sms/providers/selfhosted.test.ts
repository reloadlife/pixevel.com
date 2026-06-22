import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selfhostedProvider } from "./selfhosted";

// Mock settings so we never touch DB
vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(),
  getSettingNumber: vi.fn(),
}));

import { getSetting, getSettingNumber } from "@/lib/settings";

const mockGetSetting = vi.mocked(getSetting);
const mockGetSettingNumber = vi.mocked(getSettingNumber);

function configuredSettings(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string | undefined> = {
    SELFHOSTED_SMS_BASE_URL: "https://sms.example.com",
    SELFHOSTED_SMS_TOKEN: "secret-token",
    SELFHOSTED_SMS_SEND_PATH: "/messages",
    SELFHOSTED_SENDER: undefined,
    SELFHOSTED_SMS_TIMEOUT_MS: undefined,
    ...overrides,
  };
  mockGetSetting.mockImplementation(async (key: string) => defaults[key]);
  mockGetSettingNumber.mockImplementation(async (_key: string, fallback: number) => fallback);
}

describe("selfhostedProvider.sendText", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns skipped when base URL is missing", async () => {
    configuredSettings({ SELFHOSTED_SMS_BASE_URL: undefined });
    const result = await selfhostedProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns skipped when token is missing", async () => {
    configuredSettings({ SELFHOSTED_SMS_TOKEN: undefined });
    const result = await selfhostedProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("builds correct URL, Authorization header, and JSON body for sendText", async () => {
    configuredSettings();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "sent", id: "abc" }), { status: 200 }),
    );

    const result = await selfhostedProvider.sendText("09123456789", "test message");

    expect(result.status).toBe("sent");
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sms.example.com/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ to: "09123456789", type: "sms", message: "test message" });
    expect(body.from).toBeUndefined();
  });

  it("includes 'from' field when SELFHOSTED_SENDER is set", async () => {
    configuredSettings({ SELFHOSTED_SENDER: "+989123456789" });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "sent" }), { status: 200 }),
    );

    await selfhostedProvider.sendText("09123456789", "hello");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("+989123456789");
  });

  it("uses custom send path", async () => {
    configuredSettings({ SELFHOSTED_SMS_SEND_PATH: "/api/sms/send" });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "sent" }), { status: 200 }),
    );

    await selfhostedProvider.sendText("09123456789", "hello");

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sms.example.com/api/sms/send");
  });

  it("returns failed on non-2xx response", async () => {
    configuredSettings();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );

    const result = await selfhostedProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("failed");
  });

  it("returns failed when status field is 'failed'", async () => {
    configuredSettings();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "failed", error: "bad number" }), { status: 200 }),
    );

    const result = await selfhostedProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("failed");
  });

  it("returns pending when status field is 'queued'", async () => {
    configuredSettings();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "queued" }), { status: 200 }),
    );

    const result = await selfhostedProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("pending");
  });

  it("returns failed (never throws) when fetch throws", async () => {
    configuredSettings();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const result = await selfhostedProvider.sendText("09123456789", "hello");
    expect(result.status).toBe("failed");
    expect(result.message).toContain("network error");
  });
});

describe("selfhostedProvider.sendOtp", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("builds correct body for sms channel sendOtp", async () => {
    configuredSettings();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "sent" }), { status: 200 }),
    );

    await selfhostedProvider.sendOtp("09123456789", "123456", "sms");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ to: "09123456789", type: "sms", message: "123456" });
  });

  it("builds correct body for call channel sendOtp", async () => {
    configuredSettings();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "sent" }), { status: 200 }),
    );

    await selfhostedProvider.sendOtp("09123456789", "123456", "call");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ to: "09123456789", type: "call", message: "123456" });
  });

  it("returns skipped when unconfigured", async () => {
    configuredSettings({ SELFHOSTED_SMS_BASE_URL: undefined });
    const result = await selfhostedProvider.sendOtp("09123456789", "123456", "sms");
    expect(result.status).toBe("skipped");
  });

  it("returns failed (never throws) on thrown fetch", async () => {
    configuredSettings();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("connection refused"));

    const result = await selfhostedProvider.sendOtp("09123456789", "123456", "sms");
    expect(result.status).toBe("failed");
  });
});
