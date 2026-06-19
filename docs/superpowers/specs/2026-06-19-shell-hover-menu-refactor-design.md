# Shell hover-menu refactor — smooth Motion dropdowns for basket & user

Date: 2026-06-19
Status: Approved (inline), pending spec review
Scope: `src/components/shell/*`, `src/components/shop/cart-provider.tsx`

## Problem

The header's two hover surfaces — account (user) and cart (basket) — are built on
**two different primitives with two different timing models**, and neither animates:

- `account-menu.tsx` uses base-ui `Popover` driven by hand-rolled
  `onMouseEnter` / `onMouseLeave` + `setTimeout(…, 160)`. Opens instantly, no enter/exit
  animation.
- `cart-button.tsx` uses base-ui `PreviewCard`, which is designed for link hovercards and
  carries a long built-in hover-intent delay (~300ms+). That delay is the "slow" feel.

Because the two menus run on different open/close clocks and have no shared hover state,
moving the pointer from one trigger to the other feels janky. The popups also just pop in
(no motion), so the whole strip feels unpolished.

Secondary: `search-bar.tsx` is dead code — it is imported nowhere (the header uses
`SpotlightSearch`).

## Goals

1. Refactor the two menus onto **one shared, consistent hover primitive**.
2. Smooth, springy **Motion (motion.dev)** enter/exit so basket↔user switching feels like one surface.
3. Polish the dropdown **content** for both basket and user.

Non-goals: redesigning the spotlight search, category mega-menu, or bottom tabs.

## Key technical findings

- base-ui `Popover.Trigger` natively supports `openOnHover`, `delay`, and `closeDelay`
  (verified in `node_modules/@base-ui/react/popover/trigger/PopoverTrigger.d.ts`). This
  removes the need for the manual mouse timers entirely, and gives both menus identical,
  shared timing. base-ui also manages the trigger→popup "safe zone", so the popup won't
  close while the pointer crosses into it.
- base-ui's **authoritative** Motion integration (per
  `node_modules/@base-ui/react/docs/react/handbook/animation.md`): make the popover
  controlled, wrap in `<AnimatePresence>`, put `keepMounted` on `<Popover.Portal>`, and
  compose `<Popover.Popup render={<motion.div … />}>`. base-ui detects the `opacity`
  animation via `getAnimations()` and waits for it before unmounting, so exit animations play.
- Cart mutation endpoints already exist: `PATCH /api/cart/item` `{variantId, quantity}` and
  `DELETE /api/cart/item` `{variantId}`, both returning `{ ok, data: { cart } }`. The cart
  provider currently exposes no mutators — it only has `cart`, `count`, `loading`, `refresh`.
- `CurrentUser = { id, phone, fullName, role: "CUSTOMER" | "ADMIN", isPremium }`.

## Architecture

### 1. New shared primitive: `src/components/shell/hover-menu.tsx`

A thin wrapper over base-ui `Popover` that standardizes hover timing + Motion animation.

```
HoverMenu({
  trigger,                  // ReactElement — the icon button (rendered as Popover.Trigger)
  children,                 // popup content
  open, onOpenChange,       // controlled (so AnimatePresence + press-filtering work)
  contentClassName,         // popup styling (width, etc.)
  align = "end",
  sideOffset = 10,
})
```

- `Popover.Root` controlled by `open` / `onOpenChange`.
- `Popover.Trigger openOnHover delay={OPEN_DELAY} closeDelay={CLOSE_DELAY} render={trigger}`.
- `AnimatePresence` → `Popover.Portal keepMounted` → `Popover.Positioner side="bottom" align sideOffset` →
  `Popover.Popup render={<motion.div … />}`.

Shared timing + motion constants live at the top of the file so both menus match exactly:

```
OPEN_DELAY  = 70   // ms
CLOSE_DELAY = 120  // ms
ENTER  = { opacity: 0, scale: 0.96, y: -6 }
ACTIVE = { opacity: 1, scale: 1,    y: 0  }
SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 }
```

