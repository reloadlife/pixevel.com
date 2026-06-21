# Account Expansion — Build Contract (source of truth)

Single source of truth for the multi-agent `/account` expansion. **Every agent implements against this. Do not invent table/column/route names — use the ones here verbatim so imports line up.**

## Product context
Pixevel = Persian-first, RTL digital/gaming store (gift cards, CD keys) + domains + servers. Mobile-first. Premium/VIP users get gold accent. UI ref: Gymshark interaction quality. Bottom nav on mobile.

## House style (MANDATORY)
- **Lang/dir**: All user-facing copy in Persian. Pages/containers use `dir="rtl"`. LTR only for codes/emails/phones/money digits via `dir="ltr"` on that element.
- **Auth**: `import { getCurrentUser } from "@/lib/auth"`. Pages: `const u = await getCurrentUser(); if (!u) redirect("/login?redirect=<path>")`. API routes: `if (!user) return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401)`.
- **DB**: `import { getDb } from "@/lib/db"`. Use the relational query API `db.query.<table>.findMany/findFirst({ where, with, orderBy, limit })` when possible; fall back to query builder for mutations. Tables/enums from `@/db/schema`.
- **API envelope**: `import { apiOk, apiError, readJson } from "@/lib/api"`. Success → `apiOk(data, init?)`. Error → `apiError(code, messageFa, status)`. Never leak DB/stack errors. Codes are SCREAMING_SNAKE; messages Persian.
- **Money**: `import { formatToman } from "@/lib/format"`. Amounts are numeric strings (`numeric`); pass `.toString()`.
- **Status tones**: `import { type StatusTone, toneClass } from "@/lib/status-labels"`; tones: `success|warning|danger|muted` (+ any existing). Order/payment label helpers already in `@/lib/status-labels`.
- **Dates**: render with `new Date(v).toLocaleDateString("fa-IR", { year:"numeric", month:"long", day:"numeric" })`. Add a local `faDate` helper per file (existing convention) OR reuse if a shared one is created.
- **UI kit** (`@/components/ui/*`): `card`, `button`, `input`, `label`, `badge`, `avatar`, `skeleton`, `sheet`, `drawer`, `scroll-area`, `separator`, `dropdown-menu`, `tooltip`, `sidebar`. Icons: `lucide-react`. Toasts: `import { toast } from "sonner"`. Client mutations: `fetch` + `router.refresh()` after success (see `profile-card.tsx`).
- **`cn`**: `import { cn } from "@/lib/utils"`.
- **Server-first**: pages are server components doing the data fetch; interactive bits are small `"use client"` child components.
- **Tooling**: Bun only. After writing, run `bunx biome check --write <your files>` (format+lint+organize-imports). Do NOT run `next build`, `tsc`, eslint, or prettier. Do NOT edit `src/db/schema.ts` or `src/app/account/layout.tsx` unless you are the FOUNDATION agent.

## Route map (final URLs)
Account shell at `/account` with shared `layout.tsx` (sidebar desktop / sheet+links mobile) linking ALL of:
- `/account` — dashboard (FOUNDATION)
- `/account/orders` — order history (list, filter, search, paginate)
- `/account/orders/[id]` — order detail (EXISTS — orders agent may enhance: reorder, cancel/refund request)
- `/account/payments` — payments + receipts
- `/account/keys` — digital keys/licenses vault
- `/account/wishlist` — wishlist
- `/account/addresses` — address book
- `/account/wallet` — wallet balance, ledger, redeem gift card
- `/account/rewards` — loyalty points
- `/account/referrals` — referral program
- `/account/reviews` — my product reviews
- `/account/notifications` — notification inbox
- `/account/settings` — profile + notification preferences + security entry points
- `/account/security` — active sessions + login history
- `/account/domains` — EXISTS (services agent enhances: renew/auto-renew/expiry)
- `/account/servers` — EXISTS (services agent enhances)
- `/account/support` — support tickets

API under `/api/account/*` (and a few `/api/*`). Each listed in the feature sections below.

