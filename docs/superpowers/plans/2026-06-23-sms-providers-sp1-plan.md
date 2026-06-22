# SP1 — SMS/Voice Provider Layer — Implementation Plan

Spec: extends the communications subsystem shipped in
`docs/superpowers/specs/2026-06-22-communications-dashboard-design.md`.
Branch: `feat/sms-providers-sp1`.

Goal: replace the ad-hoc `SMS_OTP_PROVIDER` dispatch with a proper provider
abstraction (kavenegar | ippanel | selfhosted), admin selectors for the SMS and
voice providers, a configurable self-hosted HTTP gateway adapter, delivery +
receive webhooks for the self-hosted provider, and a refined IPPanel delivery
hook. No new DB tables (reuses `commLogs` / `commWebhookEvents`).

## Global Constraints (bind every task)

- **Tooling:** Bun only (`bun install`, `bunx vitest run <file>`). Biome is the
  only linter/formatter — run `bun run check` (writes fixes) before committing.
  NEVER use eslint / prettier / `tsc`. Type-checking happens in `next build`;
  there is no separate typecheck command. Do not run `next build` per task
  (slow); the controller runs it once at the end.
- **Tests:** vitest. Co-locate as `<name>.test.ts`. Test pure logic (request
  builders, status maps, registry resolution) by mocking `fetch` — never hit a
  real provider.
- **Senders never throw.** Every send returns
  `OtpDeliveryResult<T> = { status: "sent"|"pending"|"skipped"|"failed"; message: string; payload: T | null }`
  (from `src/lib/sms/delivery.ts`). Unconfigured → `skipped`; provider/network
  error → `failed`. A messaging failure must never break OTP/checkout.
- **Providers stay pure.** Adapter/provider code MUST NOT write to the DB.
  Persistence + redaction happen only in `src/lib/comms/record.ts` and the
  wrappers in `src/lib/comms/send.ts`. Do not import `getDb` into provider code.
- **Settings:** all config goes through `SETTINGS_REGISTRY` in
  `src/lib/settings.ts` (key = env-var name). Secrets get `secret: true`
  (AES-256-GCM at rest). Read with `getSetting`/`getSettingNumber`/`getSettingBool`.
- **Backward compatibility:** new `SMS_PROVIDER` falls back to the existing
  `SMS_OTP_PROVIDER` value when `SMS_PROVIDER` is unset, so current installs keep
  working.
- **Provider message id** extraction lives in
  `src/lib/comms/record.ts::extractProviderMessageId`; webhook secret/auth +
  status maps live in `src/lib/comms/webhook.ts`. Extend those, don't fork them.
- **UI:** Persian-first, `dir="rtl"`. Follow existing admin patterns.
- **Commit** at the end of each task with a clear conventional-commit message.

## Self-hosted gateway contract (authoritative — Tasks 1 & 3)

App → gateway (send):
```
POST {SELFHOSTED_SMS_BASE_URL}{SELFHOSTED_SMS_SEND_PATH}      # SEND_PATH default "/messages"
Headers: Authorization: Bearer {SELFHOSTED_SMS_TOKEN}, Content-Type: application/json
Body:    { "to": "<phone>", "type": "sms" | "call", "message": "<text>", "from": "<sender?>" }
2xx JSON response: { "id": "<messageId>", "status": "queued"|"sent"|"failed" }
```
Gateway → app inbound (received SMS):
```
POST /api/webhooks/sms/selfhosted/receive?secret=<SELFHOSTED_WEBHOOK_SECRET>
Body: { "from": "<sender>", "to": "<our number>", "message": "<text>" }
```
Gateway → app delivery status:
```
POST /api/webhooks/sms/selfhosted/delivery?secret=<SELFHOSTED_WEBHOOK_SECRET>
Body: { "id": "<messageId>", "status": "delivered"|"failed"|"undelivered"|... }
```

---

## Task 1: Provider interface + registry + three adapters + settings keys

