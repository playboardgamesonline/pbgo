# Surfaces and data

The containers and what they hold: cards, plans, games, credits, the blocks of a hub page, avatars, alerts, progress, separators, lists, empty states and tables.

## Card

Module: `@pbgo/ui/platform/card`

The container of the platform: a `bg-card` surface with a hairline ring and [`shadow-surface`](../02-foundations.md#shadows-and-rings), rounded to [`rounded-4xl`](../02-foundations.md#radius). Header, content and footer share one `--card-spacing`; `size="sm"` tightens it.

### Default and small

`CardAction` sits at the top right of the header. The `sm` size is the compact card, for a short list of facts.

```specimen
card-default-and-small
```

## Plan card

Module: `@pbgo/ui/platform/plan-card`

`PlanCard` is a plan of the Pricing page, in a [`Card`](#card). It draws what it is given and the page decides what its button does. The plans of a row are the same size and the same weight, and stretch to the tallest: none is highlighted, since no plan is known to be the one people take.

### Three plans

As the Pricing page draws them: the selector, then three columns from `lg` and one column under it. `/pricing` puts them under its title, after a line that says what a plan is for, and ends with a line and a call to the publishers. Under `lg` the column is 28rem wide at the most and centred: three columns at 768px leave a card 224px wide, too narrow for a price and its period.

```specimen
plan-card-three-plans
```

### What a card shows

From top to bottom:

- A small picture (`visual`), which only decorates. `PlanVisual` is an icon on a tinted square, 3rem wide, for want of art (a die, sparkles and a crown on the Pricing page); a picture of its own takes its place when there is one.
- The name (`name`): an `h2`, the heading of the card, which is a labelled group.
- What the plan is for (`description`, a `CardDescription`), short enough for one line at 1024px, or the buttons of a row stop being level.
- The price (`price`) in Geist at 720 (`text-4xl`, `text-5xl` from `xl`), with what it is for after it (`period`: `/ month`, in the muted colour, under the price when the room runs out; a free plan has none).
- How it is billed, under that (`note`). Every plan has one, the free one's included, so that the buttons of a row stay level.
- The button that takes it (`action`), as wide as the card.
- A hairline, then the list of what it includes (`features`), a tick before each (the tick of [`Perks`](02-navigation.md#stats)).

### Monthly or annually

Over the row, a [`ToggleGroup`](01-controls.md#toggle-group) picks how the paid plans are paid: month by month (Monthly) or a year at once (Annually, with "Save 25%" on it). A year paid at once costs a quarter less than twelve months (`ANNUAL_DISCOUNT` of `apps/web/src/lib/plans.ts`).

The group is single: a second click on the chip that is on keeps it. It changes the price and the note of the paid cards, a year being shown as the month it comes to with the whole year under it, and nothing else moves.

### The plans

The page has three: Free, Plus and Club. A paid plan starts with what the plan under it has.

| Plan | Includes |
| --- | --- |
| Free | Every game of the catalog; no sign-up to join a table; tables with friends, chat included; a profile and 3 months of game history |
| Plus | Everything in Free; creating games with premium expansions; creating tournaments between friends and playing in tournaments; a voice room during games; advanced statistics; unlimited game history |
| Club | Everything in Plus; creating tournaments open to all; early access to new games; entering contests organised by publishers; a vote on the next games |

### Plans that cannot be taken

Nothing is built, and the paid plans cannot be taken since the games are not licensed. A plan that cannot be taken is `disabled`: half transparent and `aria-disabled`, with a disabled "Coming soon" button, while the free plan has the only live button, "Start playing".

A line under the cards says why no paid subscription is offered for now, and a message invites the publishers to write (`CONTACT` of `apps/web/src/site.ts`). What the publishers will be paid is not said on this page (a fuller footer may one day).

### Words and prices

The words and the prices of the page are `apps/web/src/lib/plans.ts`, drawn by `PricingPlans` (`apps/web/src/components/pricing-plans.tsx`). They are a first draft. Where each part comes from:

- The three prices and the quarter off a year are Oré's.
- What each plan includes is Oré's lists of 2026-10-30, except the lines of the free plan other than its history, which are what the site does now.
- The names and what each plan is for are only a first draft.

## Game card

Module: `@pbgo/ui/platform/game-card`

The hub's tile for a game: `GameCard`, built on `GameCardVisual`, its picture. The picture is the game's `logo`, over its `background` picture when it has one, on a grey 4:3 frame (`bg-muted`). Under it come the name, on one line and cut with an ellipsis when it does not fit, and the practical facts (`players`, `duration`), nothing else. The card has two variants: `play` (the default) for a game to play and `soon` for a game to come.

- Every tile is a link, to the page of the game (`/game/<slug>`).
- Game art is the only colour of the platform, so the card adds none: no accent.
- No layer is laid over the art, no scrim or tint: the logo is drawn straight on the background, and the art shows as it is.
- A game with a logo and no background shows the logo on the plain grey frame. With neither picture, the frame stays plain grey, no placeholder.
- Hover lifts the card ([`shadow-float`](../02-foundations.md#shadows-and-rings)), changes its fill to `secondary` and zooms the pictures.

The specimens below show the card of a live game and of a game to come, then the picture alone. The tiles made up for them borrow the first pictures of the catalog.

### The live games, and without art

The first cards are the live games of the catalog, as the hub renders them. Each one is the game in the platform's Sanity project: its name, its logo and its background (from its image CDN) and its facts; the registry only makes it a play card. After them come three made-up tiles: both pictures, no art, and a name too long to fit on one line. `players` and `duration` arrive already formatted: `catalogCardProps()` in `apps/web/src/lib/game-card-props.ts` does it, since the card does not know the visitor's language.

```specimen
game-card-the-live-games-and-without-art
```

### A game to come

The `soon` variant is the tile of a game that is not playable yet. It sits in the same list as the live games, built the same way: the same grey frame, the logo (or icon) over the background, the same facts (players, duration), plus a small Coming soon badge at its top right. Like any other tile it links to the game's page, where the button is disabled.

Both pictures come from the image CDN of the platform's Sanity project. The hub builds the tile with `catalogCardProps()`, the function of the live games, from a game of the platform's Sanity project (`docs/catalog.md`).

```specimen
game-card-a-game-to-come
```

### The picture alone

`GameCardVisual` is the picture of a card on its own. The page of a game on the hub draws it larger, in the place of its card, rounded like a card with a hairline ring, so that the card and the page cannot drift apart.

```specimen
game-card-the-picture-alone
```

## Credit link

Module: `@pbgo/ui/platform/credit-link`

`CreditLink` is a name in the credits of a game's page that leads somewhere else, a publisher's: the icon of its website at the left of its name, the two being one link that opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). The page of a game uses it for its publishers.

- The icon is a plain `<img>` of an address of this site's own, so a visitor's browser never asks the publisher's website for anything.
- That address is the catalog route `/api/catalog/<slug>/publisher-<n>` (`docs/catalog.md`): it looks for the icon on the publisher's website (its page's `rel=icon` links, else `/favicon.ico`) and the CDN keeps it.
- It is decorative (`alt=""`): the name is what the link says.
- Its place, 16px, is kept from the first paint so that the name does not move when the icon comes in.
- A website with no icon, or one that cannot be had, leaves the name alone, and so does a publisher with no website (a name, no link).
- The picture is only asked for once the page is interactive, so that a failure is always heard.

### In the credits of a game

The lines of a game's page, as it draws them: names for the designers and the artists, and for the publishers a link with its icon. The second publisher's icon cannot be had (the address is one nobody serves), so its name stands alone; the third has no website.

```specimen
credit-link-in-the-credits-of-a-game
```

## Section

Module: `@pbgo/ui/platform/section`

A block of a hub page: what it shows, and the way to the page of its tab. The home is a stack of them (the popular games, the tables and tournaments in progress, what's new).

- It is as wide as the window between its [`px-gutter`](../02-foundations.md#spacing-and-layout) margins (64px on a desktop), with no `max-w-page`, so the cards of a list fill a desktop screen.
- It keeps `pb-section` below it, so a stack needs no spacing of its own.
- It has no visible title: what it shows says what it is, and a screen reader gets an `sr-only` heading.
- Name it with `aria-labelledby`, pointing at its heading, or with an `aria-label`.

### A preview of a list

`SectionPreview` is for a list that has more to show than the section has room for: what it holds fades out at the bottom (a mask on the content alone, `mask-b-from-60%`, so it is opacity and no colour of the page) and its `action` sits over the fade, centred.

`SectionAction` is a link drawn as a button, bigger than a control of a page (`h-12`, `text-base`): it is the one thing a visitor is asked to do there. It becomes the framework's link through `asChild` (`@pbgo/ui` is framework-free).

The home cuts its grid of popular games to three rows at every width: the cards beyond them are `hidden`, so they are neither drawn nor reached by the keyboard.

```specimen
section-a-preview-of-a-list
```

### Nothing to list yet

A section whose list does not exist yet shows an [`Empty`](#empty) that says what is to come, compact (`p-6`, not the `p-12` of a page with nothing else) since the home stacks three of them, and the same button under it, centred by the section (`items-center`). The tab's own page says the same. The rows of tables, or the cards of tournaments, will take the place of the empty state, in a `SectionPreview`, with the same fade and the same button as the games.

```specimen
section-nothing-to-list-yet
```

### Overriding the spacing

`cn` knows the platform's own spacing names (`gutter`, `section`, `navbar`), so a `px-0` replaces a `px-gutter` the way it would a `px-4`: the specimens above pass `px-0 pb-0` to sit in a frame. Before that, tailwind-merge kept both and the order of the generated CSS decided; `packages/ui/src/utils.test.ts` now keeps that from coming back.

## Avatar

Module: `@pbgo/ui/platform/avatar`

A round marker for a player. It shows the picture when there is one (`AvatarImage`) and the initials otherwise (`AvatarFallback`).

### Sizes, badge and group

- There are four sizes: `sm` (24px), the default (32px), `lg` (40px) and `xl` (64px), the picture of a profile, at the top of the menu of the account.
- `AvatarBadge` marks a state such as online or host, at the bottom right.
- `AvatarCount` puts what waits for the person (messages not read, requests to answer) on the top right corner, as a [`notification`](01-controls.md#badge) badge outlined in the colour of the page. It draws nothing for 0 and says `99+` over 99.
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

`value` goes from 0 to 100.

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

A vertical separator needs a parent with a height, here `h-5`.

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
