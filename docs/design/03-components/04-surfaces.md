# Surfaces and data

The containers and what they hold: cards, games, the blocks of a hub page, avatars, alerts, progress, separators, lists, empty states and tables.

## Card

Module: `@pbgo/ui/platform/card`

The container of the platform: a `bg-card` surface with a hairline ring and [`shadow-surface`](../02-foundations.md#shadows-and-rings), rounded to [`rounded-4xl`](../02-foundations.md#radius). Header, content and footer share one `--card-spacing`; `size="sm"` tightens it.

### Default and small

`CardAction` sits at the top right of the header. The `sm` size is the compact card, for a short list of facts.

```specimen
card-default-and-small
```

## Game card

Module: `@pbgo/ui/platform/game-card`

The hub's tile for a game: `GameCard`, built on `GameCardVisual`, its picture. The picture is the game's `logo` over its `background` on a grey frame (`bg-muted`); under it come the name, on one line, and the practical facts (`players`, `duration`). Two variants: `play` (the default) and `soon`, for a game to come.

- Every tile is a link, to the page of the game (`/game/<slug>`).
- A game with a logo and no background shows the logo on the plain grey frame. With neither picture, the frame stays plain grey, no placeholder.
- Hover lifts the card ([`shadow-float`](../02-foundations.md#shadows-and-rings)), changes its fill to `secondary` and zooms the pictures.

### The live games, and without art

`players` and `duration` arrive already formatted, since the card does not know the visitor's language: `catalogCardProps()` (`apps/web/src/lib/game-card-props.ts`) does it.

```specimen
game-card-the-live-games-and-without-art
```

### A game to come

The `soon` variant is the tile of a game that is not playable yet: built the same way, plus a small Coming soon badge. It links to the game's page like any other.

```specimen
game-card-a-game-to-come
```

### The picture alone

`GameCardVisual` is the picture of a card on its own; a game's page draws it larger, so the two cannot drift apart.

```specimen
game-card-the-picture-alone
```

## Section

Module: `@pbgo/ui/platform/section`

A block of a hub page: what it shows, and the way to the page of its tab. It is as wide as the window between its [`px-gutter`](../02-foundations.md#spacing-and-layout) margins, with no `max-w-page`, and keeps `pb-section` below it, so a stack needs no spacing of its own. It has no visible title (a screen reader gets an `sr-only` heading); name it with `aria-labelledby` or `aria-label`.

### A preview of a list

`SectionPreview` is for a list that has more to show than the section has room for: what it holds fades out at the bottom (a mask, so it is opacity and no colour of the page) and its `action` sits over the fade. `SectionAction` is a link drawn as a button, bigger than a control of a page; it becomes the framework's link through `asChild`.

```specimen
section-a-preview-of-a-list
```

### Nothing to list yet

A section whose list does not exist yet shows a compact [`Empty`](#empty) that says what is to come, and the same button under it.

```specimen
section-nothing-to-list-yet
```

### Overriding the spacing

`cn` knows the platform's spacing names (`gutter`, `section`, `navbar`), so a `px-0` replaces a `px-gutter` the way it would a `px-4`; `utils.test.ts` keeps it so.

## Avatar

Module: `@pbgo/ui/platform/avatar`

A round marker for a player. It shows the picture when there is one (`AvatarImage`) and the initials otherwise (`AvatarFallback`).

### Sizes, badge and group

- Four sizes: `sm`, the default, `lg` and `xl`.
- `AvatarBadge` marks a state such as online or host, at the bottom right.
- `AvatarCount` puts what waits for the person (messages not read, requests to answer) on the top right corner, as a [`notification`](01-controls.md#badge) badge. It draws nothing for 0.
- `AvatarGroup` overlaps its avatars, so a group shows one initial each, and ends with `AvatarGroupCount`.

```specimen
avatar-sizes-badge-and-group
```

## Alert

Module: `@pbgo/ui/platform/alert`

A message that stays on the page: a notice, a warning, a failed request. For a passing confirmation, use a [toast](03-overlays.md#toast).

### Default, destructive and with an action

The icon is the first child and sits in its own column. `AlertAction` is pinned to the top right.

```specimen
alert-default-destructive-and-with-an-action
```

## Progress, spinner, skeleton

Module: `@pbgo/ui/platform/progress`

Three ways to say that something is on its way. A progress bar when the share is known, a spinner when it is not, a skeleton to hold the shape of content that is loading. Spinner and skeleton are `@pbgo/ui/platform/spinner` and `@pbgo/ui/platform/skeleton`.

### Progress

`value` is the share done.

```specimen
progress-bar
```

### Spinner

It is an icon: size it with `size-*`. Inside a button, give it `data-icon` and the button pads for it.

```specimen
progress-spinner
```

### Skeleton

A pulsing `bg-muted` block. Size and round it to match the content it stands for.

```specimen
progress-skeleton
```

## Separator

Module: `@pbgo/ui/platform/separator`

A hairline between two groups. It is decorative by default (hidden from assistive technology); pass `decorative={false}` when it really divides regions.

### Horizontal and vertical

A vertical separator needs a parent with a height.

```specimen
separator-horizontal-and-vertical
```

## Empty

Module: `@pbgo/ui/platform/empty`

What a list or a page shows when it has nothing yet: say what is missing and offer the one way to fill it. It sets a dashed border style but no border width, so add `border` when it should be framed.

### Icon, message and action

```specimen
empty-icon-message-and-action
```

## Item

Module: `@pbgo/ui/platform/item`

One row of a list: a media, a title and a description, and actions on the right. Use it for settings, tables to join and menus of a page; reach for a [card](#card) when the content is a block of its own.

### Variants

`default` has no frame, `outline` a hairline, `muted` a soft fill.

```specimen
item-variants
```

### Sizes and separators

`default`, `sm` and `xs` trade padding for density. `ItemSeparator` splits rows inside a group.

```specimen
item-sizes-and-separators
```

## Table

Module: `@pbgo/ui/platform/table`

Tabular data with a header row, hairline rows and an optional footer. It scrolls sideways inside its container instead of widening the page.

### Scoreboard

Align numbers to the right. The caption sits under the table; the footer carries the total.

```specimen
table-scoreboard
```
