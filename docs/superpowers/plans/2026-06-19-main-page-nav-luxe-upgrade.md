# Main-page dark/gold luxe nav upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark/gold luxe top bar, restyle the bottom nav with an active-route highlight, and polish the homepage showcase blocks — without flipping the global theme.

**Architecture:** Register luxe + gold colors as Tailwind v4 theme tokens in `globals.css`. Extract the bottom nav's inlined scroll logic into a shared `useHideOnScroll` hook and its cart fetch into a `CartProvider` context mounted in the root layout. Build a new client `TopBar`, restyle the client `BottomNav` to consume both shared pieces, and repaint the showcase heroes/section headers with the gold accent.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (`@theme inline`), lucide-react, base-ui, RTL Persian.

## Global Constraints

- Product is digital/gaming goods (gift cards, CD keys) — never use clothing copy. AGENTS.md product identity is stale.
- Persian-first, RTL (`dir="rtl"`) preserved everywhere.
- `premium = full dark` model untouched: do not change `layout.tsx`'s `.dark` / `data-premium` logic. Luxe is a scoped color band, not a theme flip.
- Dark/gold reach = top bar + bottom nav + showcase hero only. Light browsing base unchanged.
- Bottom nav keeps its current items and the admin `مدیریت` insertion. No new nav entries, no center button, no wishlist/search features.
- **Bash is blocked** by the Semgrep Guardian PreToolUse hook in this environment. Run `npm`/`next` via the bun MCP (`run-bun-script`) or ask the user to run them; commit via the git MCP (`git_add` / `git_commit`); verify UI via the Playwright MCP. Repo path: `/Users/mamad/projects/mamad/pixevel.com/.claude/worktrees/priceless-torvalds-840ea6`.
- No unit-test runner exists (`package.json` has no `test` script). Per-task verification = `npm run lint` passes + visual check; final task = `npm run build` passes.

---

### Task 1: Luxe + gold design tokens

**Files:**
- Modify: `src/app/globals.css` (the `@theme inline { … }` block, ends line 49; and `:root { … }`, ends line 84)

**Interfaces:**
- Produces: Tailwind color utilities `bg-luxe`, `bg-luxe-surface`, `text-luxe-foreground`, `text-luxe-muted`, `border-luxe-border`, `text-gold`, `bg-gold`, `bg-gold-strong` (alpha modifiers like `bg-luxe/80` work because they are registered theme colors). Underlying vars `--luxe-bg`, `--luxe-surface`, `--luxe-fg`, `--luxe-muted`, `--luxe-border`, `--gold`, `--gold-strong`.

- [ ] **Step 1: Register the theme colors.** In `src/app/globals.css`, inside `@theme inline { … }`, add these lines just after `--color-foreground: var(--foreground);` (line 9):

```css
  --color-luxe: var(--luxe-bg);
  --color-luxe-surface: var(--luxe-surface);
  --color-luxe-foreground: var(--luxe-fg);
  --color-luxe-muted: var(--luxe-muted);
  --color-luxe-border: var(--luxe-border);
  --color-gold: var(--gold);
  --color-gold-strong: var(--gold-strong);
```

- [ ] **Step 2: Define the values.** In the `:root { … }` block, add these lines just before `--radius: 0.5rem;` (line 75). The luxe band is always dark, so the values are constant across light/dark — define once here, do not repeat in `.dark`:

```css
  --luxe-bg: oklch(0.13 0.028 292);
  --luxe-surface: oklch(0.19 0.035 292);
  --luxe-fg: oklch(0.97 0.012 300);
  --luxe-muted: oklch(0.72 0.03 300);
  --luxe-border: oklch(1 0 0 / 14%);
  --gold: oklch(0.8 0.12 85);
  --gold-strong: oklch(0.86 0.14 89);
```

- [ ] **Step 3: Verify lint/build picks up the tokens.** Run (via bun MCP or user): `npm run lint`. Expected: no new errors. (Tailwind only emits a utility when it is referenced, so these produce no output until Task 4/5 use them — that is fine.)

- [ ] **Step 4: Commit.**

```bash
git add src/app/globals.css
git commit -m "feat(ui): add luxe + gold design tokens"
```

---

### Task 2: Shared `useHideOnScroll` hook

**Files:**
- Create: `src/lib/use-hide-on-scroll.ts`

**Interfaces:**
- Produces: `useHideOnScroll(): boolean` — returns `true` when the bar should be hidden. Encapsulates the exact rAF-throttled scroll logic currently inlined in `bottom-nav.tsx` (constants `SCROLL_DELTA=8`, `TOP_REVEAL_OFFSET=80`, `BOTTOM_REVEAL_OFFSET=24`).

- [ ] **Step 1: Create the hook.** Write `src/lib/use-hide-on-scroll.ts`:

```tsx
"use client";

import { useEffect, useState } from "react";

const SCROLL_DELTA = 8;
const TOP_REVEAL_OFFSET = 80;
const BOTTOM_REVEAL_OFFSET = 24;

export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame: number | null = null;

    function update() {
      frame = null;

      const currentY = Math.max(0, window.scrollY);
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const delta = currentY - lastY;
      const nearTop = currentY < TOP_REVEAL_OFFSET;
      const nearBottom = currentY > maxY - BOTTOM_REVEAL_OFFSET;

      if (nearTop || nearBottom || delta < -SCROLL_DELTA) {
        setHidden(false);
      } else if (delta > SCROLL_DELTA) {
        setHidden(true);
      }

      lastY = currentY;
    }

    function onScroll() {
      if (frame !== null) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return hidden;
}
```

- [ ] **Step 2: Verify.** Run: `npm run lint`. Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/use-hide-on-scroll.ts
git commit -m "feat(ui): extract useHideOnScroll hook"
```

---

### Task 3: `CartProvider` context + mount in layout

**Files:**
- Create: `src/components/shop/cart-provider.tsx`
- Modify: `src/app/layout.tsx:39` (the `<body>` element)

**Interfaces:**
- Consumes: `GET /api/cart` returning `{ ok: true, data: { cart: { itemCount: number } } }` (shape already used by `bottom-nav.tsx`).
- Produces: `CartProvider` (wraps children) and `useCart(): { count: number }`.

- [ ] **Step 1: Create the provider.** Write `src/components/shop/cart-provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type CartState = { count: number };