**Where it fits:** the foundation other tasks build on. Defines the provider
contract, implements all three adapters by composing existing client logic, and
registers the new settings keys. No call sites change yet (Task 2 does that).

**Read first:** `src/lib/sms/kavenegar.ts`, `src/lib/sms/order-codes.ts`,
`src/lib/sms/text.ts`, `src/lib/sms/ippanel.ts`, `src/lib/sms/otp.ts`,
`src/lib/sms/delivery.ts`, `src/lib/settings.ts`.

**Create `src/lib/sms/providers/types.ts`:**
```ts
import type { OtpDeliveryResult } from "@/lib/sms/delivery";

export type SmsChannel = "sms" | "call";
export type SmsProviderId = "kavenegar" | "ippanel" | "selfhosted";

export interface SmsProvider {
  readonly id: SmsProviderId;
  readonly supportsVoice: boolean;
  /** OTP delivery — text (sms) or a voice call that reads the code (call). */
  sendOtp(phone: string, code: string, channel: SmsChannel): Promise<OtpDeliveryResult<unknown>>;
  /** Free-text SMS (order codes, admin test, generic). */
  sendText(phone: string, message: string): Promise<OtpDeliveryResult<unknown>>;
}
```

**Create the three adapters** (each exports a `const <id>Provider: SmsProvider`):
- `src/lib/sms/providers/kavenegar.ts` — `sendOtp` delegates to existing
  `sendKavenegarOtp(phone, code, channel)`; `sendText` delegates to the Kavenegar
  `sms/send` call (reuse `sendSmsText` from `src/lib/sms/text.ts`).
  `supportsVoice: true`.
- `src/lib/sms/providers/ippanel.ts` — `sendOtp`: for `channel === "sms"` delegate
  to `sendIppanelOtp(phone, code)`; for `channel === "call"` return
  `{ status: "skipped", message: "IPPanel does not support voice.", payload: null }`.
  `sendText(phone, message)`: POST `https://edge.ippanel.com/v1/api/send` with
  `{ sending_type: "webservice", from_number: <IPPANEL_SENDER>, message, recipients: ["<+98…>"] }`,
  header `Authorization: <IPPANEL_API_KEY>`; success when `meta.status === true`,
  message id at `data.message_outbox_ids[0]`; mirror the error handling and the
  `toE164Iran` normalization already in `src/lib/sms/ippanel.ts` (export/reuse the
  helper rather than duplicating it). `supportsVoice: false`.
- `src/lib/sms/providers/selfhosted.ts` — implements the gateway contract above.
  `sendOtp(phone, code, channel)`: body `{ to: phone, type: channel, message: <code or a short OTP text> }`;
  `sendText(phone, message)`: body `{ to: phone, type: "sms", message }`. Reads
  `SELFHOSTED_SMS_BASE_URL`, `SELFHOSTED_SMS_TOKEN`, `SELFHOSTED_SMS_SEND_PATH`
  (default `/messages`), `SELFHOSTED_SENDER` (optional `from`). Unconfigured
  (no base URL or token) → `skipped`. Timeout via
  `getSettingNumber("SELFHOSTED_SMS_TIMEOUT_MS", 10_000)`. Map response: HTTP 2xx
  + `status` not `"failed"` → `sent` (or `pending` if `status === "queued"`);
  else `failed`. `supportsVoice: true`. Never throw.

**Create `src/lib/sms/providers/index.ts`:**
```ts
export function getSmsProvider(id: string): SmsProvider // throws on unknown id
export async function resolveSmsProviderId(): Promise<SmsProviderId>   // SMS_PROVIDER ?? SMS_OTP_PROVIDER ?? "kavenegar"
export async function resolveVoiceProviderId(): Promise<SmsProviderId> // VOICE_PROVIDER ?? "kavenegar"
export async function resolveSmsProvider(): Promise<SmsProvider>
export async function resolveVoiceProvider(): Promise<SmsProvider>
```
Normalize setting values to lowercase; unknown values fall back to `kavenegar`.

