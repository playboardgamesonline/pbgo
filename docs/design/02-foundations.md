# Foundations

The tokens the platform's look is made of: colour, type, radius, spacing, depth, glass and motion. The rules they serve, and the two layers they sit in, are in the [Guidelines](01-guidelines.md).

## Colors

Every colour of a platform screen is one of these tokens. The names are shared with the game layer ([Layers and boundary](01-guidelines.md#layers-and-boundary)), so a component never needs to know which layer it is in.

The palette has these colours and no other:

- the neutral ramp, Tailwind's `neutral` scale with no tint, of which every grey is a step;
- `--destructive` and `--success`, the signal colours: a loss or an error, and a win, worn as a dark tint with the colour itself for the text;
- `--presence-online|playing|inactive|dnd`, worn by a friend's presence dot only;
- `--brand-facebook` and `--brand-discord`, worn by their sign-in button only;
- `--piece-red|gold|navy|ivory|ink`, worn by the pieces of the home's title only;
- `--crest-*`, worn by the rank crests only.

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

How the tokens above are built. A component never uses `bg-neutral-*` (a test rejects it): it uses the token, so a game skin can change what the token means.

The ramp has no tint at all and is a little darker than Tailwind's in its darkest steps, so that the page is a true black. `theme.test.ts` keeps it that way, and `PLATFORM_THEME_COLOR` (`@pbgo/ui/theme`) copies the page's black for the browser.

```specimen
colors-neutral-ramp
```

### The one grey

The platform has one grey for every container: `--card`, which `--popover` equals. It is not the black of the page (`--background`). A step lighter, `--card-bar`, is for what is read before the rest: the glass of the search bar, and a panel raised beside a list. What floats over the page keeps most of this grey and blurs what is behind it: see [Glass](#glass).

## Typography

Geist Sans, a variable font, in one weight. Line-heights and letter-spacing are slightly tight. Sizes are Tailwind's `text-*`; the platform changes their line-heights, not their sizes.

### Scale

Each sample is measured on this page.

```specimen
type-scale
```

### One weight

Everything is semibold. `font-normal`, `font-medium`, `font-semibold` and `font-bold` all resolve to it, so a platform component never writes a `font-*` weight class.

```specimen
type-weights
```

Three things set a weight of their own: the finest print (`fine-print`, `font-regular`), the title of the home and a person's name at the head of a profile (`display-title`, `font-strong`), and the display faces of the logo's lettering (`display-*` in `platform.css`, the one weight each font is loaded in).

### Geist

The typeface, in the platform's weight and spacing.

```specimen
type-geist
```

### Tokens

The variables that set the type, with the value each has on this page.

```specimen
token-table
--font-body | font-sans | Text. Geist on the platform; a game skin sets its own.
--font-title | font-heading | Headings and card titles. The body font on the platform.
--tracking-body | | Letter-spacing of the page, set on `.platform`.
--tracking-tight | tracking-tight | Letter-spacing of `h1` to `h4`.
--text-display | text-display | The size of the home's title. It sets no line-height: `display-title` does.
--text-page-title | text-page-title | The size of the title of a page that lists something. It sets no line-height: `page-title` does.
--font-weight-strong | font-strong | The one weight heavier than the platform's.
--tracking-display | | Letter-spacing of the large titles, tighter than `--tracking-tight`.
```

### Monospace

`font-mono` is for code and token names only, as on this page. Add `tracking-normal` next to it: the platform's negative letter-spacing cramps a monospace.

```specimen
type-monospace
```

## Radius

One family of corners: the taller the box, the rounder its corner, up to `rounded-4xl` for a surface. One base, `--radius`, and every step of the scale (`rounded-*`) is a multiple of it, so a game skin that sets `--radius` rescales every corner at once. Each box below is measured on this page.

```specimen
radius-scale
```

```specimen
token-table
--radius | | The base of the scale, on `.platform`. A game sets its own on `:root`.
--corner-smoothing | | The curve of every rounded corner (`corner-shape: superellipse()`), on `.platform`.
```

### Which radius

Pick the step by the height of the box: the taller it is, the rounder its corner, and never half its height, so that nothing is a capsule.

| Role | Utility | Used by |
| --- | --- | --- |
| Surface | `rounded-4xl` | Menu, popover, select, dialog, panels (friends, social, chat), card, game card and its picture, cookie banner, login card, an empty state |
| Bar | `rounded-3xl` | The home's search bar |
| Large control, island | `rounded-2xl` | Navbar island, tab bar of the social panel, a row of a list, a menu item, an alert |
| Control | `rounded-xl` | Button, field (input, text area, select trigger, input group), tab bar, a tab of the social panel, a chat bubble |
| Small control | `rounded-lg` | Small button, toggle, a tab in a tab bar, the buttons and tabs inside a navbar island |
| Chip | `rounded-md` | Extra small button, key cap, a small game icon |
| Tag | `rounded-sm` | Badge, checkbox |
| Circle | `rounded-full` | The picture of a person (`Avatar`) and its dot; the track and the thumb of a switch, a slider and a progress bar |

- `rounded-4xl` is the largest step and nothing is rounder. A bar, the home's search bar, is `rounded-3xl`, since at `rounded-4xl` it would be a capsule.
- The one exception to "never half" is the highlight of a menu row, which shows under the pointer only and keeps `rounded-2xl`.
- Only the picture of a person is a circle, besides the shapes that are one by nature (last row). A game, its icon and its card are rounded like anything else.
- What sits in a padded container takes the container's radius less its padding, as near as a step allows: the buttons in a navbar island are `rounded-lg`, the category button in the search bar `rounded-xl`.
- Never write an arbitrary radius (`rounded-[10px]`): `platform.test.ts` rejects it, keeps `rounded-full` for the circles and checks that every corner is smoothed.

### Corner smoothing

Every corner is a superellipse, as iOS draws its continuous corners (`corner-shape: superellipse(var(--corner-smoothing))` in Chromium; elsewhere the plain arc stays). Each box below has the same `rounded-3xl`; only the exponent changes. A `rounded-full` always keeps its arc.

```specimen
corner-smoothing
```

## Spacing and layout

Spacing is Tailwind's own scale (`p-4`, `gap-6`). The platform adds only what a whole page needs: the side gutter, the rhythm between sections, and two widths.

```specimen
token-table
--gutter | px-gutter | Side padding of a page; it widens at the larger breakpoints.
--section | py-section | Vertical space between the sections of a page (`pb-section` between two).
--container-page | max-w-page | Width of a page that keeps a limit on a wide screen. The hub's lists of games take the whole window instead.
--container-reading | max-w-reading | Width of running text, so a line stays readable.
```

### Gutter

The page content is inset by `px-gutter` on both sides, and the inset widens at the larger breakpoints.

```specimen
layout-gutter
```

### Widths

`max-w-page` caps a page, `max-w-reading` a block of text inside it.

```specimen
layout-widths
```

## Shadows and rings

On black a shadow barely shows, so most depth comes from surface steps (`background`, `card`, `secondary`) and hairlines. Three shadows exist for the three heights of a surface: `shadow-surface`, `shadow-float` and `shadow-overlay`.

### Shadows

```specimen
depth-shadows
```

### Rings

A hairline ring (`ring-1 ring-foreground/10`) outlines a surface without a border. The focus ring is `ring` plus a `border-ring` edge; components add it on `focus-visible`.

```specimen
depth-rings
```

### Scrim

`bg-scrim` dims the page behind a dialog. Game art is never dimmed with it.

```specimen
depth-scrim
```

## Glass

A container that floats over the page (a navbar island, the dock, a panel, a bar, a menu, a chat) is `glass`, a utility of `platform.css`: the grey of a card, partly translucent (`--glass-opacity`), over a blur (`--glass-blur`) that saturates what it blurs (`--glass-saturate`). The three settings are on `.platform` and the same for every container: no component picks a blur of its own. The one exception is the search bar, which uses the lighter `--card-bar` (see [The one grey](#the-one-grey)) so that it is read first. To change the glass of every container, change these variables or the `--card` mix, nowhere else.

### The settings, live

Move the settings on real components: an island of the navbar, the search bar, a panel. The search bar keeps its own grey, so only the blur and the saturation move it.

```specimen
glass-lab
```

### The cutout

What is cut out of a picture inside a container (the ring round a status dot: `AvatarBadge`, `AvatarCount`, `PresenceDot`) must be the colour of what the picture is on: not `background` but `--cutout` (`ring-(color:--cutout)`, `bg-(color:--cutout)`), which `glass` sets to the container's grey.

## Motion

Three durations (`fast`, `base`, `slow`), one easing (`ease-standard`, quick to leave and slow to settle) and one spring. The durations and the easing are tokens of `platform.css`; the spring is only in JavaScript. Plain `transition` and `transition-colors` already use the base duration and the standard easing, so most components write neither. What CSS cannot do (a layout animation, a sequence) is done with `motion/react`, which reads the same numbers.

### Durations

```specimen
motion-durations
```

```specimen
token-table
--transition-duration-fast | duration-fast | Overlays entering and leaving: dialog, dropdown, popover.
--transition-duration-base | duration-base | The default of `transition` and `transition-colors`: hover and focus on controls.
--transition-duration-slow | duration-slow | Things that travel: the dock opening, the game card art zooming.
--ease-standard | ease-standard | The one easing.
```

### In JavaScript

`@pbgo/ui/motion` copies the durations and the easing in the units `motion/react` takes (`DURATION`, `EASE_STANDARD`); `motion.test.ts` fails when a copy drifts from `platform.css`. The values below are imported from it, not typed here.

```specimen
motion-javascript
```

`SPRING_TRAVEL` is for something that moves to a place it was not and must feel attached to the hand that asked, like the fill that glides between the tabs of the navbar: stiff, with no visible overshoot.

### When to move

- The platform moves in JavaScript only for what CSS cannot do: the fill behind the current item of the navbar, the social dock and its panels, a card that moves, the pieces of the home's title. Everything else is a CSS transition.
- An animation answers an action or says that something changed. Use the tokens, never a duration or an easing written in a component (the guard test rejects `duration-200`).
- Less motion is honoured everywhere. In CSS the durations become zero under `prefers-reduced-motion`, so no component checks. In JavaScript `Navbar` mounts `MotionConfig reducedMotion=user`, and an animation that starts by itself (the title's pieces) stays still.
- The games' UI shares the curve (`EASE_STANDARD`), not the durations: it has its own timings, read with `useMotion()` and tuned by `UI_THEME` (see [In-game UI](04-in-game.md)).

## Utilities

Utilities the platform adds on top of Tailwind. Anything else is Tailwind's own scale, read through the tokens above.

| Utility | Does | Token |
| --- | --- | --- |
| `px-gutter`, `py-section`, `pb-section` | Side padding of a page, rhythm between sections | `--gutter`, `--section` |
| `max-w-page`, `max-w-reading` | Width of a page, width of running text | `--container-page`, `--container-reading` |
| `shadow-surface`, `shadow-float`, `shadow-overlay` | The three heights of a surface | `--shadow-*` |
| `display-title` | The home's title: sentence case, strong weight, tight tracking, the full colour of the text | `--text-display`, `--tracking-display` |
| `page-title` | The title of Games, Tables and Tournaments: one line, strong weight, no fade | `--text-page-title`, `--tracking-display` |
| `title-piece`, `title-cards` | The pieces that stand for letters in the home's title, and the two cards after its last word | `--piece-*` |
| `glass` | A container that floats over the page | `--card`, `--cutout` |
| `fine-print` | The finest print of a page: the footer's line on what the site is not | `--text-xs`, `--foreground` |
| `duration-fast`, `duration-base`, `duration-slow` | Duration of a transition | `--transition-duration-*` |
| `ease-standard` | The easing of a transition | `--ease-standard` |
| `bg-scrim` | Dimming layer behind a dialog | `--color-scrim` |
| `bg-secondary-hover` | Hover state of a `secondary` surface | `secondary` mixed with `foreground` |
| `font-heading` | Heading font | `--font-title` |
| `pattern-checker` | Checkerboard that makes translucency visible | `foreground` |

## Text selection

The platform is an app, not a document: `user-select: none` is on `.platform`. Three things can be selected all the same: a field, a code sample (`pre`, `code`), and whatever carries `data-selectable` or the `select-text` class, a table code to copy for instance. `platform.test.ts` keeps both rules. These docs opt in with `data-selectable`.
