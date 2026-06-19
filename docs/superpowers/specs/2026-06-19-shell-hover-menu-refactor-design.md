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

> **Design revision (post-feedback):** the original plan used two *independent* hover
> popovers (one per menu) animated with Motion. In practice the basket↔user **switch** was
> still not smooth: when the pointer crosses from one trigger to the other, one popover must
> exit-animate while the other enter-animates — there is always a visible gap/flicker, and two
> Motion `AnimatePresence` trees cannot morph into one another. The fix is base-ui's
> **shared-popover-with-multiple-triggers** feature: a *single* popover, owned by one
> `Popover.Root`, that stays mounted and **morphs** position + size + content as it moves
> between the account and cart triggers. This is purpose-built for exactly this interaction
> (verified in `node_modules/@base-ui/react/docs/react/components/popover.md` →
> "Multiple triggers" / "Animating the Popover").

### 1. New shared morphing popover: `src/components/shell/header-menus.tsx`

Owns both header triggers, the single shared `Popover.Root`, and the cart `Drawer`. Replaces
both `account-menu.tsx` and `cart-button.tsx`.

```
const headerMenu = Popover.createHandle<"account" | "cart">()   // module scope

HeaderMenus({ user })
  // controlled: open + activeId(triggerId) so a hover-cross re-targets the same popover
  <Popover.Trigger handle id="account" payload="account" openOnHover delay closeDelay/>  // logged-in only
  <Popover.Trigger handle id="cart"    payload="cart"    openOnHover delay closeDelay
                   onClick={openDrawer}/>
  <Popover.Root handle open onOpenChange triggerId={activeId}>
    {({ payload }) => (
      <Portal><Positioner …morph…><Popup …morph + enter/exit…>
        <Viewport …direction-aware content cross-slide…>
          {payload === "cart" ? <MiniCart/> : <AccountPanel/>}
        </Viewport>
      </Popup></Positioner></Portal>
    )}
  </Popover.Root>
  <Drawer open={drawerOpen}/>   // cart click → full drawer
```

Shared hover timing (identical for both triggers → one continuous surface):

```
OPEN_DELAY  = 60   // ms  (Trigger `delay`)
CLOSE_DELAY = 140  // ms  (Trigger `closeDelay`)
```

Morph animation (CSS transitions, GPU, via base-ui data-attrs — no Motion here):

- **Positioner**: `transition-[top,left,right,bottom]`, ~300ms `cubic-bezier(0.22,1,0.36,1)`,
  `data-instant:transition-none` (skips the transition on first placement).
- **Popup**: `transition-[width,height,opacity,transform]`; `data-starting-style` /
  `data-ending-style` = `scale-95 opacity-0` for enter/exit; `origin-[var(--transform-origin)]`.
- **Viewport**: wraps content; base-ui emits `data-activation-direction` (left/right) plus
  `data-current` / `data-previous` children — old panel slides out, new slides in. base-ui
  derives the direction from DOM rects, so RTL is handled automatically (wire both directions).

Each panel sets a fixed width (account `w-64`, cart `w-80`) so the size morph has defined
endpoints.

### 2. Click / mobile routing

- **Cart click → Drawer.** `onOpenChange` intercepts `reason === "trigger-press" && trigger.id === "cart"`:
  it opens the drawer and returns without opening the popover. The trigger's `onClick` also sets
  `drawerOpen = true` (idempotent). So: desktop hover = morphing popover; any click = drawer;
  mobile tap (no hover) = drawer.
- **Account press** (mobile tap, or click) falls through normally → opens the account panel.
- A hover-cross fires `onOpenChange(true, { reason: "trigger-hover", trigger })` → we keep `open`
  and update `activeId` → the popover morphs to the new panel.

### 3. `account-panel.tsx` (new) — account dropdown content

- Header: avatar circle (initials from `fullName`, else `UserRound`) + name/phone; gold ring +
  «VIP» pill when `isPremium`.
- Rows: حساب کاربری (`/account`), پنل مدیریت (`/admin`, ADMIN only).
- Divider → theme switch (`ThemeSegmented`) → divider → خروج (logout, owns the router call).

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

### 5. `mini-cart.tsx` → polished rows (used by both the popover cart panel and the drawer)

- Each line: thumbnail + title + variant + **qty stepper (− / qty / ＋)** + line total +
  **remove (trash) button**.
- Wrap rows in Motion `AnimatePresence` so removing a line animates out (opacity/height
  collapse) — the only place Motion is used. The popup's CSS height transition follows the
  content shrink, so the container resize stays smooth.
- Stepper calls `setQuantity`; trash calls `removeItem`. Disable controls while a row mutation
  is in flight (local pending state) to avoid double-fires.
- Footer unchanged in structure: subtotal (gold) + checkout + "مشاهده سبد کامل".
- Empty state unchanged.

### 6. `site-header.tsx` → render `<HeaderMenus user={user} />` in place of the old
`<AccountMenu/> <CartButton/>` pair.

### 7. Delete `search-bar.tsx` (dead code), `account-menu.tsx`, `cart-button.tsx` (folded into
`header-menus.tsx` + `account-panel.tsx`).

## Files

| Action | File |
| --- | --- |
| add dep | `motion` (motion.dev) — used only for mini-cart row removal |
| new | `src/components/shell/header-menus.tsx` (shared morphing popover + cart drawer) |
| new | `src/components/shell/account-panel.tsx` (account dropdown content) |
| edit | `src/components/shell/mini-cart.tsx` |
| edit | `src/components/shell/site-header.tsx` |
| edit | `src/components/shop/cart-provider.tsx` |
| delete | `src/components/shell/account-menu.tsx` |
| delete | `src/components/shell/cart-button.tsx` |
| delete | `src/components/shell/search-bar.tsx` |

## Testing / verification

- `bun run check` (Biome) clean.
- `bun run build` (Next handles typecheck) passes.
- Manual via preview tools: hover user → springs in; slide to cart → smooth handoff, no janky
  delay; cart click opens drawer; qty stepper + remove mutate and animate; VIP badge shows for
  premium; RTL transform-origin correct; mobile tap opens drawer.

## Risks / notes

- Press reason confirmed: `eventDetails.reason === "trigger-press"` (base-ui
  `internals/reason-parts`). Cart-click routing keys on that + `trigger.id === "cart"`.
- The size morph needs each panel to have a defined width; account `w-64`, cart `w-80`. If a
  panel's height changes (cart row removal), the Popup `height` transition animates the resize.
- `prefers-reduced-motion`: the morph durations are short; for the mini-cart Motion rows, gate
  with `useReducedMotion()` so removal falls back to an instant cut.
- Mobile: the morphing popover only matters on hover (desktop). On touch, account tap opens the
  panel; cart tap opens the drawer. Keep the popup width within the viewport (`max-w-[...]`).