**Add to `SETTINGS_REGISTRY` (`src/lib/settings.ts`), group `"sms"`:**
- `SMS_PROVIDER` — label "ارائه‌دهنده پیامک", `choices: ["kavenegar","ippanel","selfhosted"]`, default `"kavenegar"`.
- `VOICE_PROVIDER` — label "ارائه‌دهنده تماس صوتی", `choices: ["kavenegar","selfhosted"]`, default `"kavenegar"`.
- `SELFHOSTED_SMS_BASE_URL` — label "گیت‌وی اختصاصی: آدرس پایه".
- `SELFHOSTED_SMS_TOKEN` — secret, label "گیت‌وی اختصاصی: توکن".
- `SELFHOSTED_SMS_SEND_PATH` — label "گیت‌وی اختصاصی: مسیر ارسال", default `"/messages"`.
- `SELFHOSTED_SENDER` — label "گیت‌وی اختصاصی: شماره فرستنده".
- `SELFHOSTED_SMS_TIMEOUT_MS` — label "گیت‌وی اختصاصی: تایم‌اوت (ms)", default `"10000"`.
- `SELFHOSTED_WEBHOOK_SECRET` — secret, label "گیت‌وی اختصاصی: کلید وب‌هوک",
  hint "آدرس کال‌بک را با ?secret=<این مقدار> در گیت‌وی تنظیم کنید.".

Add an OPTIONAL `choices?: string[]` field to the `SettingDef` type (Task 5 renders
it; just declare it here). Mark `SMS_OTP_PROVIDER`'s hint as deprecated in favor of
`SMS_PROVIDER` (keep the key).

**Tests (`src/lib/sms/providers/*.test.ts`):**
- selfhosted `sendText`/`sendOtp` build the correct URL, Authorization header, and
  JSON body (mock `fetch`); unconfigured → `skipped`; non-2xx → `failed`; thrown
  fetch → `failed` (never throws).
- ippanel `sendOtp("…","…","call")` → `skipped`.
- registry: `getSmsProvider` returns the right adapter and throws on unknown;
  `resolveSmsProviderId` honors `SMS_PROVIDER`, falls back to `SMS_OTP_PROVIDER`,
  then `kavenegar` (mock `getSetting`).

**Verify:** `bunx vitest run src/lib/sms/providers` green; `bun run check` clean.

---

## Task 2: Route all sends through the registry

**Where it fits:** makes the selectors actually take effect. Existing senders
hardcode Kavenegar/IPPanel; switch them to dispatch by the resolved provider.

**Read first:** `src/lib/sms/otp.ts`, `src/lib/sms/order-codes.ts`,
`src/lib/comms/send.ts`, `src/lib/sms/providers/index.ts` (from Task 1).

**Changes:**
- `src/lib/sms/otp.ts::sendOtp(phone, code, channel)` → resolve provider by
  channel: `channel === "call"` ? `resolveVoiceProvider()` : `resolveSmsProvider()`,
  then call `provider.sendOtp(phone, code, channel)`. Remove the old inline
  kavenegar/ippanel branching. If the resolved voice provider's
  `supportsVoice === false`, fall back to the kavenegar provider for the call.
- Order-codes: route the actual send through `resolveSmsProvider().sendText(...)`.
  Keep `buildOrderCodesSms` (body builder) as-is; replace only the Kavenegar HTTP
  call. Keep `OrderCodesSmsInput` and `sendOrderCodesSms`'s signature unchanged so
  `src/lib/comms/send.ts` callers don't change.
- `src/lib/comms/send.ts`: replace the `otpProvider()` helper (which guessed the
  provider from settings) with the actual resolved provider id
  (`resolveSmsProviderId()` / `resolveVoiceProviderId()`), so `commLogs.provider`
  reflects what was really used. `sendTestSms` routes through
  `resolveSmsProvider().sendText(...)` and logs the resolved provider id.

