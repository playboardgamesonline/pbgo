# Principles

The platform is black and white, dark only, set in Geist semibold, and built from the tokens and components of `@pbgo/ui`. Every token and building block is documented in these docs, so check them before building a screen. The design of a page is not: these docs describe what screens are made of, never one screen.

- No tint and no gradient: the palette is the `neutral` scale plus `destructive` and `success`, and the few other hues are listed in [Colors](../02-foundations/01-colors.md), each worn by one thing only. The first screen of a page, the home's hero included, is the page's black, flat.
- Dark only: no light theme, no `dark:` variants.
- One typeface, Geist, in one weight: never write `font-medium` or `font-bold`. Only the finest print and the large titles set another weight on purpose (`fine-print`, `font-strong`).
- Apart from those hues, game art is the only colour, and it is shown as it is: never tint, recolour or dim it, and lay nothing between a logo and its background. The one exception is art behind the head of a page, which fades into the page with gradients from `background` that ease in and out, so no edge shows. Text laid on that art is white at an opacity, never the grey of secondary text, so that the fades can stay light.
- Rounded, never round: the taller a box, the rounder its corner, up to `rounded-4xl`, and nothing is a capsule. Only the picture of a person is a circle ([Radius](../02-foundations/03-radius.md)).
- Depth comes from surface steps and hairlines, then from three shadows: `shadow-surface`, `shadow-float`, `shadow-overlay`.
- Tokens, not values: no hex, `rgb()`, arbitrary pixel size, font name or `bg-neutral-*` in platform UI. Write `bg-card`, `text-muted-foreground`, `rounded-3xl`, `px-gutter`.
- A missing piece goes into `@pbgo/ui` first, then into these docs when other screens will use it ([Adding a component](03-adding-a-component.md)), then it is used. What only one page is made of (the head of a game's page, its lobby, its leaderboard) is not documented here.
- Out of scope: brand fonts, a light theme and game boards.

## Do and do not

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

## Where things live

| What | Where |
| --- | --- |
| Tokens and the boundary between the layers | `packages/ui/src/styles/platform.css` |
| Components | `packages/ui/src/platform/<name>.tsx`, imported as `@pbgo/ui/platform/<name>` |
| Class names | `cn()` from `@pbgo/ui/utils` |
| Colour of the browser chrome | `PLATFORM_THEME_COLOR` from `@pbgo/ui/theme` |
