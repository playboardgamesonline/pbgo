# Guidelines

The rules to follow when building UI in this repository: the platform's screens (hub, account, legal, gamemaster, 404) and the UI that every game shares around its board. The tokens and the components themselves are documented in [Foundations](02-foundations.md) and [Components](03-components/index.md), and what the games share in [In-game UI](04-in-game.md).

## Principles

The platform (hub, account, legal, gamemaster, 404) is black and white, dark only, set in Geist semibold. Everything on it is built from the tokens and components of `@pbgo/ui`. The only colour on a platform screen is a game's own art. Every token and component is documented in this section of the docs: it is the reference, so check it before building a screen.

- A black and white, with no tint: the palette is the `neutral` scale (Tailwind's, a chroma of 0 all along and a little darker in its four darkest steps, so that the page is a true black) plus `destructive`, and the four colours of a friend's presence (`--presence-online`, green, `--presence-playing`, blue, `--presence-inactive`, orange-yellow, and `--presence-dnd`, red), which only a dot wears, and the two brand colours of a sign-in provider's button (`--brand-facebook`, `--brand-discord`), which only that button wears, and the colours of the pieces that stand for letters of the home's title (`--piece-*`), which only those pieces wear. No other accent colour, and no gradient: the first screen of a page, the home's hero included, is the page's black, flat.
- Dark only. The platform has no light theme and no `dark:` variants; `color-scheme` is `dark`.
- One typeface, Geist, in one weight: everything is semibold (600), with tight line-heights. `font-medium` and `font-bold` resolve to the same weight, so do not write them. Two weights are set on purpose: 400 for the finest print (`fine-print`) and 720 for the title of the home and a person's name at the head of a profile (`font-strong`). Text is slightly tight: about -0.01em on body text, -0.03em on headings.
- Apart from a friend's presence, a provider's brand and the pieces of the home's title, game art is the only colour on the platform. Never tint, recolour or dim it: a logo is drawn straight on its background, with no layer between them.
- Rounded, never round: the taller a box, the rounder its corner, up to the menus' step (`rounded-4xl`, 31px, for a container from 6rem high), and a corner never reaches half the height of what it rounds, so nothing is a capsule. Only the picture of a person is a circle. Corners are smoothed a touch (`--corner-smoothing`).
- Depth comes from surface steps and hairlines (`ring-1 ring-foreground/10`), then from three shadows: `shadow-surface` at rest, `shadow-float` when lifted, `shadow-overlay` for dialogs and sheets.
- Tokens, not values: no hex, `rgb()`, arbitrary pixel sizes, font names or `bg-neutral-*` in platform UI. Write `bg-card`, `text-muted-foreground`, `rounded-3xl`, `px-gutter`.
- A missing piece goes into `@pbgo/ui` first, is documented in these docs with a live specimen ([Adding a component](#adding-a-component)), then is used.
- Out of scope for v1: brand fonts, gradients, a light theme and game boards.

### Do and do not

Use a component of `@pbgo/ui`, with its variant:

```tsx
import { Button } from "@pbgo/ui/platform/button"

<Button variant="outline">Join the table</Button>
```

Do not write a one-off element with its own colour, size, weight and radius:

```tsx
<button className="bg-[#111] text-[13px] font-medium rounded-[10px]">
  Join the table
</button>
```

### Where things live

| What | Where |
| --- | --- |
| Tokens and the boundary between the layers | `packages/ui/src/styles/platform.css` |
| Components | `packages/ui/src/platform/<name>.tsx`, imported as `@pbgo/ui/platform/<name>` |
| Class names | `cn()` from `@pbgo/ui/utils` |
| Colour of the browser chrome | `PLATFORM_THEME_COLOR` from `@pbgo/ui/theme` |
| This documentation | `docs/design/`, shown at `/docs/design`; its live pieces are in `apps/web/src/app/(hub)/docs/_specimens/` |

## Layers and boundary

Two layers share the same token names (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--radius`, `--font-body`…). The platform layer is what the platform's screens use. The game layer is what a game's pages use, and a game overrides it at runtime through its Sanity skin. Same names, different values: a game changes its look by changing token values, never a component.

| | Platform layer | Game layer |
| --- | --- | --- |
| Used by | Hub, account, legal, the docs, 404, the gamemaster | A game's own pages: home, lobby, table, board |
| Components | `@pbgo/ui/platform/*` | `@pbgo/ui/game/*` |
| Token values | `packages/ui/src/styles/platform.css`, scoped to `.platform` | `:root` of `packages/core/styles/game.css` and the game's stylesheet, overridden at runtime by its Sanity skin (inline style on `<html>`, `themeStyle()`) |
| Who changes them | The design system: a pull request on `packages/ui` | The game: its setup in the gamemaster (Visual, Copy) through `themeStyle()` |
| Theme | Black and white, dark only | Whatever the game's skin says |
| `platform` class | On `<html>` (hub, gamemaster and 404, through `PlatformDocument`) and on the root of every portal (select, dropdown, dialog, sheet, tooltip, toast), which React renders outside the wrapper | Never |

### Rules of the boundary

- The platform sets its values on `.platform`, never on `:root`. A game sets its values on `:root`, never on `.platform`. The two never mix.
- A component reads tokens and never names a colour, a font or a size of its own. That is what lets a game restyle everything by changing values.
- In `platform.css`, `@theme` only defines new names (`shadow-surface|float|overlay`, `duration-fast|base|slow`, `ease-standard`, `bg-scrim`, `max-w-page|reading`, `px-gutter`, `py-section`, `h-navbar|pt-navbar|scroll-mt-navbar`). A name Tailwind already has (type-scale line-heights, `--tracking-tight`, `--default-transition-*`, `--font-weight-*`) gets its platform value inside `.platform`, or every game would inherit it from `:root`.
- Portals (select, dropdown, dialog, sheet, tooltip, toast) render outside the wrapper that carries `platform`, so their root carries the class itself. The platform components do it already.
- `.platform` carries no background: a portal would paint it. `<html>` adds `bg-background` itself.

### The same specimen in both layers

Left, the platform. Right, the same components with four tokens overridden, as a game skin would: `--primary`, `--primary-foreground`, `--radius` and `--font-body`. Colour, radius and font change, no component does. This is a simulation for this page; a real skin sets the names on `<html>`.

```specimen
layers-skin
```

A game restyles by changing the value of a token. No component is touched:

```css
:root {
  --primary: var(--accent-game);
  --radius: 0.75rem;
  --font-body: "Alegreya Variable", Georgia, serif;
}
```

## Adding a component

1. Add it with `pnpm dlx shadcn@latest add <comp>` (preset `beEgoY8u`).
2. Move it to `packages/ui/src/platform` and import `cn` from `../utils`.
3. Make it dark-only and token-only.
4. Document it: a section of the page of [Components](03-components/index.md) that fits, with its live pieces as specimens (a `specimen` block in the page, the component in `apps/web/src/app/(hub)/docs/_specimens/`; see [Design system](index.md)).
5. Then use it.

## Guards

Tests keep these rules from coming undone:

- `packages/ui/src/platform.test.ts` rejects `dark:`, palette and hard-coded colours, arbitrary sizes and the old `admin` names in `packages/ui/src/platform/*`, and a hard-coded weight, shadow, duration or radius in a component.
- `theme.test.ts` keeps `PLATFORM_THEME_COLOR` (`@pbgo/ui/theme`), the browser colour of platform pages, equal to `--background`.

## In-game UI

The UI that `@pbgo/core` draws inside a game (screens, HUD, announcements, seat label, players strip, game over, chat) is not part of the platform layer. It is drawn in the game's own look, never the platform's.

- Never `@pbgo/ui/platform`, Geist or the `.platform` class: the in-game UI reads the game's skin tokens (`--foreground`, `--surface`, `--accent-game`, `--font-title`, `--font-accent`, set by `themeStyle()`), tuned by `UI_THEME` (see [Game themes](04-in-game.md#game-themes)).
- A game never forks or restyles an in-game component: it asks for a field in `UiTheme`, which every game then gets.
- No copy in shared components: every label is a `UI_TEXTS` key, in the four languages (the strip uses `players`, `playersReady`, `seatDone`, `seatWaiting`, `seatAway`; the ticker `history`).

### Room for the cookie banner

A screen as tall as the viewport on a hub or game page subtracts the banner (`h-[calc(100dvh-var(--consent-h,0px))]`) and an element fixed to the bottom offsets by it (`bottom-[var(--consent-h,0px)]`), or a button of the game ends up under the card. `--consent-h` is the height of the banner's outer box, the card's margin included.

`packages/core/components/consent-room.test.ts` reads the classes of the hub, core's components and pages, the template and every game's `src` and fails on a violation. Its allow-list holds the two layers that cover the whole screen on purpose (the narrow-screen wall and the game-over backdrop, which hold no button).

### Compact layout

The Tailwind variant `short` (`@media (max-height: 30rem)`, in `packages/core/styles/game.css`) is keyed on the viewport height, because a phone held sideways (844×390) is wide but short. The HUD uses it (history behind a toggle, smaller announcement, chat collapsed to an icon, scrollable game-over panel, takeover pill stacked next to the logo, safe-area insets) and a game's overlays should too.

The hub does not define it. `DesktopOnly` still hides game pages under 900 px wide: to check a table at 844×390, hide the wall with injected CSS in the browser, never in the code.

### Motion

`motion/react` goes through `useMotion()` (`"reduced" | "calm" | "lively"`, `resolveMotion` in `lib/motion-preference.ts`) and `GameHud` mounts `MotionConfig reducedMotion="user"`. Reduced motion always wins over `UI_THEME.motion`: opacity fades of 150 ms at most, no confetti, emoji burst, springs or looping effects. CSS transitions use `duration-*` and `ease-standard` with `motion-reduce:transition-none`. Announcements stay up the same time and are read out in an `aria-live` region.

Card and table motion is not part of the in-game UI: the flight, bend and hover of a card belong to the shared `Card` of `@pbgo/table`, which reads the easing curves of `components/game/easing.ts` (PLT-49), and the camera's entrance to its `Table`, which holds the camera still under reduced motion.

### Clipping the HUD

`GameHud`'s root clips with `overflow-clip`, not `overflow-hidden`: a hidden box is still a scroll container, so a click or focus inside it could scroll the whole table out of place.