**Tests:** dispatch test — with `SMS_PROVIDER="ippanel"` (mock `getSetting`),
`sendOtp(phone, code, "sms")` calls the ippanel adapter; with `"call"` it uses the
voice provider; voice fallback when `supportsVoice` is false.

**Verify:** `bunx vitest run src/lib/sms` green; existing comms tests
(`bunx vitest run src/lib/comms`) still green; `bun run check` clean.

---

## Task 3: Self-hosted webhooks + IPPanel delivery refinement

**Where it fits:** completes "receive webhooks for all" and the self-hosted
delivery path; tightens the IPPanel delivery hook.

**Read first:** `src/lib/comms/webhook.ts`, the existing routes under
`src/app/api/webhooks/sms/kavenegar/` and `src/app/api/webhooks/sms/ippanel/`,
`src/lib/comms/record.ts::extractProviderMessageId`.

**Changes:**
- `src/lib/comms/webhook.ts`: add
  `mapSelfhostedDeliveryStatus(raw: string): CommStatus` — `"delivered"→DELIVERED`,
  `"failed"|"undelivered"→UNDELIVERED`, else `PENDING`. Unit-test it.
- `src/lib/comms/record.ts::extractProviderMessageId`: add a `"selfhosted"` case
  reading `payload.id` (string). Unit-test it.
- New routes (mirror the existing kavenegar handlers exactly — rate-limit,
  `verifyWebhookSecret(request, "SELFHOSTED_WEBHOOK_SECRET")`, record event,
  401 on bad secret, always 200 on auth pass):
  - `src/app/api/webhooks/sms/selfhosted/delivery/route.ts` — parse `id` + `status`
    via `pickString`, `applyDeliveryStatus(id, mapSelfhostedDeliveryStatus(status))`,
    record `delivery_status` event (provider `"selfhosted"`).
  - `src/app/api/webhooks/sms/selfhosted/receive/route.ts` — `recordInbound`
    (channel `"SMS"`, provider `"selfhosted"`, to/from/message via `pickString`),
    record `inbound` event.
- IPPanel delivery refinement (`src/app/api/webhooks/sms/ippanel/delivery/route.ts`):
  IPPanel delivery callbacks are loosely documented — keep defensive parsing but
  add a top-of-file comment block documenting where the operator registers this
  URL in the IPPanel panel and the field names currently parsed. If you can
  confirm IPPanel's real delivery field names (via Context7 / IPPanel docs), align
  `pickString` keys to them; otherwise leave the defensive keys and note it.

**Tests:** `mapSelfhostedDeliveryStatus` cases; `extractProviderMessageId`
selfhosted case. (Route handlers are thin; the controller smoke-tests them.)

**Verify:** `bunx vitest run src/lib/comms` green; `bun run check` clean.

---

## Task 4: Admin UI — provider dropdowns

**Where it fits:** surfaces the selectors. The `choices` field exists on
`SettingDef` (Task 1); render it.

**Read first:** `src/components/admin/settings-management.tsx`, `src/lib/settings.ts`
(`AdminSettingRow` type + `getSettingsForAdmin`).

**Changes:**
- Thread `choices` through to the admin view: add `choices?: string[]` to
  `AdminSettingRow` and populate it in `getSettingsForAdmin` from the registry def.
- `src/components/admin/settings-management.tsx`: the `Row` type gains
  `choices?: string[]`. When a row has `choices`, render a `<select>` (same styling
  language as the existing inputs: `h-10 rounded-xl border border-border bg-muted/30
  px-3 text-sm`) listing the choices instead of the `<input>`; selecting a value and
  pressing the existing ذخیره (save) button persists it via the existing
  `save(key, value)` path. Non-`choices` rows keep the current input behavior
  unchanged. Secret rows are never `choices`.

**Tests:** none required (presentational). Controller verifies via build + a prod
smoke later.

**Verify:** `bun run check` clean. Do not run `next build` (controller does).
