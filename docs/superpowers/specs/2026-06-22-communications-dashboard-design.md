# Communications Dashboard (SMS / Voice / Email / Telegram) — Design

- **Date:** 2026-06-22
- **Status:** Approved (pending written-spec review)
- **Topic:** A dedicated admin hub at **`/admin/communications`** that logs **every** outbound and inbound message across all channels (SMS, voice calls, email, Telegram), accepts provider **delivery-status callbacks** and **inbound-message webhooks**, and **owns the comms configuration** (provider tokens/passwords) moved out of `/admin/settings`.
- **Related:** reuses `src/lib/settings.ts` (`SETTINGS_REGISTRY` + `AppSetting`) and `src/lib/crypto/secrets.ts` (AES-256-GCM vault, `APP_VAULT_KEY`). Follows the `/admin/settings` page/API conventions.

---

## 1. Background & current state

Messaging today is **fire-and-forget** with no persistent ledger:

- **Providers:** Kavenegar (OTP via `verify/lookup`, voice OTP via `type=call`, plain order-code SMS via `sms/send`), IPPanel (pattern OTP SMS), Telegram (dev-only OTP relay), Resend (email). All live under `src/lib/sms/*` and `src/lib/email/*`.
- Every send returns `OtpDeliveryResult<T> { status, message, payload }` (`src/lib/sms/delivery.ts`) and is then **discarded**. The only trace is OTP sends, which write a `LoginOtp` row carrying `providerStatus`/`providerMessage`/`providerPayload`. Order-code SMS, voice calls, and email leave **no record**.
- **No inbound or callback endpoints exist.** Nothing receives Kavenegar/IPPanel delivery receipts or incoming SMS.
- **Settings + secrets are already solved:** `AppSetting` table + `SETTINGS_REGISTRY` (keys = env-var names, secrets encrypted at rest). Existing admin surface at `/admin/settings` (`SettingsManagement` component, `GET/PUT /api/admin/settings`). The "tokens/passwords" the user wants surfaced ARE the `secret: true` registry keys.

### Decisions locked during brainstorming
1. **Channels:** all comms — SMS + voice + email + Telegram — in one hub.
2. **Log depth:** full — outbound + inbound received + delivery callbacks.
3. **Settings:** **move** comms settings (sms + email + telegram keys) into the hub. `/admin/settings` retains payments + exchange-rate + general. No data migration — same keys, UI filter only.
4. **Retention:** keep everything indefinitely for now; a prune job/setting is a later pass (out of scope).

---

## 2. Goals / non-goals

### Goals
- New tables `commLogs` (message ledger, out+in) and `commWebhookEvents` (raw callback/webhook audit).
- A single comms-logging boundary (`src/lib/comms/`) that records every send with redaction; raw provider clients stay pure.
- Authenticated webhook routes for delivery-status callbacks and inbound SMS (Kavenegar + IPPanel).
- Admin hub `/admin/communications` with tabs: Logs / Calls / Callbacks / Settings & Tokens.
- Admin read APIs for logs/callbacks/stats with cursor pagination.
- Move sms/email comms settings UI into the hub; add webhook-secret keys to the registry.

### Non-goals (this spec)
- Log retention / pruning job (deferred; keep-all for now).
- Two-way conversational SMS / chat UX. Inbound messages are recorded and viewable, not replied-to from the panel (a "reply" affordance can come later).
- Changing OTP/checkout/email business logic beyond swapping send calls to the logged wrappers.
- Provider-side webhook configuration (operator pastes the generated callback URL into the provider dashboard; we only provide + secure the endpoint).
- Reworking `/admin/settings` beyond filtering which groups it renders.

---

## 3. Data model

Two new tables. Each has one clear purpose: `commLogs` is the **message you read**; `commWebhookEvents` is the **raw audit of what providers POST back** (including unmatched/garbage hits — essential for debugging a misconfigured callback URL).

### 3.1 Enums
- `comm_direction`: `OUTBOUND` | `INBOUND`
- `comm_channel`: `SMS` | `VOICE` | `EMAIL` | `TELEGRAM`
- `comm_kind`: `OTP` | `ORDER_CODES` | `NOTIFICATION` | `INBOUND` | `TEST` | `OTHER`
- `comm_status`: `QUEUED` | `SENT` | `PENDING` | `DELIVERED` | `FAILED` | `SKIPPED` | `RECEIVED` | `UNDELIVERED`
  - Mapping from existing `OtpDeliveryStatus`: `sent→SENT`, `pending→PENDING`, `skipped→SKIPPED`, `failed→FAILED`. Callbacks then move a row to `DELIVERED`/`UNDELIVERED`. Inbound rows are born `RECEIVED`.

