# Foundations

The tokens the platform's look is made of: colour, type, radius, spacing, depth, glass and motion. The rules they serve, and the two layers they sit in, are in the [Guidelines](01-guidelines.md).

## Colors

Every colour of a platform screen is one of these tokens. The names are shared with the game layer ([Layers and boundary](01-guidelines.md#layers-and-boundary)), so a component never needs to know which layer it is in. The values below are read from this page, not typed.

The palette has these colours and no other:

- the neutral ramp, Tailwind's `neutral` scale with no tint at all, of which every grey is a step;
- `--destructive`, the one signal colour;
- the four colours of a friend's presence (`--presence-online`, `--presence-playing`, `--presence-inactive` and `--presence-dnd`), which only a dot wears;
- the two colours of a sign-in provider's button (`--brand-facebook` and `--brand-discord`), which only that button wears (see [Provider button](03-components/01-controls.md#provider-button));
- the colours of the pieces of the home's title (`--piece-red|gold|navy|ivory|ink`), which only those pieces wear (see [Title pieces](03-components/02-navigation.md#title-pieces)).

### Surfaces and actions

`card-foreground`, `popover-foreground`, `secondary-foreground` and `accent-foreground` equal `foreground`; `primary-foreground` equals `background`. The pairs exist so a game skin can change one side of a pair without the other.

```specimen
colors-semantic
```

### Secondary text, lines and focus

Borders and field outlines are translucent white, so they follow whatever surface they sit on.

```specimen
colors-lines
```

### The neutral ramp

How the tokens above are built. A component never uses `bg-neutral-*` itself (a test rejects it): it uses the token, so a game skin can change what the token means.

The ramp is Tailwind's `neutral` scale with no tint at all: a chroma of 0 in every step, which `theme.test.ts` checks. It is a little darker in its darkest steps: `.platform` redeclares the eleven steps, and 700, 800, 900 and 950 are about 0.03 darker than Tailwind's. `theme.test.ts` keeps every step within 0.04 of its lightness and in its order.

The black of the page is `#060606` (neutral 950), and `PLATFORM_THEME_COLOR` (`@pbgo/ui/theme`) copies it, for the `theme-color` of the browser.

```specimen
colors-neutral-ramp
```

### The one grey

The platform has one grey for every container: `--card`, which `--popover` equals. It is two thirds neutral 900 and a third neutral 950, a dark grey, and not the black of the page (`--background`). The glass of the search bar is a step lighter, `--card-bar`: half way between neutral 900 and 800. What floats over the page keeps most of this grey and blurs what is behind it: see [Glass](#glass).

### Chart

Five greys for the charts of the gamemaster, read by lightness. There is no hue to tell series apart, so charts label their series.

```specimen
colors-chart
```

## Typography

Geist Sans, a variable font loaded through `@fontsource-variable/geist`, in one weight. Line-heights are slightly tight and tighten as the size grows. Letter-spacing is slightly negative. Sizes are Tailwind's `text-*`; the platform changes their line-heights, not their sizes.

### Scale

Each sample is measured on this page: size, line-height over size, letter-spacing in em, weight.

```specimen
type-scale
```

### One weight

Everything is set in one weight, 600. `font-normal`, `font-medium`, `font-semibold` and `font-bold` all resolve to it, so a platform component never writes a `font-*` weight class: `font-medium` on a label changes nothing and is a sign the author reached for a value instead of a token.

```specimen
type-weights
```

Three things set a weight of their own:

- the finest print (`fine-print`) is `font-regular`, 400;
- the title of the home (`display-title`) and a person's name at the head of a profile are `font-strong`, 720;
- each display face has the one weight its font is loaded in (see [The four faces](03-components/02-navigation.md#the-four-faces)).

### Geist

The typeface, in the platform's weight and spacing.

```specimen
type-geist
```

### Tokens

The variables that set the type, with the value each has on this page.

```specimen
token-table
--font-body | font-sans | Text. Geist Variable on the platform; a game skin sets its own.
--font-title | font-heading | Headings and card titles. Same as the body font on the platform.
--tracking-body | | Letter-spacing of the page, set on `.platform`.
--tracking-tight | tracking-tight | Letter-spacing of `h1` to `h4`, a bit tighter than the body.
--text-display | text-display | The two lines of the home's title, as big as the window lets them be (5.8vw and 0.9rem, up to 7rem): the longer line takes 95% of a 390 px window, less its gutters, and 58% of a 1440 px one. It sets no line-height: `display-title` does.
--text-page-title | text-page-title | The title of a page that lists something (Games, Tables, Tournaments): 8rem from a 850px window, and under that 16vw less 0.5rem (2.5rem at the least), so that "Tournaments", the longest, takes 87% of a 390 px window less its gutters. It sets no line-height: `page-title` does.
--font-weight-strong | font-strong | The one weight heavier than the platform's 600. Geist is a variable font, so any weight between 100 and 900 exists.
--tracking-display | | Letter-spacing of the home's title, -0.048em (`display-title`), tighter than the headings' `--tracking-tight`.
```

### Monospace

`font-mono` is the system monospace stack and is for code and token names only, as on this page. Add `tracking-normal` next to it: the platform's negative letter-spacing cramps a monospace.

```specimen
type-monospace
```

## Radius

One family of corners, taken from the menus: the taller the box, the rounder its corner, up to `rounded-4xl` (31px) for a surface and `rounded-2xl` for the rows in it. One base, `--radius` (12px), and every step of the scale (`rounded-*`) is a multiple of it, so a game skin that sets `--radius` rescales every corner at once. Each box below is measured on this page.

```specimen
radius-scale
```

```specimen
token-table
--radius | | The base of the scale, on `.platform`. A game sets its own on `:root`.
--corner-smoothing | | The exponent of the curve of every rounded corner (`corner-shape: superellipse()`), on `.platform`: 1 is the arc of a circle, 2 the squircle. 1.2, a touch.
```

### Which radius

A corner is rounded by about a third to two fifths of the height of what it rounds (two fifths at most), and never by half of it, so that nothing is a capsule. Pick the step by the height: the taller the container, the rounder its corner, up to `rounded-4xl` for one from 6rem high.

| Role | Height | Utility | Radius | Used by |
| --- | --- | --- | --- | --- |
| Surface | A container, from 6rem high | `rounded-4xl` | 31px | Menu, popover, select, dialog, panels (friends, social, chat), card, game card and its picture, cookie banner, login card, an empty state |
| Bar | 4rem to 6rem | `rounded-3xl` | 26px | The home's search bar |
| Large control, island | 3rem to 3.5rem | `rounded-2xl` | 22px | Navbar island, tab bar of the social panel, a row of a list, a menu item, an alert |
| Control | 2.25rem to 2.5rem | `rounded-xl` | 17px | Button, field (input, text area, select trigger, input group), tab bar, a tab of the social panel, a chat bubble, a game's icon of 2.5rem |
| Small control | 2rem | `rounded-lg` | 12px | Small button, toggle, a tab in a tab bar, the buttons and tabs inside a navbar island |
| Chip | 1.5rem | `rounded-md` | 10px | Extra small button, key cap, a game's icon of 1.5rem |
| Tag | 1.25rem | `rounded-sm` | 7px | Badge, checkbox |
| Circle | Only a person | `rounded-full` | full | The picture of a person (`Avatar`) and its dot; the track and the thumb of a switch, a slider and a progress bar |

- The reference is the menus, rounder than they were: `rounded-4xl` is the largest step and nothing is rounder. A bar of 4rem, the home's search bar, is `rounded-3xl`, since at `rounded-4xl` it would be a pill.
- The one exception to "never by half" is the highlight of a menu row: it shows under the pointer only and keeps the menus' own value, `rounded-2xl`.
- Only the picture of a person is a circle. The other exceptions are the few shapes that are one by nature, in the last row of the table. A game, its icon and its card are rounded like anything else, never a circle.
- What sits in a padded container takes the container's radius less its padding, as near as the step and its own height allow. A navbar island is 22px with 8px of padding, so what is in it is 12px (`rounded-lg`, the nearest step). The home's search bar is 64px high with 8px of padding, so its category button is 17px (`rounded-xl`).
- Never write `rounded-[10px]`: the guard test rejects an arbitrary radius. `platform.test.ts` keeps the other rules too: a `rounded-full` is for the circles only, and every corner is smoothed.

### Corner smoothing

Every corner is a superellipse, not an arc of a circle, the way iOS draws its continuous corners (`corner-shape: superellipse(var(--corner-smoothing))`, in Chromium; elsewhere the plain arc stays). The exponent (`--corner-smoothing: 1.2` on `.platform`) is a touch: 1.5 squared the corners too much. Each box below has the same `rounded-3xl`; only the exponent changes, and a `rounded-full` always keeps its arc.

```specimen
corner-smoothing
```

## Spacing and layout

Spacing is Tailwind's own scale (`p-4`, `gap-6`). The platform adds only what a whole page needs: the side gutter, the rhythm between sections, and two widths.

```specimen
token-table
--gutter | px-gutter | Side padding of a page: 1rem on a phone, 1.5rem from the `sm` breakpoint and 4rem (64px) from `lg`, so a desktop keeps a small margin on each side.
--section | py-section | Vertical space between the sections of a page (`pb-section` between two). Widens at the `sm` breakpoint.
--container-page | max-w-page | Width of a page that keeps a limit on a wide screen: a game's page, the pages of the tabs, the centred header of a list. Nearly the whole window, up to this value. The hub's lists of games (the home's sections, `/games`) have none: they take the whole window.
--container-reading | max-w-reading | Width of running text, so a line stays readable.
```

### Gutter

The page content is inset by `px-gutter` on both sides. Resize the window past the `sm` breakpoint, then past `lg`, and it widens.

```specimen
layout-gutter
```

### Widths

`max-w-page` caps a page. `max-w-reading` caps a block of text inside it. This column is narrower than a real page, so the first bar may fill it.

```specimen
layout-widths
```

## Shadows and rings

On black, a shadow barely shows, so most depth comes from surface steps (`background`, `card`, `secondary`) and hairlines. Three shadows exist for the three heights a surface can be at (`shadow-surface`, `shadow-float` and `shadow-overlay`). They are drawn on a `muted` stage below, because the page itself is too dark to show them.

### Shadows

```specimen
depth-shadows
```

### Rings

A hairline ring (`ring-1 ring-foreground/10`) outlines a surface without adding a border to its box. The focus ring is `ring-3` at 30% of `ring`, plus a `border-ring` edge; components add it on `focus-visible`.

```specimen
depth-rings
```

### Scrim

`bg-scrim` dims the page behind a dialog or a sheet. Game art is never dimmed with it: a picture shows as it is. On this checkerboard the left half is bare and the right half has the scrim; the pattern comes from the `pattern-checker` utility.

```specimen
depth-scrim
```

## Glass

A container that floats over the page, an island of the navbar, the dock, a panel, a bar, a menu, a chat, is `glass` (a utility of `platform.css`): the grey of a card, of which it keeps some (`--glass-opacity`), over a blur (`--glass-blur`) that saturates what it blurs (`--glass-saturate`).

The three settings, and the grey, are on `.platform` and the same for every container: no component picks a blur of its own. The one exception is the search bar, which keeps 85% of a lighter grey (`--card-bar`, see [The one grey](#the-one-grey)), so that it is the one that is read first on the page.

### The settings

| Variable | Value | What it sets |
| --- | --- | --- |
| `--glass-opacity` | 92% | How much of the grey the container keeps. Under a tenth of the page shows through, blurred. |
| `--glass-blur` | 32px | How much what is behind the container is blurred. |
| `--glass-saturate` | 100% | How much the blur saturates what it blurs. 100% leaves the colours as they are. |

The opacity is Oré's choice, after trying 66%, 80% and 88%; so is the blur, after trying 24px and none. To make every container more or less transparent, more or less blurred, or lighter or darker, change these variables or the `--card` mix, nowhere else.

### The settings, live

Move the settings here: the samples are real components (an island of the navbar, the search bar, a panel), and the values to keep are printed under the sliders. The search bar keeps its own grey and opacity, so only the blur and the saturation move it.

What the glass lets through is the page behind it: here, big shapes of the colours of the platform and a title. With the opacity at 100% nothing shows through, whatever the blur is; the lower it goes, the more the blur and the saturation matter. The grey (`--card`) is also the one of the cards and the dialogs.

```specimen
glass-lab
```

### The cutout

What is cut out of a picture inside a container, the ring round a status dot (`AvatarBadge`, `AvatarCount`, `PresenceDot`), has to be the colour of what the picture is on. It is therefore not `background` but `--cutout` (`ring-(color:--cutout)`, `bg-(color:--cutout)`): the page's black by default, and `glass` sets it to the grey of the container.

## Motion

Three durations (100, 150 and 250 ms), one easing (`ease-standard`, `cubic-bezier(0.2, 0, 0, 1)`: quick to leave and slow to settle) and one spring. The durations and the easing are tokens of `platform.css`; the spring is only in JavaScript, below.

Plain `transition` and `transition-colors` already use the base duration and the standard easing, so most components write neither. What CSS cannot do, a layout animation or a sequence, is done with `motion/react` (motion.dev, a dependency of `@pbgo/ui` and of `@pbgo/core`) and reads the same numbers.

### Durations

```specimen
motion-durations
```

```specimen
token-table
--transition-duration-fast | duration-fast | Overlays entering and leaving: dialog, sheet backdrop, dropdown, tooltip.
--transition-duration-base | duration-base | The default of `transition` and `transition-colors`: hover and focus on controls.
--transition-duration-slow | duration-slow | Things that travel: a sheet sliding in, the game card art zooming.
--ease-standard | ease-standard | The one easing.
--default-transition-duration | | What `transition` uses when no duration is given: the base duration.
--default-transition-timing-function | | What `transition` uses when no easing is given: the standard easing.
```

### In JavaScript

`@pbgo/ui/motion` copies the three durations and the easing of the stylesheet in the units that `motion/react` takes: `DURATION` in seconds and `EASE_STANDARD` as the four numbers of a bezier. `motion.test.ts` reads `platform.css` and fails when a copy has drifted. The values below are imported from it, not typed here.

```specimen
motion-javascript
```

- `SPRING_TRAVEL` is for something that moves to a place it was not, and has to feel attached to the hand that asked: the fill that glides between the tabs of the navbar. It is stiff (stiffness 520, damping 42: a damping ratio of about 0.9), with no overshoot worth seeing, and settled in about a quarter of a second.
- `DURATION.slow` also times the word of the home's title fading out and in.

### When to move

- The platform moves in JavaScript only for what CSS cannot do, a layout animation, a sequence or a spring: the fill behind the current item of the navbar (`layoutId`, `SPRING_TRAVEL`), the social dock and its panels, a card that moves and the pieces of the home's title (`PLAYFUL`). Everything else is a CSS transition.
- An animation answers an action (a click, a hover) or says that something changed. Use the tokens, never a duration or an easing written in a component (the guard test rejects a numeric duration such as `duration-200`), and reach for `motion` only for a layout animation, a sequence or a spring.
- Less motion is honoured everywhere. In CSS, under `prefers-reduced-motion: reduce`, the three durations become 0ms: nothing animates, and no component needs to check. In JavaScript `Navbar` mounts `MotionConfig reducedMotion=user` (the fill jumps) and the pieces of the home's title stay still, since an animation that starts by itself is the one a visitor who asks for less motion must never get.
- The games' UI shares the curve, not the durations: it uses `EASE_STANDARD` too (`@pbgo/core/lib/motion-preference`) and has its own timings, read with `useMotion()` and tuned by the game's `UI_THEME` (see [In-game UI](04-in-game.md)).

## Playful motion

The platform's own motion is calm on purpose (three short durations and one easing, above). The pieces of the home's title are where it may play: a die that rolls, a coin that is tossed, a wheel of suits, two cards that fold up. Three of the moves, the die's, the coin's and the suits', were chosen and calmed a little. The cards' fold is a fourth, which was not tried five ways.

The lab below plays the four moves with the real pieces (`TitleDie`, `TitleCoin`, `TitleSuits`, `TitleCards`), at a faster tempo than the home's.

```specimen
title-motion-lab
```

### The four moves

The values are `PLAYFUL` of `@pbgo/ui/motion`, which the four pieces read and the lab above prints.

| Piece | Move | Curve | Length | What it adds |
| --- | --- | --- | --- | --- |
| `TitleDie` | An expo snap: 2 or 3 whole turns and the quarters to switch between a six and a three | `cubic-bezier(0.87, 0, 0.13, 1)` | 0.75 s a turn | A swell to 1.12 at the fastest moment |
| `TitleCoin` | A toss pulse: 1 or 2 whole turns | `cubic-bezier(0.65, 0, 0.35, 1)` | 0.9 s a turn | A dip to 0.95, a swell to 1.4 so that it comes at the viewer, a landing squash to 0.94 that springs back (stiffness 320, damping 14) |
| `TitleSuits` | A wheel: 2 or 3 whole laps of the four suits at random, so that it always stops on the heart | `cubic-bezier(0.3, 0.3, 0.2, 1)`: a wind-up, then slower and slower | 0.32 s a place | Faded by 0.3em at both ends of its window, blurred up and down by up to 0.1em, stretched up to 1.2 at speed, 0.1 of a place past its stop and back on a spring (stiffness 240, damping 15) |
| `TitleCards` | A fold: the fan closes to 2 degrees each and 0.04em apart, stays closed, then opens again | an ease in and out, `cubic-bezier(0.65, 0, 0.35, 1)` | 0.35 s to close, 0.3 s closed | It opens again on a spring (stiffness 280, damping 15), a little wider than it stands before it settles |

To change a move, change its values in `PLAYFUL`: the pieces and the lab follow. The table above is written by hand and needs the same change.

### What makes a move playful

- Rarely the curve alone: a swell toward the viewer at the fastest moment, a dip before the toss, a squash on landing, a stretch at speed, a little past the stop and back on a spring.
- The curves are exponential or cubic in and out for what travels, a long ease-out for what spins down and a spring for what settles: never a linear move, never more than one thing at a time that is not the piece itself.

### When they play

- They are rare (every fifteen seconds, the coin every twenty-five or so) and each piece has its own moment, so that the title is never busy.
- A pointer that comes onto a piece plays it at once, if it is not playing already (`usePlayOnEnter` and `rhythm` of `title-play`): the pieces start a move every so often and when the pointer asks, never over itself, and the next one comes after the usual time, counted from the one that was asked for. A finger is a pointer too.
- A visitor who asks for less motion gets the pieces still, whatever the move: the die on its six, the suit a heart, the coin on its profile, the cards in their fan.

## Utilities

Utilities the platform adds on top of Tailwind. Anything else is Tailwind's own scale, read through the tokens above.

| Utility | Does | Token |
| --- | --- | --- |
| `px-gutter`, `py-section`, `pb-section` | Side padding of a page, rhythm between sections | `--gutter`, `--section` |
| `max-w-page`, `max-w-reading` | Width of a page, width of running text | `--container-page`, `--container-reading` |
| `shadow-surface`, `shadow-float`, `shadow-overlay` | The three heights of a surface | `--shadow-*` |
| `display-title` | The home's title: sentence case, Geist at 720, tracking -0.048em, in the full colour of the text, with `text-display` | `--text-display`, `--tracking-display` |
| `page-title` | The title of Games, Tables and Tournaments: one line, Geist at 720, tracking -0.048em, 8rem on a desktop, no fade, with `text-page-title` | `--text-page-title`, `--tracking-display` |
| `title-piece`, `title-cards` | The pieces that stand for letters in the home's title (a die, a coin, a heart) and the two dark blue cards that stand after its last word | `--piece-*` |
| `glass` | A container that floats over the page: the grey of a card at 92%, and `--cutout` set to that grey | `--card`, `--cutout` |
| `fine-print` | The finest print of a page: the footer's line on what the site is not | `--text-xs`, `--foreground` |
| `duration-fast`, `duration-base`, `duration-slow` | Duration of a transition | `--transition-duration-*` |
| `ease-standard` | The easing of a transition | `--ease-standard` |
| `bg-scrim` | Dimming layer behind a dialog or a sheet | `--color-scrim` |
| `bg-secondary-hover` | Hover state of a `secondary` surface | `secondary` mixed with 8% of `foreground` |
| `font-heading` | Heading font | `--font-title` |
| `pattern-checker` | Checkerboard that makes translucency visible | `foreground` at 8% |

## Text selection

The platform is an app, not a document, so its texts cannot be selected: `user-select: none` is on `.platform`, in `platform.css`, for the hub, the legal pages and the gamemaster. A game's page has its own root and its own rules.

Three things can be selected all the same:

- a field (Safari needs the fields said, since one inside a text that cannot be selected would not take the caret);
- a code sample (`pre`, `code`);
- whatever carries `data-selectable` or the `select-text` class, a table code to copy for instance.

`platform.test.ts` keeps both rules. These docs are an example: their text opts in with `data-selectable`, so that it can be copied, and their specimens keep the rule.