## Schema additions (FOUNDATION implements exactly; others import)
Match existing style: `pgTable("PascalName", { camelCols })`, `uuid("id").primaryKey().defaultRandom()`, shared `createdAt`/`updatedAt`, `numeric(name, price)` for money, `pgEnum` for enums, `index(...)`/`uniqueIndex(...)` in the table's 3rd arg, relations appended to the relations block. Add new relations onto `usersRelations`.

### New columns on `users` (`"User"`)
- `avatarUrl: text("avatarUrl")`
- `emailVerifiedAt: timestamp("emailVerifiedAt", { mode: "date" })`
- `referralCode: text("referralCode").unique()`
- `referredByUserId: uuid("referredByUserId").references((): AnyPgColumn => users.id, { onDelete: "set null" })` (self-ref; use the existing self-ref pattern if present, else `AnyPgColumn` from drizzle-orm/pg-core)

### New enums
- `walletTxnDirection` = `["CREDIT","DEBIT"]`
- `walletTxnReason` = `["TOPUP","PURCHASE","REFUND","GIFT_CARD","REFERRAL_REWARD","LOYALTY_REDEEM","ADJUSTMENT"]`
- `loyaltyTxnReason` = `["EARN","REDEEM","EXPIRE","ADJUST","REFERRAL"]`
- `notificationType` = `["ORDER","PAYMENT","PROMO","SYSTEM","SECURITY"]`
- `giftCardStatus` = `["ACTIVE","REDEEMED","DISABLED","EXPIRED"]`
- `referralStatus` = `["PENDING","QUALIFIED","REWARDED"]`
- `supportTicketStatus` = `["OPEN","PENDING","RESOLVED","CLOSED"]`

### New tables
- `userAddresses` `"UserAddress"`: id, userId(fk users cascade, notNull), titleFa text, fullName text, phone text, province text, city text, addressLine text, postalCode text, isDefault boolean default false notNull, createdAt, updatedAt. index userId.
- `wishlistItems` `"WishlistItem"`: id, userId(fk cascade notNull), productId(fk products cascade notNull), createdAt. uniqueIndex(userId, productId), index userId.
- `wallets` `"Wallet"`: id, userId(fk cascade notNull, unique), balanceAmount numeric(price) default "0" notNull, currency text default "IRR" notNull, createdAt, updatedAt.
- `walletTransactions` `"WalletTransaction"`: id, walletId(fk wallets cascade notNull), direction walletTxnDirection notNull, reason walletTxnReason notNull, amount numeric(price) notNull (always positive), balanceAfter numeric(price) notNull, orderId(fk orders set null) nullable, giftCardId(fk giftCards set null) nullable, note text, createdAt. index walletId.
- `giftCards` `"GiftCard"`: id, code text notNull unique, initialAmount numeric(price) notNull, balanceAmount numeric(price) notNull, currency text default "IRR" notNull, status giftCardStatus default "ACTIVE" notNull, issuedToUserId(fk users set null) nullable, redeemedByUserId(fk users set null) nullable, redeemedAt timestamp nullable, expiresAt timestamp nullable, createdAt, updatedAt. index code, index status.
- `loyaltyAccounts` `"LoyaltyAccount"`: id, userId(fk cascade notNull unique), pointsBalance integer default 0 notNull, lifetimePoints integer default 0 notNull, tier text default "BRONZE" notNull, createdAt, updatedAt.
- `loyaltyTransactions` `"LoyaltyTransaction"`: id, userId(fk cascade notNull), points integer notNull (signed: +earn / -redeem), reason loyaltyTxnReason notNull, orderId(fk orders set null) nullable, note text, createdAt. index userId.
- `referrals` `"Referral"`: id, referrerUserId(fk users cascade notNull), refereeUserId(fk users set null) nullable, refereePhone text, status referralStatus default "PENDING" notNull, rewardPoints integer default 0 notNull, rewardedAt timestamp nullable, createdAt, updatedAt. index referrerUserId.
- `notifications` `"Notification"`: id, userId(fk cascade notNull), type notificationType notNull, titleFa text notNull, bodyFa text, href text, readAt timestamp nullable, createdAt. index (userId, createdAt), index (userId, readAt).
- `notificationPreferences` `"NotificationPreference"`: id, userId(fk cascade notNull unique), orderEmail boolean default true notNull, orderSms boolean default true notNull, promoEmail boolean default false notNull, promoSms boolean default false notNull, newsletterEmail boolean default false notNull, createdAt, updatedAt.
- `supportTickets` `"SupportTicket"`: id, userId(fk cascade notNull), orderId(fk orders set null) nullable, subjectFa text notNull, status supportTicketStatus default "OPEN" notNull, lastMessageAt timestamp, createdAt, updatedAt. index userId, index status.
- `supportMessages` `"SupportMessage"`: id, ticketId(fk supportTickets cascade notNull), authorUserId(fk users set null) nullable, isStaff boolean default false notNull, bodyFa text notNull, createdAt. index ticketId.