### 3.2 `commLogs` ("CommLog")
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `defaultRandom()` |
| `direction` | `comm_direction` | not null |
| `channel` | `comm_channel` | not null |
| `provider` | text | `kavenegar` \| `ippanel` \| `resend` \| `telegram` |
| `kind` | `comm_kind` | not null |
| `status` | `comm_status` | not null |
| `toAddress` | text | recipient (outbound) / sender (inbound). Phone or email. |
| `fromAddress` | text nullable | our sender line / their number |
| `body` | text nullable | message text. **Redacted for OTP** (see §6). |
| `providerMessageId` | text nullable | provider's id — the join key for callbacks |
| `errorMessage` | text nullable | failure reason (never a stack/secret) |
| `cost` | numeric nullable | provider-reported cost when present |
| `payload` | jsonb nullable | raw provider response, **redacted** (§6) |
| `userId` | uuid fk → users nullable | `onDelete: set null` |
| `orderId` | uuid fk → orders nullable | links order-code SMS to its order |
| `createdAt` | timestamp | shared `createdAt` helper |
| `updatedAt` | timestamp | shared `updatedAt` helper (bumped by callbacks) |

Indexes: `(channel, createdAt)`, `(toAddress, createdAt)`, `(providerMessageId)`, `(status)`.

### 3.3 `commWebhookEvents` ("CommWebhookEvent")
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `provider` | text | `kavenegar` \| `ippanel` |
| `channel` | `comm_channel` | |
| `type` | text | `delivery_status` \| `inbound` |
| `rawPayload` | jsonb | exactly what the provider POSTed |
| `matchedLogId` | uuid fk → commLogs nullable | set when a delivery callback matched a ledger row |
| `signatureValid` | boolean | not null — was the shared-secret check OK |
| `receivedAt` | timestamp | |

Relations: `commLogs.userId/orderId` → users/orders; `commWebhookEvents.matchedLogId` → commLogs. Both added to the relevant `relations(...)` blocks.

> **Migration note (project memory):** the 0000 baseline predates ~17 push-added tables, so `drizzle-kit generate` diffs against stale meta. Generate the migration, eyeball it for spurious drops, apply deliberately. After applying, **restart the dev server** — `getDb()` caches the drizzle client, so new-table queries 500 until restart.

---

## 4. Logging / instrumentation

New module `src/lib/comms/`:
- `record.ts` — `recordOutbound(input)` and `recordInbound(input)`: build + insert a `commLogs` row, applying redaction (§6) and status mapping. Never throws (logging must not break a send/checkout). On DB error it `console.error`s and returns.
- `send.ts` — logged wrappers that compose existing pure clients:
  - `sendOtpLogged(phone, code, channel)` → wraps `sendOtp`, records an OTP row (channel SMS or VOICE by `channel`), body redacted.
  - `sendOrderCodesLogged(input)` → wraps `sendOrderCodesSms`, kind ORDER_CODES, links `orderId`.
  - `sendEmailLogged(input)` → wraps the Resend client, channel EMAIL.
  - `sendTestSms(phone, text)` → kind TEST, used by the panel's "send test" button.

**Chosen approach: dispatch wrapper (C).** Considered: (A) write inside each provider client — couples 5 clients to the DB; (B) write at every call site — scatters logging, easy to miss one. (C) keeps clients pure and gives one redaction/persistence point.

Client change required: each client must surface `providerMessageId`. Add an optional `providerMessageId?: string` to `OtpDeliveryResult` and have each client extract it (`entries[0].messageid` for Kavenegar, `data.message_outbox_ids[0]` for IPPanel, `result.message_id` for Telegram). This is the key callbacks join on later.

Call sites updated to use the logged wrappers: `src/app/api/auth/request-otp/route.ts` (OTP), the order-codes caller (checkout/payment success path), the email caller. `LoginOtp` rows remain as-is (unchanged); the new `commLogs` OTP row is additive.

---

## 5. Webhooks — inbound + delivery callbacks (security-sensitive)

New route handlers under `src/app/api/webhooks/`:
- `sms/kavenegar/delivery/route.ts`, `sms/kavenegar/receive/route.ts`
- `sms/ippanel/delivery/route.ts`, `sms/ippanel/receive/route.ts`

Shared handler logic in `src/lib/comms/webhook.ts`:

1. **Authenticate** via a per-provider shared secret. New secret settings `KAVENEGAR_WEBHOOK_SECRET`, `IPPANEL_WEBHOOK_SECRET` (registry, `secret: true`). The operator configures the provider to call the URL including the secret (path segment or `?secret=` / header `x-webhook-secret`). Compare with `crypto.timingSafeEqual` (length-guarded). On mismatch/absence → record a `commWebhookEvents` row with `signatureValid: false` and return **401**.
2. On valid secret:
   - parse provider payload defensively (form or JSON; never trust shape),
   - write a `commWebhookEvents` row (`signatureValid: true`),
   - **delivery type:** look up `commLogs` by `providerMessageId`; if found, update `status` (`DELIVERED`/`UNDELIVERED`/`FAILED` per provider code) + `updatedAt`, set `matchedLogId`. Unmatched → event row stands alone (visible in Callbacks tab).
   - **receive type:** create an `INBOUND` `commLogs` row (`status: RECEIVED`, `toAddress` = our number, `fromAddress` = sender, `body` = text).