const CartContext = createContext<CartState>({ count: 0 });

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        const payload = await response.json();

        if (active && payload?.ok) {
          setCount(payload.data.cart.itemCount ?? 0);
        }
      } catch {
        // Ignore — badge keeps its last known value.
      }
    }

    load();
    window.addEventListener("cart:changed", load);
    window.addEventListener("focus", load);

    return () => {
      active = false;
      window.removeEventListener("cart:changed", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  return <CartContext.Provider value={{ count }}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  return useContext(CartContext);
}
```

- [ ] **Step 2: Mount in layout.** In `src/app/layout.tsx`, add the import near the other imports (after line 4):

```tsx
import { CartProvider } from "@/components/shop/cart-provider";
```

Then replace the `<body>` line (line 39):

```tsx
      <body className="min-h-full bg-background text-foreground">{children}</body>
```

with:

```tsx
      <body className="min-h-full bg-background text-foreground">
        <CartProvider>{children}</CartProvider>
      </body>
```

- [ ] **Step 3: Verify.** Run: `npm run lint`. Expected: no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/components/shop/cart-provider.tsx src/app/layout.tsx
git commit -m "feat(ui): add CartProvider context for shared cart badge"
```

---

### Task 4: New `TopBar` + mount on homepage

**Files:**
- Create: `src/components/shop/top-bar.tsx`
- Modify: `src/app/page.tsx` (imports near line 4; `<main>` at line 28; render `<TopBar>` near line 28)

**Interfaces:**
- Consumes: `useHideOnScroll()` (Task 2), `useCart()` (Task 3), `toFaNumber` from `@/lib/format`, `CurrentUser` from `@/lib/auth`.
- Produces: `TopBar({ user }: { user: CurrentUser | null })`.

- [ ] **Step 1: Create the top bar.** Write `src/components/shop/top-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Search, ShoppingBag, UserRound } from "lucide-react";

import type { CurrentUser } from "@/lib/auth";
import { useCart } from "@/components/shop/cart-provider";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { toFaNumber } from "@/lib/format";

export function TopBar({ user }: { user: CurrentUser | null }) {
  const hidden = useHideOnScroll();
  const { count } = useCart();
  const accountHref = user ? "/account" : "/login";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-luxe-border bg-luxe/80 text-luxe-foreground backdrop-blur-xl transition-transform duration-300 ${
        hidden ? "-translate-y-full" : ""
      }`}
      aria-label="نوار بالا"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="پیکسِل، خانه">
          <span className="text-lg font-black tracking-wide text-gold">پیکسِل</span>
          <span className="text-[10px] tracking-[0.3em] text-luxe-muted">DIGITAL</span>
        </Link>
        <nav className="flex items-center gap-5" aria-label="میانبرها">
          <Link href="/products" aria-label="جستجو" className="transition hover:text-gold">
            <Search className="size-5" />
          </Link>
          <Link href={accountHref} aria-label="حساب" className="transition hover:text-gold">
            <UserRound className="size-5" />
          </Link>
          <Link href="/basket" aria-label="سبد" className="relative transition hover:text-gold">
            <ShoppingBag className="size-5" />
            {count > 0 ? (
              <span className="absolute -left-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-luxe">
                {count > 9 ? "+۹" : toFaNumber(count)}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Mount it + reserve space.** In `src/app/page.tsx`, add the import after the other `@/components/shop` imports (after line 4):

```tsx
import { TopBar } from "@/components/shop/top-bar";
```

Then change the `<main>` opening tag (line 28) from:

```tsx
    <main className="min-h-dvh bg-background pb-24 text-foreground">
```

to (adds top padding so non-hero content clears the fixed bar):

```tsx
    <main className="min-h-dvh bg-background pb-24 pt-14 text-foreground">
```

And immediately after `<main …>` (before `<div className="space-y-12">` on line 29) insert:

```tsx
      <TopBar user={user} />
```

- [ ] **Step 3: Verify visually.** Start the dev server (bun MCP `run-bun-script` → `dev`, or ask user to run `npm run dev`; port 4000). With the Playwright MCP: navigate to `http://localhost:4000`, screenshot. Confirm the dark top bar with gold wordmark renders at top; scroll down → bar slides up out of view; scroll up → bar reappears. Run `npm run lint`. Expected: bar behaves, no lint errors.

- [ ] **Step 4: Commit.**

```bash
git add src/components/shop/top-bar.tsx src/app/page.tsx
git commit -m "feat(ui): add dark/gold luxe top bar to homepage"
```

---

### Task 5: Restyle `BottomNav` (luxe + active state + shared hooks)

**Files:**
- Modify: `src/components/shop/bottom-nav.tsx` (full rewrite of the component body)

**Interfaces:**
- Consumes: `useHideOnScroll()` (Task 2), `useCart()` (Task 3), `usePathname` from `next/navigation`, `toFaNumber` from `@/lib/format`, `CurrentUser` from `@/lib/auth`.
- Produces: restyled `BottomNav({ user })` — same export name and props as today.

- [ ] **Step 1: Rewrite the component.** Replace the entire contents of `src/components/shop/bottom-nav.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Search, ShoppingBag, UserRound } from "lucide-react";

import type { CurrentUser } from "@/lib/auth";
import { useCart } from "@/components/shop/cart-provider";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { toFaNumber } from "@/lib/format";

const navItems = [
  { href: "/", label: "خانه", icon: Home },
  { href: "/products", label: "محصولات", icon: Search },
  { href: "/login", label: "حساب", icon: UserRound },
  { href: "/basket", label: "سبد", icon: ShoppingBag },
];

export function BottomNav({ user }: { user: CurrentUser | null }) {
  const hidden = useHideOnScroll();
  const { count: cartCount } = useCart();
  const pathname = usePathname();

  const items =
    user?.role === "ADMIN"
      ? [
          navItems[0],
          navItems[1],
          { href: "/admin", label: "مدیریت", icon: LayoutDashboard },
          navItems[2],
          navItems[3],
        ]
      : navItems;

  return (
    <nav
      className={`luxe fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-luxe-border bg-luxe/90 text-luxe-muted shadow-2xl backdrop-blur-xl transition-transform duration-300 sm:inset-x-auto sm:right-1/2 sm:w-[420px] sm:translate-x-1/2 ${
        hidden ? "translate-y-24 sm:translate-x-1/2" : ""
      }`}
      aria-label="منوی اصلی"
    >
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const href = item.label === "حساب" && user ? "/account" : item.href;
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          const showBadge = item.label === "سبد" && cartCount > 0;

          return (
            <Link
              key={item.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-bold transition ${
                isActive ? "text-gold" : "text-luxe-muted hover:text-luxe-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="size-5" />
                {showBadge ? (
                  <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-luxe">
                    {cartCount > 9 ? "+۹" : toFaNumber(cartCount)}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

(Note: the previous version had square corners; this adds `rounded-2xl` to match the floating-pill look in the mock. The `cart:changed`/`focus` fetch and the inlined scroll engine are gone — both now come from shared modules.)

- [ ] **Step 2: Verify visually.** With the dev server running and the Playwright MCP: navigate to `/`, confirm the bottom pill is dark with gold-highlighted active item (خانه on home). Navigate to `/products` and confirm محصولات goes gold. Add an item to the basket (or dispatch `cart:changed`) and confirm the سبد badge appears on the bottom nav **and** the top bar simultaneously. Run `npm run lint`. Expected: pass.

- [ ] **Step 3: Commit.**

```bash
git add src/components/shop/bottom-nav.tsx
git commit -m "feat(ui): restyle bottom nav luxe with active-route highlight"
```

---

### Task 6: Polish showcase heroes + section headers

**Files:**
- Modify: `src/components/shop/showcase-hero.tsx` (lines 62-108)
- Modify: `src/components/shop/showcase-hero-image-only.tsx` (lines 57-89)
- Modify: `src/app/page.tsx` (`SectionHeader`, lines 94-108)

**Interfaces:**
- Consumes: luxe/gold tokens (Task 1). No new exports.

- [ ] **Step 1: Gold-accent the `ShowcaseHero` CTA and price.** In `src/components/shop/showcase-hero.tsx`, replace the eyebrow + CTA block (lines 86, 95-105). Change the eyebrow (line 86) from:

```tsx
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">Pixevel</p>
```

to:

```tsx
          <p className="text-xs font-black uppercase tracking-[0.32em] text-gold">Pixevel</p>
```

Then replace the CTA/price block (lines 95-105):

```tsx
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/products/${productSlug}`}
              className="bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/88"
            >
              مشاهده محصول
            </Link>
            <span className="text-sm font-bold text-white/82">
              از {formatToman(price)}
            </span>
          </div>
```

with:

```tsx
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/products/${productSlug}`}
              className="bg-gold px-6 py-3 text-sm font-black text-luxe transition hover:bg-gold-strong"
            >
              مشاهده محصول
            </Link>
            <span className="text-sm font-bold text-luxe-muted">
              از <span className="text-gold">{formatToman(price)}</span>
            </span>
          </div>
```

Also change the hero `<section>` className (line 64) so it bleeds under the fixed top bar — from `className="section-fade relative overflow-hidden bg-zinc-950 text-white"` to:

```tsx
      className="section-fade relative -mt-14 overflow-hidden bg-zinc-950 text-white"
```

- [ ] **Step 2: Gold-accent the image-only hero eyebrow + bleed.** In `src/components/shop/showcase-hero-image-only.tsx`, change the eyebrow (line 78) from `text-white/70` to `text-gold` and tracking to `tracking-[0.32em]`:

```tsx
          <p className="text-xs font-black uppercase tracking-[0.32em] text-gold">Pixevel</p>
```

And change its `<section>` className (line 59) from `className="section-fade relative overflow-hidden bg-zinc-950 text-white"` to:

```tsx
      className="section-fade relative -mt-14 overflow-hidden bg-zinc-950 text-white"
```

- [ ] **Step 3: Gold-accent the `SectionHeader` link.** In `src/app/page.tsx`, change the "همه محصولات" link (lines 103-105) from:

```tsx
      <Link href="/products" className="text-sm font-bold underline underline-offset-4">
        همه محصولات
      </Link>
```

to:

```tsx
      <Link
        href="/products"
        className="text-sm font-bold text-foreground/70 underline decoration-gold/60 decoration-2 underline-offset-4 transition hover:text-foreground"
      >
        همه محصولات
      </Link>
```

- [ ] **Step 4: Verify visually.** With the dev server + Playwright MCP: confirm the showcase hero now shows a gold CTA + gold price, the hero image bleeds to the very top under the translucent bar, and gallery section headers show a gold underline. Run `npm run lint`. Expected: pass.

- [ ] **Step 5: Commit.**

```bash
git add src/components/shop/showcase-hero.tsx src/components/shop/showcase-hero-image-only.tsx src/app/page.tsx
git commit -m "feat(ui): gold-accent showcase heroes and section headers"
```

---

### Task 7: Final build verification + merge to main

**Files:** none (integration only)

- [ ] **Step 1: Full build.** Run: `npm run build`. Expected: build succeeds with no type errors.

- [ ] **Step 2: Final visual pass (Playwright MCP).** On `http://localhost:4000`: (a) top bar reveal/hide on scroll; (b) bottom-nav active highlight while navigating; (c) cart badge sync across both bars; (d) toggle a premium user (dark base) and confirm luxe bars still look right; (e) a light product page (`/products`) is visually unchanged; (f) DevTools emulate `prefers-reduced-motion: reduce` and confirm motion is disabled.

- [ ] **Step 3: Merge into local `main`.** From the repo root, fast-forward/merge the feature branch into `main` locally (no push unless asked):

```bash
git checkout main
git merge --no-ff claude/priceless-torvalds-840ea6 -m "feat(ui): main-page dark/gold luxe nav upgrade"
```

(Run via the git MCP since Bash is blocked. The branch is `claude/priceless-torvalds-840ea6`; the repo's primary branch is `main`, not `master`.)

## Self-Review

- **Spec coverage:** tokens (Task 1), top bar + hide-on-scroll + main padding (Tasks 2,4), bottom-nav restyle + active state (Task 5), shared cart context (Task 3), showcase/header polish (Task 6), premium-dark untouched (no layout theme edits), verification + merge (Task 7). All spec sections mapped.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `useHideOnScroll(): boolean`, `useCart(): { count }`, `TopBar({ user })`, `BottomNav({ user })` used consistently across tasks. Cart payload shape `data.cart.itemCount` matches the existing API usage.