### Relations to add onto `usersRelations` (many): addresses, wishlistItems, walletTransactions(via wallet one), notifications, referralsMade(referrals), supportTickets, loyaltyTransactions. Add `one` relations: wallet, loyaltyAccount, notificationPreferences. Add child-table relations blocks (e.g. `wishlistItemsRelations` → user + product; `walletTransactionsRelations` → wallet; etc.).

### Migration
FOUNDATION runs: `bun run db:generate` (creates `drizzle/0001_*.sql`) then `bun run db:migrate`. If migrate errors on journal drift, fall back to `bun run db:push`. Report applied result. DB is reachable (DATABASE_URL set in `.env`).

## Business-rule defaults (document as assumptions; tune later)
- **Loyalty earn**: 1 point per 10,000 Toman of PAID order subtotal. **Redeem**: 1 point = 100 Toman wallet credit (min redeem 100 pts). **Tiers** by lifetimePoints: BRONZE 0+, SILVER 5,000+, GOLD 20,000+.
- **Referral**: referrer earns 500 points when referee's first order reaches PAID; referee gets 200-point welcome on signup via a referral code. `referralCode` = short base36 of user id / random, unique.
- **Wallet**: single currency IRR. Every mutation writes a `walletTransactions` row with `balanceAfter`. Redeeming a gift card credits wallet (reason GIFT_CARD) and marks the gift card REDEEMED (or decrements balance if partial — keep simple: full redeem to wallet).
- These are placeholders centralised in each feature's lib (e.g. `LOYALTY_EARN_RATE`) so they're trivially tunable.

## Per-feature ownership (disjoint files)
Each agent OWNS only the files it creates/edits below. Never touch another feature's files, `schema.ts`, or `account/layout.tsx`.

