<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pixevel Project Instructions

## Product Identity

Pixevel is an e-commerce clothing store. The primary catalog focus is underwear, lingerie, sleepwear, and costume-related products.

The site should feel premium, fast, direct, and fashion-retail oriented. Keep presentation tasteful and polished. Avoid sexualized, explicit, or model-heavy imagery unless the user specifically asks for a different direction.

The project is Persian-first and RTL-first unless the user explicitly changes the locale strategy.

## Technical Architecture

This project is fully written in Next.js.

Backend and frontend live together in the same Next.js app:

- Backend behavior belongs in API endpoints / route handlers.
- Frontend pages should use server-side rendering where it helps SEO.
- First page loads should be renderable by the server whenever practical.
- After the user is browsing the website, frontend interactions should call backend API endpoints for dynamic behavior.
- Keep backend contracts clean enough that an Android app can later consume the same API.

Use Drizzle ORM with PostgreSQL for persistence (schema in `src/db/schema.ts`, client via `getDb()` in `src/lib/db.ts`, migrations managed with drizzle-kit). Keep schema changes deliberate and compatible with the deployment flow.

## Package Manager

Use **Bun** for everything: dependency install (`bun install`), running scripts (`bun run <script>`), and one-off binaries (`bunx`). The lockfile is `bun.lock`. Never use npm, pnpm, or yarn, and do not commit `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`.

## Linting And Formatting

[Biome](https://biomejs.dev) is the single tool for both linting and formatting. Config lives in `biome.json`. ESLint and Prettier are not used and must not be reintroduced.

- `bun run lint` — lint only (`biome lint`).
- `bun run format` — format in place (`biome format --write`).
- `bun run check` — lint + format + organize imports, applied in place (`biome check --write`).
- CI runs `biome ci` (`.github/workflows/ci.yml`). Keep it green: zero errors. Pre-existing a11y findings are downgraded to warnings.

Never run ESLint, `next lint` (removed in Next 16), Prettier, or a standalone `tsc` / `tsc --noEmit`. Type checking happens automatically inside `next build` via TypeScript — there is no separate typecheck command. Editor integration (Biome as default formatter, format on save) is committed in `.vscode/settings.json`.

## API Standards

Design APIs as stable product-facing contracts, not one-off page helpers.

API responses should be consistently formatted and predictable. Prefer explicit fields, stable IDs, clear status values, pagination metadata for lists, and machine-readable error codes/messages.

The API should be suitable for:

- Next.js web frontend.
- A future Android application.
- Admin panel workflows.

Do not leak internal implementation details, database/ORM errors, stack traces, or sensitive fields to clients.

## UI/UX Direction

The design direction is Gymshark-like in UI/UX, commerce flow, product browsing, and add-to-basket behavior. Do not copy Gymshark assets, logos, exact text, protected imagery, or brand identity. Use it as a strong interaction and layout reference.

One key difference from Gymshark: the primary navigation belongs at the bottom of the viewport.

Bottom navigation requirements:

- It should behave like the main menu.
- It should stay at the bottom.
- It should hide when the user scrolls down.
- It should show again when the user scrolls up.
- It must work especially well on mobile.

Mobile UI/UX has higher priority than desktop UI/UX because most customers are expected to use phones.

## Admin Panel

The admin panel route is `/admin/`.

Admin is where operators manage:

- Orders.
- Products.
- Product variants.
- Inventory.
- Users.
- Homepage blocks.
- Product images and VIP image visibility.

Keep admin workflows dense, clear, and operational. Prefer practical forms, tables, filters, bulk actions, and status controls over marketing-style pages.

## Authentication And Users

Users log in with a phone number and OTP.

Anonymous users are allowed to browse and add products to their basket.

When an anonymous user starts checkout:

- Require phone + OTP login.
- Create or find the user by phone.
- Move the anonymous basket to the authenticated user.
- Do not make the user add basket items again.

Users can be marked premium/VIP.

Premium/VIP behavior:

- Premium users may see a gold accent color.
- Premium mode can switch the website to dark mode.
- Premium users can see VIP-only product images.

Users should be able to view:

- Order history.
- Payment history.

## Catalog And Product Rules

Each product can have:

- Multiple tags.
- One category.
- Temporary enabled/disabled status.
- Different prices for anonymous/public users, registered users, and premium users.
- Multiple images.
- Multiple dynamically generated variants.

Disabled products and out-of-stock products should still appear in search results, but they cannot be added to the basket.

Operators must be able to temporarily disable or re-enable a product.

## Variant Rules

Variants are generated dynamically from selected option values.

Initial variant dimensions:

- Size.
- Material.
- Color.

Example:

- Colors: red, green.
- Material: leather.
- Size: M.

This should generate two variants:

- Red / leather / M.
- Green / leather / M.

Each variant can have:

- Its own image set.
- Its own price.
- Its own inventory stock.

Product UI must show the generated variants clearly and let users select them.

## Inventory Rules

Inventory must be precise at the individual stock-unit level.

When an admin adds stock for a variant, create one database row per physical stock unit.

Example:

- Admin adds stock quantity `10` for variant `red / leather / M`.
- The system creates 10 stock-unit rows for that variant.

When a unit is sold:

- Assign one available stock-unit row to the order/user.
- Mark that specific unit as sold or reserved according to the checkout flow.

This precision is intentional. Do not replace it with only a quantity counter unless the user explicitly changes the inventory model.

## Product Images

If the user has not selected a variant, show all product images the user is allowed to see.

If the user selected a variant, show only images connected to that variant, plus any images intentionally marked as shared/global if that concept exists in the implementation.

Product images must be sortable in the admin UI.

Each image can be toggled as `vip_image`.

VIP image visibility:

- Premium/VIP users can see VIP images.
- Registered non-premium users cannot see VIP images.
- Anonymous users cannot see VIP images.

## Basket And Checkout

Anonymous users can add products to basket.

Checkout requires phone OTP login.

After login, merge or transfer the anonymous basket into the user basket without losing selected variants, prices, or quantities.

Products that are disabled or out of stock must not be addable to basket.

Basket behavior should be smooth and modern, similar to premium fashion-commerce sites.

## Homepage Blocks

The home page is made of dynamic blocks.

Each block can contain a static or dynamic list of products.

Each block has a type. Each type has its own design and mobile design.

Starting block types:

- `showcase`: shows a huge product image with price and information, similar to a premium fashion-commerce showcase.
- `left_to_right_gallery`: shows a horizontally scrollable product list.

Block product sources:

- Admin can manually select products for a custom list.
- Admin can select category and tag filters.
- Admin can select sorting, such as price.
- The system can dynamically resolve the product list from those filters.

Build blocks as clean dynamic components so more block types can be added later.

## Search And Availability

Search results should include:

- Active products.
- Disabled products.
- Out-of-stock products.

Availability behavior:

- Active and in-stock products can be added to basket.
- Disabled products cannot be added to basket.
- Out-of-stock products cannot be added to basket.

Make unavailable states visually clear without hiding products from discovery.

## Implementation Preferences

Prefer small, clear domain boundaries even though backend and frontend live in one Next.js app.

Keep shared business logic out of UI components when it will also be needed by API endpoints, admin workflows, or future Android clients.

When adding new code:

- Read local project instructions first.
- Follow existing file structure and conventions.
- Prefer server-rendered pages for SEO-critical surfaces.
- Use API endpoints for dynamic browsing and client-side interactions.
- Keep mobile behavior first-class.
- Keep API response shapes stable and documented in code where useful.
