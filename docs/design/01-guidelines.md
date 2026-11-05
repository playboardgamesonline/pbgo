# Guidelines

The rules to follow when building UI in this repository: the platform's screens (hub, account, legal, gamemaster, 404) and the UI every game shares around its board. The tokens and the components are in [Foundations](02-foundations.md) and [Components](03-components/index.md), what the games share in [In-game UI](04-in-game.md).

## Principles

The platform is black and white, dark only, set in Geist semibold, and built from the tokens and components of `@pbgo/ui`. Every token and building block is documented in this section, so check it before building a screen. The design of a page is not: this section describes what screens are made of, never one screen.

- No tint and no gradient: the palette is the `neutral` scale plus `destructive` and `success`, and the few other hues are listed in [Colors](02-foundations.md#colors), each worn by one thing only. The first screen of a page, the home's hero included, is the page's black, flat.
- Dark only: no light theme, no `dark:` variants.
- One typeface, Geist, in one weight: never write `font-medium` or `font-bold`. Only the finest print and the large titles set another weight on purpose (`fine-print`, `font-strong`).
- Apart from those hues, game art is the only colour, and it is shown as it is: never tint, recolour or dim it, and lay nothing between a logo and its background. The one exception is art behind the head of a page, which fades into the page with gradients from `background`.
- Rounded, never round: the taller a box, the rounder its corner, up to `rounded-4xl`, and nothing is a capsule. Only the picture of a person is a circle ([Radius](02-foundations.md#radius)).
- Depth comes from surface steps and hairlines, then from three shadows: `shadow-surface`, `shadow-float`, `shadow-overlay`.
- Tokens, not values: no hex, `rgb()`, arbitrary pixel size, font name or `bg-neutral-*` in platform UI. Write `bg-card`, `text-muted-foreground`, `rounded-3xl`, `px-gutter`.
- A missing piece goes into `@pbgo/ui` first, then into these docs when other screens will use it ([Adding a component](#adding-a-component)), then it is used. What only one page is made of (the head of a game's page, its lobby, its leaderboard) is not documented here.
- Out of scope: brand fonts, a light theme and game boards.

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

## Layers and boundary

Two layers share the same token names (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--radius`, `--font-body`…). The platform layer is what the platform's screens use; the game layer is what a game's pages use, and a game overrides it at runtime through its Sanity skin. Same names, different values: a game changes its look by changing token values, never a component.

| | Platform layer | Game layer |
| --- | --- | --- |
| Used by | Hub, account, legal, the docs, 404, the gamemaster | A game's own pages: home, lobby, table, board |
| Components | `@pbgo/ui/platform/*` | `@pbgo/ui/game/*` |
| Token values | `packages/ui/src/styles/platform.css`, scoped to `.platform` | `:root` of `packages/core/styles/game.css` and the game's stylesheet, overridden at runtime by its Sanity skin (`themeStyle()`) |
| Who changes them | The design system: a pull request on `packages/ui` | The game: its setup in the gamemaster (Visual, Copy) |
| Theme | Black and white, dark only | Whatever the game's skin says |
| `platform` class | On `<html>` (through `PlatformDocument`) and on the root of every portal (select, dropdown, dialog, popover, toast), which React renders outside the wrapper | Never |

### Rules of the boundary

- The platform sets its values on `.platform`, never on `:root`. A game sets its values on `:root`, never on `.platform`. The two never mix.
- A component reads tokens and never names a colour, a font or a size of its own: that is what lets a game restyle everything by changing values.
- In `platform.css`, `@theme` only defines new names. A name Tailwind already has (line-heights, tracking, default transitions, font weights) gets its platform value inside `.platform`, or every game would inherit it from `:root`.
- `.platform` carries no background, or a portal would paint it: `<html>` adds `bg-background` itself.

### The same specimen in both layers

Left, the platform. Right, the same components with four tokens overridden, as a game skin would (`--primary`, `--primary-foreground`, `--radius`, `--font-body`): colour, radius and font change, no component does. This is a simulation; a real skin sets the names on `<html>`.

```specimen
layers-skin
```

## Adding a component

1. Add it with `pnpm dlx shadcn@latest add <comp>` (preset `beEgoY8u`).
2. Move it to `packages/ui/src/platform` and import `cn` from `../utils`.
3. Make it dark-only and token-only.
4. Document it, if it is a building block that other screens will use: a section of the page of [Components](03-components/index.md) that fits, with its live pieces as specimens (see [Design](index.md)). A piece made for one page is not documented.
5. Then use it.

## Guards

Tests keep these rules from coming undone:

- `platform.test.ts` rejects `dark:`, palette and hard-coded colours, arbitrary sizes, and a hard-coded weight, shadow, duration or radius in `packages/ui/src/platform/*`.
- `theme.test.ts` keeps `PLATFORM_THEME_COLOR` (`@pbgo/ui/theme`), the browser colour of platform pages, equal to `--background`.

## In-game UI

The UI that `@pbgo/core` draws inside a game (screens, HUD, announcements, seat label, players strip, game over, chat) is not part of the platform layer. It is drawn in the game's own look, never the platform's.

- Never `@pbgo/ui/platform`, Geist or the `.platform` class: it reads the game's skin tokens, set by `themeStyle()` and tuned by `UI_THEME` (see [Game themes](04-in-game.md#game-themes)).
- A game never forks or restyles an in-game component: it asks for a field in `UiTheme`, which every game then gets.
- No copy in shared components: every label is a `UI_TEXTS` key, in the four languages.

### Room for the cookie banner

A screen as tall as the viewport subtracts the banner (`h-[calc(100dvh-var(--consent-h,0px))]`) and an element fixed to the bottom offsets by it (`bottom-[var(--consent-h,0px)]`), or the banner covers its buttons. `--consent-h` is the height of the banner's outer box, its margin included. `consent-room.test.ts` fails on a violation.

### Compact layout

The Tailwind variant `short` (in `packages/core/styles/game.css`) is keyed on the viewport height, because a phone held sideways is wide but short. The HUD uses it and a game's overlays should too. The hub does not define it. To check a table on a phone held sideways, hide the `DesktopOnly` wall with injected CSS in the browser, never in the code.

### Motion

`motion/react` goes through `useMotion()` (`reduced`, `calm` or `lively`), and `GameHud` mounts `MotionConfig reducedMotion="user"`. Reduced motion always wins over `UI_THEME.motion`: short fades only, no confetti, springs or looping effects. CSS transitions use `duration-*` and `ease-standard` with `motion-reduce:transition-none`. Announcements stay up the same time and are read out in an `aria-live` region. Card and table motion belongs to `@pbgo/table`, not to the in-game UI.

### Clipping the HUD

`GameHud`'s root clips with `overflow-clip`, not `overflow-hidden`: a hidden box is still a scroll container, so a click or focus inside it could scroll the whole table out of place.
