# Design: Account Redesign + Profile, and Admin Panel Fix/Polish

Date: 2026-06-19
Status: Approved

## Goal

The account page is a bare phone number + two flat lists; the admin panel's
sidebar overlaps its content and the dashboard is plain. Redesign the account
page with a real **profile** (name, email, default shipping address), polish the
orders/payments, and **fix + polish the admin panel** — all on shadcn/ui.

## Decisions (locked with user)

- Editable profile fields: **full name + email + a default shipping address**
  (recipient name = full name, phone = login phone). Phone stays read-only.
- Scope: **both** the account redesign and the admin fix/polish this round.

## Schema (drizzle, `db:push`)

`users` already has `email` (unique) and `fullName`. Add a default shipping
address (reused at checkout):

- `defaultAddressLine: text`
- `defaultCity: text`
- `defaultProvince: text`
- `defaultPostalCode: text`

(All nullable.)

## Profile API + service

- `src/lib/account.ts` → `updateProfile(userId, input)` where
  `input = { fullName?, email?, defaultAddressLine?, defaultCity?, defaultProvince?, defaultPostalCode? }`.
  Trims/normalizes; if `email` set, enforce uniqueness (reject `EMAIL_TAKEN` if another user has it); empty strings → `null`.
- `PATCH /api/account/profile` — auth required (the session user; 401 `AUTH_REQUIRED`). Validates email format. Returns `{ data: { user } }` (safe fields only) or `{ error: { code, message } }` (`EMAIL_TAKEN`, `INVALID_EMAIL`). Standard envelope.

## Account page redesign (`/account`)

- **Profile card** (shadcn `Card`): avatar (initials from name/phone), full name (or «کاربر مهمان» placeholder), phone (read-only, `dir=ltr`), email, a premium badge («طلایی») when premium, «عضو از <fa date>». An «ویرایش پروفایل» button opens an edit form (a `Dialog` or inline section) with `Input`s for name, email, and the four address fields; submit → `PATCH /api/account/profile`, then `router.refresh()`. Inline Persian errors.
- **Orders** + **Payments** sections (shadcn `Card`): each row shows the number/id, a **Persian colored status `Badge`** (map enums → fa labels + semantic color), the total (`formatToman`), and the date; each order links to `/account/orders/[id]`. Proper empty states («هنوز سفارشی ثبت نشده»).
- A **logout** action (reuse `/api/auth/logout`).
- Layout: responsive — profile card on top, orders/payments below (1 col mobile, 2 col lg).

Status label/color maps live in one small helper (`src/lib/status-labels.ts`) reused by account + admin.

## Checkout prefill

`/checkout` (server) reads the user's default address; `checkout-client.tsx`
prefills the address `Input`s with it (still editable). No behavior change when
no default exists.

## Admin panel fix + polish

- **Fix the overlap** — rebuild `src/app/admin/layout.tsx` to shadcn's canonical
  structure: `<SidebarProvider><AdminSidebar/><SidebarInset>…</SidebarInset></SidebarProvider>`
  (no extra wrapper `div`, sidebar first). `SidebarProvider` is the flex wrapper;
  `SidebarInset` reserves space via shadcn's gap mechanism. Keep `side="right"`
  for RTL. Header keeps `SidebarTrigger` + title.
- **Dashboard polish** (`src/app/admin/page.tsx`): stat cards (orders/products/users
  counts) and quick-action cards on shadcn `Card` with icons; clean grid, no
  cut-off. Keep existing data queries.

## shadcn

Add `card` and `label` (the rest — badge, avatar, input, button, dialog/sheet,
separator — are installed).

## Verification

- `bun run build` type-checks + builds.
- In-browser (admin session via dev OTP debug): `/account` (profile card, edit
  saves, badges, orders link) and `/admin` (no overlap, polished dashboard) on
  mobile + desktop; `scrollWidth == viewport`; 0 console errors. Screenshot each.
- Vitest: existing suite green + a small `updateProfile` test (email-uniqueness).

## Out of scope

- Avatar image upload (initials only).
- Address book / multiple addresses (one default).
- Order filtering/pagination on the account page.

## Build order

1. Schema (4 address columns) + `db:push`; add shadcn `card`/`label`.
2. `src/lib/status-labels.ts` (fa status maps).
3. `lib/account.ts` `updateProfile` (+ test) + `PATCH /api/account/profile`.
4. Account page redesign (profile card + edit + orders/payments).
5. Checkout prefill from default address.
6. Admin layout fix + dashboard polish.
7. Browser verification (account + admin) + fixes.