The `motion.div` sets `style={{ transformOrigin: "var(--transform-origin)" }}` so it scales
from the anchor corner (correct in RTL).

### 2. `account-menu.tsx` → uses `HoverMenu`

- Remove the manual `mouseenter`/`mouseleave`/`timer` machinery.
- Guest (no user) stays a plain login `<Link>` (no menu).
- Logged-in: `HoverMenu` with the icon button as trigger. Click toggles too (touch/a11y) —
  base-ui press still works.
- Content (polished):
  - Header: avatar circle (initials from `fullName`, else a `UserRound` glyph) + name/phone;
    gold ring + «VIP» pill when `isPremium`.
  - Rows: حساب کاربری (`/account`), پنل مدیریت (`/admin`, ADMIN only).
  - Divider → theme switch (`ThemeSegmented`) → divider → خروج (logout).

### 3. `cart-button.tsx` → uses `HoverMenu` (desktop) + Vaul `Drawer` (click)

- Drop `PreviewCard`.
- Desktop (lg+): `HoverMenu` shows the animated mini-cart popover on hover. The popover is
  **hover-only** — clicks are routed to the drawer. To prevent base-ui press from toggling the
  popover, `onOpenChange` ignores the `triggerPress` reason; the button's `onClick` sets
  `drawerOpen = true`.
- Mobile (<lg): no hover; tapping the bag opens the Vaul `Drawer` (popup is `hidden lg:block`).
- Badge (item count) unchanged.

### 4. `cart-provider.tsx` → add mutators

Extend `CartState` with:

```
setQuantity(variantId: string, quantity: number): Promise<void>
removeItem(variantId: string): Promise<void>
```

- Call `PATCH` / `DELETE /api/cart/item`, then set state from the returned `cart` (authoritative
  reconcile). Dispatch `window.dispatchEvent(new Event("cart:changed"))` so other surfaces sync.
- `setQuantity(_, 0)` removes (or callers use `removeItem`). Guard against going below 1 in the UI.
- Keep failures silent-but-safe (re-`refresh()` on error so UI doesn't drift).

### 5. `mini-cart.tsx` → polished rows

- Each line: thumbnail + title + variant + **qty stepper (− / qty / ＋)** + line total +
  **remove (trash) button**.
- Wrap rows in `AnimatePresence` so removing a line animates out (height/opacity collapse).
- Stepper calls `setQuantity`; trash calls `removeItem`. Disable controls while a row mutation
  is in flight (local pending state) to avoid double-fires.
- Footer unchanged in structure: subtotal (gold) + checkout + "مشاهده سبد کامل".
- Empty state unchanged.

### 6. Delete `search-bar.tsx` (dead code).

## Files

| Action | File |
| --- | --- |
| add dep | `motion` (motion.dev) |
| new | `src/components/shell/hover-menu.tsx` |
| edit | `src/components/shell/account-menu.tsx` |
| edit | `src/components/shell/cart-button.tsx` |
| edit | `src/components/shell/mini-cart.tsx` |
| edit | `src/components/shop/cart-provider.tsx` |
| delete | `src/components/shell/search-bar.tsx` |

## Testing / verification

- `bun run check` (Biome) clean.
- `bun run build` (Next handles typecheck) passes.
- Manual via preview tools: hover user → springs in; slide to cart → smooth handoff, no janky
  delay; cart click opens drawer; qty stepper + remove mutate and animate; VIP badge shows for
  premium; RTL transform-origin correct; mobile tap opens drawer.

## Risks / notes

- The exact `triggerPress` reason string must be confirmed against base-ui's `REASONS` at
  implementation time (filter in `onOpenChange`).
- `prefers-reduced-motion`: gate the spring (Motion respects it via `useReducedMotion`) so the
  popups fall back to a plain fade.