1. **dashboard+nav (FOUNDATION)**: `src/app/account/layout.tsx`, `src/app/account/page.tsx` (replace), `src/lib/account/dashboard.ts` (stats aggregation), shared `src/components/account/account-nav.tsx`. Pre-create EVERY nav link in route map.
2. **orders**: `src/app/account/orders/page.tsx`, `src/app/account/orders/orders-list.tsx` (client filter/search/paginate), enhance `src/app/account/orders/[id]/page.tsx` (+reorder/cancel buttons), `src/app/api/account/orders/route.ts`, `src/app/api/orders/[id]/reorder/route.ts`, `src/app/api/orders/[id]/cancel/route.ts`, `src/lib/orders/account-orders.ts`.
3. **payments**: `src/app/account/payments/page.tsx`, `src/app/api/account/payments/route.ts`. Link each payment to `/account/orders/[orderId]`; show `receiptUrl` download when present.
4. **keys vault**: `src/app/account/keys/page.tsx`, `src/app/account/keys/key-card.tsx` (mask/reveal/copy client), `src/app/api/account/keys/route.ts`, `src/app/api/account/keys/resend/route.ts` (resend codes to email; reuse `src/lib/email/*` + `src/lib/sms/order-codes.ts` patterns), `src/lib/account/keys.ts` (gather SOLD inventoryUnits for the user's PAID orders).
5. **wishlist**: `src/app/account/wishlist/page.tsx`, `src/app/api/wishlist/route.ts` (GET/POST/DELETE), `src/components/wishlist/wishlist-button.tsx` (reusable add/remove), `src/lib/account/wishlist.ts`.
6. **addresses**: `src/app/account/addresses/page.tsx`, `src/app/account/addresses/address-form.tsx`, `src/app/api/account/addresses/route.ts` (GET/POST), `src/app/api/account/addresses/[id]/route.ts` (PATCH/DELETE + set-default), `src/lib/account/addresses.ts`.
7. **wallet**: `src/app/account/wallet/page.tsx`, `src/app/account/wallet/redeem-form.tsx`, `src/app/api/account/wallet/route.ts`, `src/app/api/account/wallet/redeem/route.ts`, `src/lib/account/wallet.ts` (creditWallet/debitWallet/getOrCreateWallet/redeemGiftCard — atomic via tx, writes ledger + balanceAfter).
8. **loyalty**: `src/app/account/rewards/page.tsx`, `src/app/api/account/loyalty/route.ts`, `src/app/api/account/loyalty/redeem/route.ts` (points → wallet credit; depends on wallet lib — import it), `src/lib/account/loyalty.ts` (constants + earnPoints/redeemPoints/getOrCreateAccount/computeTier).
9. **referral**: `src/app/account/referrals/page.tsx`, `src/app/api/account/referrals/route.ts`, `src/lib/account/referrals.ts` (ensureReferralCode, list invited, reward logic helper).
10. **reviews**: `src/app/account/reviews/page.tsx`, `src/app/account/reviews/review-row.tsx` (edit/delete client), `src/app/api/account/reviews/route.ts` (GET list), `src/app/api/account/reviews/[id]/route.ts` (PATCH/DELETE), `src/lib/account/reviews.ts`.
11. **notifications**: `src/app/account/notifications/page.tsx`, `src/app/account/notifications/inbox.tsx` (client mark-read), `src/app/api/account/notifications/route.ts` (GET + PATCH mark-read/mark-all), `src/lib/account/notifications.ts` (createNotification helper for other code to call).
12. **settings+profile**: `src/app/account/settings/page.tsx`, profile editor (enhance/reuse `src/components/account/profile-card.tsx`), notification-preferences form `src/app/account/settings/notification-prefs.tsx`, phone-change OTP `src/components/account/phone-change.tsx`, avatar upload `src/components/account/avatar-upload.tsx`. APIs: `src/app/api/account/phone/request-otp/route.ts`, `src/app/api/account/phone/verify/route.ts`, `src/app/api/account/avatar/route.ts`, `src/app/api/account/notification-preferences/route.ts`, `src/app/api/account/delete/route.ts`, `src/app/api/account/export/route.ts`. Extend `src/lib/account.ts` (add avatar/phone helpers). Reuse `src/lib/otp.ts`, `src/lib/phone.ts`, `src/lib/session.ts`, `src/lib/sms/kavenegar.ts`, `src/app/api/admin/uploads` pattern for avatar upload.
13. **security**: `src/app/account/security/page.tsx`, `src/app/account/security/session-row.tsx` (revoke client), `src/app/api/account/sessions/route.ts` (GET list), `src/app/api/account/sessions/[id]/route.ts` (DELETE revoke), `src/lib/account/sessions.ts`. Show `lastLoginAt`, mark current session.
14. **services (domains/servers)**: enhance `src/app/account/domains/page.tsx` + `src/app/account/servers/page.tsx` (expiry warnings, renew button, auto-renew indicator), `src/app/api/domains/[id]/renew/route.ts`, `src/app/api/account/servers/[id]/renew/route.ts`, `src/lib/account/services.ts`.
15. **support**: `src/app/account/support/page.tsx`, `src/app/account/support/[id]/page.tsx`, `src/app/account/support/new-ticket.tsx` + `src/app/account/support/[id]/reply.tsx` (client), `src/app/api/account/support/route.ts` (GET list / POST create), `src/app/api/account/support/[id]/route.ts` (GET thread / POST reply), `src/lib/account/support.ts`.

## Definition of done (per agent)
- Files created per ownership list, following house style.
- Persian copy, RTL, mobile-first, empty states with CTA, premium gold accent where relevant.
- API routes return the standard envelope, auth-gated, no leaked errors.
- Ran `bunx biome check --write` on own files (report result).
- Did NOT run `next build` / edit forbidden shared files.
- Return a short summary: files created, routes added, assumptions made.