3. Always return **200** once the secret passes (even on a no-match) so providers don't disable the callback. Wrap body handling so a parse error still 200s after logging.

These endpoints are unauthenticated by session (providers can't log in) — the shared secret IS the auth. They must be excluded from any admin/auth middleware and rate-limited (`src/lib/rate-limit.ts`) per IP to blunt abuse.

---

## 6. Redaction (security)

A `redactCommPayload(obj)` helper in `src/lib/comms/record.ts`:
- For `kind === OTP`: `body` is set to a fixed marker (`"[otp]"` / template name), **never the code**.
- Deep-strip keys matching `/token|code|otp|secret|password|api[-_]?key|authorization/i` from any stored `payload`/`rawPayload`, replacing values with `"[redacted]"`.
- `errorMessage` is the provider's human message only — never a raw exception/stack.

This keeps the ledger useful for ops without persisting credentials or live OTP codes.

---

## 7. Admin surface

### 7.1 Page
`src/app/admin/communications/page.tsx` — server component, admin-gated exactly like `settings/page.tsx` (redirect non-admins). Renders a client `CommunicationsDashboard` with 4 tabs (shadcn `Tabs`), `dir="rtl"`:

| Tab | Persian | Source |
|---|---|---|
| همه پیام‌ها (Logs) | `GET /api/admin/comms/logs` | table: time, dir, channel, provider, kind, to/from, status badge, body snippet; row-expand → redacted payload; filters: channel, direction, status, phone/email search |
| تماس‌ها (Calls) | same API, `channel=VOICE` | same table preset to voice |
| کال‌بک‌ها (Callbacks) | `GET /api/admin/comms/callbacks` | provider, type, matched?, signatureValid badge, time, raw payload expand |
| تنظیمات و توکن‌ها (Settings & Tokens) | existing `GET/PUT /api/admin/settings` | `SettingsManagement` filtered to sms+email groups + webhook-secret keys; "send test SMS" form |

Header: stat cards from `GET /api/admin/comms/stats` (sent today / delivered / failed / received).

### 7.2 Admin APIs (new), all `requireAdmin()` + `apiOk`/`apiError`
- `GET /api/admin/comms/logs?channel=&direction=&status=&q=&cursor=&limit=` — cursor pagination (keyset on `createdAt,id` desc, default 50), returns `{ items, nextCursor }`.
- `GET /api/admin/comms/callbacks?provider=&type=&cursor=&limit=` — same shape.
- `GET /api/admin/comms/stats` — counts for header cards.
- `POST /api/admin/comms/test` — `{ phone, text }` → `sendTestSms`, returns the recorded log row. Admin-gated + rate-limited.

### 7.3 Settings move (UI-only)
- Add optional `groups?: SettingGroup[]` filter to `SettingsManagement` (filter `initialSettings` by group, server-side preferred).
- `/admin/settings` page → pass groups = all **except** `sms`/`email`.
- `/admin/communications` settings tab → pass groups = `["sms","email"]`. New `*_WEBHOOK_SECRET` keys live in the sms group, so they appear here automatically.
- Add nav entry `{ href: "/admin/communications", label: "ارتباطات", icon: MessageSquareIcon }` to `admin-sidebar.tsx` (near settings).

---

## 8. Build sequence
1. **Schema** — enums + `commLogs` + `commWebhookEvents` + relations; generate & apply migration (watch drift); restart dev server.
2. **Comms lib** — `record.ts` (+ redaction), `OtpDeliveryResult.providerMessageId` + client extraction, `send.ts` wrappers.
3. **Instrument call sites** — request-otp, order-codes, email → logged wrappers.
4. **Webhooks** — `webhook.ts` shared logic + 4 routes + registry secret keys; middleware/rate-limit exclusions.
5. **Admin APIs** — logs / callbacks / stats / test.
6. **Hub page** — `CommunicationsDashboard` + 4 tab components.
7. **Settings move** — `SettingsManagement` groups filter; update both pages; sidebar nav.

## 9. Testing
- Unit: status mapping, `redactCommPayload` (strips token/code/secret; OTP body never leaks), `providerMessageId` extraction per provider, webhook secret constant-time compare (reject on mismatch/missing/length-diff).
- Integration: delivery callback updates matched log → DELIVERED; unmatched callback stands alone; inbound webhook creates INBOUND row; bad secret → 401 + `signatureValid:false` event.
- Manual: send test SMS from panel → row appears with SENT; simulate a provider callback → row flips to DELIVERED, appears in Callbacks tab.

## 10. Open risks
- Provider callback payload shapes vary and are under-documented — parse defensively, store raw, never assume fields.
- Inbound "receive" requires a provider-side dedicated number/config the operator may not have yet; the endpoint + secret ship regardless and stay dormant until configured.
