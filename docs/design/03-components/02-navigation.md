# Navigation and brand

The bars that take a visitor from page to page, and the marks of the brand: the logo, the wordmark, the pieces of the home's title.

The pieces here are hand-written for the platform, not taken from shadcn. The hub's layout mounts the navbar once, the home's hero is made of the title, the figures under it and the search bar, and the footer ends the pages of the hub with the wordmark.

## Logo

Module: `@pbgo/ui/platform/logo`

The mark of the platform, PB over GO, drawn as an inline SVG on `currentColor`: it takes the colour of the text around it and needs no file, since `apps/web/public` holds `favicon.ico` only. Its height is `h-8` and its width follows.

### Sizes and colour

Size it with a height (`h-6`, `h-12`…) and colour it with a text colour. The navbar uses `h-6`, the size of its tabs' text. It is hidden from screen readers, so a link around it carries the name (`aria-label`); a logo that stands alone takes a `title`.

```specimen
logo-sizes
```

## Wordmark

Module: `@pbgo/ui/platform/wordmark`

The name of the brand as four big letters, PBGO, as wide as the room it is given: the backdrop of the footer. It is SVG text scaled by its viewBox, so it is always the width of its container: size it with the width of its parent. It is decorative (`aria-hidden`): the brand is named by the logo and the page's own text.

The letters are set in the faces the logo is drawn in (the display faces, [below](#the-four-faces)), so it is the logo's own lettering and not Geist:

| Letter | Face | Style |
| --- | --- | --- |
| P | `display-fraktur` | blackletter |
| B | `display-unkempt` | handwritten |
| G | `display-jersey` | pixel |
| O | `display-birthstone` | script |

### Placement of the letters

Each letter is placed by hand from its measured ink, not from the advance of its glyph: the faces have very different side bearings, which left the P and the B almost touching and a wide gap between the B and the G. The distances are in the units of the viewBox.

- The boxes of the ink of two letters are 20 units apart, except the P and the B.
- The P is a bowl on top and a tail below with nothing between them at its right, so it leaves much air at its lower right: on its closest row the B was 69 units from it, against 20 for the B and the G and for the G and the O. The B and what follows come 33 units closer to the P (their boxes overlap, their shapes do not), which leaves the closest row about 38 units apart: nearer than it was, a little looser than the other pairs, which is what looks right. Fifty units closer, as close as the others, was too tight.
- The ink of the P starts at the left edge of the viewBox and the ink of the O ends at its right edge, so the wordmark reaches both edges of the window.
- The letters are aligned on the middle of their ink, not on a baseline, since the P and the O have a tail under the baseline that the B and the G do not.
- The numbers come from a canvas `measureText` at 360 units, with the faces' own scales. Measure again when a face changes.

### The veil

The fill fades in a straight line from white (`--foreground`) at 16% at the top of the letters to nothing at 92% of their height: an SVG gradient in the units of the viewBox, with two stops, so nothing is left on the last 8%. It is a soft veil and not a grey, so the wordmark is a drawing behind the page's text and not a title.

### In the footer

`SiteFooter` (in `apps/web`) is the footer of the hub's pages, as wide as the site, with no line between its parts. From the top:

1. One row. On the left, the copyright and who built the site (`COPYRIGHT_YEAR`, `SITE_NAME` and `AUTHOR` of `@/site`, the author's name being a link to their site). On the right, the legal pages: Privacy Policy, Cookie Policy (the cookies section of the legal notice) and Terms of Use. The Privacy Policy and the Terms of Use are `LegalStubPage`s until their text is written.
2. The wordmark, from edge to edge. It takes the width of its parent and its height follows, so it keeps its proportions from a phone to a desktop.
3. Alone under it and centred, what the site is not: an unofficial adaptation, the games belong to their authors and the publisher. It is the finest print of the page (`fine-print`: `text-xs`, a regular weight (400) and `foreground` at 20%, so dark that it is hard to read), a little apart from the letters (`mt-3`, and its own `p-1`) and with `pb-5` under it.

Each text of the footer has 4px of padding of its own (`p-1`: the copyright, each legal link, the fine print) and the row has 20px (`p-5`), so the texts are 24px from the edges of the window, like the navbar's, and no more.

```specimen
wordmark-footer
```

### The four faces

The display faces are the typefaces the logo's four letters are drawn in. Each is a utility of `platform.css` that sets the family, the weight and the size of one typeface, in the order of `faces.ts`: `display-unkempt`, `display-jersey`, `display-fraktur` and `display-birthstone`.

Each font is a Fontsource package (`@fontsource/*`, the latin subset) imported by `apps/web/src/app/globals.css`, in the one weight it is set at, so a game page never carries them. The size is a scale of the parent's that gives the face the cap height of Geist's capitals (measured, not guessed), so a word in a face does not stand taller than the words around it. What the browser computed for the sample is printed beside it.

```specimen
wordmark-faces
```

- Each face sets its own weight: the platform's 600 on a face that has none would be a fake bold. The title of the home and a person's name (720, `font-strong`), the finest print (400, `fine-print`) and these faces are the only text with a weight other than 600.
- A face is swapped in `styles/platform.css` (its utility), in `faces.ts` (its place in the order) and in the app's `globals.css` (its import). Nothing else names a font.
- The display faces are for a title from `text-3xl` up. A title stays one text, written as it is (the capitals are CSS), for a screen reader and a search engine.

## Navbar

Module: `@pbgo/ui/platform/navbar`

The top of a page, in two containers kept apart over a transparent bar: the brand and the tabs on the left (`NavbarStart`), the account on the right (`NavbarEnd`). Nothing is drawn between them: the page shows through the bar and the pointer goes through it, so the page shows behind both islands.

### Parts of the navbar

| Part | What it is |
| --- | --- |
| `Navbar` | The bar: transparent, `h-navbar` high |
| `NavbarStart` | The left island: the brand, then the tabs |
| `NavbarEnd` | The right island: the account |
| `NavbarIsland` | A glass island on its own, for what hangs on the bar beside the two containers, such as the [friends' bar](05-social.md#friends-bar) |
| `NavbarBrand` | The home's button: a `size-10` square around the `Logo` |
| `NavbarTabs` | The tabs, next to the brand in the same island |
| `NavbarTab` | One tab, a link. `current` marks the page the visitor is in, `disabled` a page that does not exist yet |
| `NavbarSeparator` | A hairline between two groups of tabs: `w-px`, `h-5`, `bg-border` |

### On the home, signed out

The logo is the home's button, a square: on the home it is `current`, and no tab is. `current` puts the bar's fill (`bg-muted`) behind the item, the same one for the logo and for a tab, and the logo is as white as ever. On any other page the logo is as quiet as a tab. `NavbarTab` marks the page the visitor is in with `current`. Sign in is the ghost button and `Let's play` the primary one, both of size `lg`, the height of what an island holds. The specimens sit on `bg-card`, a little lighter than the page, so that the glass of the islands can be seen.

```specimen
navbar-signed-out
```

### On a tab's page, signed in

On the page of a tab, here Games, the tab has the muted fill and the logo is quiet. The account is an [`Avatar`](04-surfaces.md#avatar) in place of the two buttons: at `size-10`, the height of what an island holds, it stays round inside the square container; what it opens is the page's business.

```specimen
navbar-signed-in
```

### Moving between the items

The current item has the bar's fill behind it, and that fill is one element for the whole bar (`layoutId` of `motion/react`): when the current item changes it glides to the next with a spring (`SPRING_TRAVEL` of `@pbgo/ui/motion`, about a quarter of a second, no overshoot worth seeing) instead of jumping. Click the logo and the tabs. It can only glide if the bar stays mounted from one page to the next, which is why [the hub's layout mounts it once](#on-the-hub).

`Navbar` mounts a `MotionConfig reducedMotion=user`, so a visitor who asks for less motion gets the jump, and a `LayoutGroup` of its own, so each bar scopes its own fill and two bars on one page, like the specimens of this page, do not trade it.

```specimen
navbar-moving
```

### The islands

- Each container is a glass island: a rounded square, `h-14 rounded-2xl border glass shadow-surface` (a border, a blur, a light shadow), and not a pill. It takes the pointer back from the bar, which lets it through.
- What an island holds is one step less round: `h-10` and `rounded-lg`, the island's radius less its `p-2`, so the corners stay concentric. `NavbarEnd` makes the buttons in it `rounded-lg` too, so the page does not have to remember it (elsewhere a button is `rounded-xl`).
- The bar spans the window, not the page's `max-w-page`, so the islands sit on its edges: `1.5rem` in from the top and from each side (the bar's `p-6`), with the same `1.5rem` left under them. With their own `3.5rem` that is the `6.5rem` of `h-navbar`.

### Placing the bar

- The bar is pinned with `fixed inset-x-0 top-0 z-40` so that it stays in view while the page scrolls.
- The page leaves `pt-navbar` under it, or lets the backdrop of its first screen run under the islands (the home's hero does). An anchor that lands below it has `scroll-mt-navbar`.

### Tabs and groups

- The tabs leave the first island under `md`, where the account needs the room: on a phone only the logo is left.
- `NavbarSeparator` is a hairline between two groups of tabs. The hub has one between Tournaments and About: the tabs for playing, then the ones about the site (About and Pricing: the `group` of `SITE_TABS`).
- The tabs about the site leave the bar under `lg`, where there is not room for all of them between the logo and the dock of a signed-in visitor (the [social panel](05-social.md#social-panel)).
- A tab whose page does not exist yet can be `disabled`: text only, announced as a link that is off.
- The links are plain `<a>` (`@pbgo/ui` is framework-free): a page passes its router's link with `asChild`.

### On the hub

- The hub's layout mounts the bar once, in `SiteHeader` of `apps/web`, a client component that reads the address to know what is current. The pages do not draw it.
- What is current: the logo on the home, a tab on its own page, Games on a game's page on the hub (`/game/<slug>`), and nothing on the sign-in and the pages of an account.
- On the right, Sign in and Let's play or, once the browser has read a session, the dock of the visitor's friends.

## Search bar

Module: `@pbgo/ui/platform/search-bar`

The big search bar of a page: one glass bar, rounded by the step of a bar of 4rem (`rounded-3xl`) and not a pill, with the magnifier at its start (the button that sends the search), the field, a button that clears the text once there is one and, at its end, a filter that opens a panel (the category).

The other filters stand under it, centred on a line of their own, each in a place of its own with no background (`SearchBarGroup`): a stepper for a number, a slider for a limit, bars that fill for a level, or a button that opens a menu. It only draws the bar and the row. The page owns the text, the picks and what they find.

### Parts of the search bar

| Part | What it draws |
| --- | --- |
| `SearchBar` | The glass bar |
| `SearchBarField` | The text: the magnifier, the input and its clear button |
| `SearchBarSubmit` | The magnifier |
| `SearchBarInput` | The input |
| `SearchBarClear` | The button that empties the field |
| `SearchBarSegment` | An icon and what is picked, in a button that opens a panel or a menu: at the end of the bar, or `boxed` under it |
| `SearchBarFilters` | The row of the other filters, under the bar |
| `SearchBarGroup` | The place of one filter in the row |
| `SearchBarStepper` | A filter that is a number |
| `SearchBarIcon`, `SearchBarValue` | The icon that says what a filter is, and the value written beside it |

### Empty and filled

`SearchBarField` holds the magnifier (`SearchBarSubmit`), the input and, once there is a text, `SearchBarClear`, which the page uses to empty the field and put the focus back in it. The field and each button need an `aria-label`: the bar shows no label of its own. These forms do nothing when sent (`method=dialog`).

```specimen
search-bar-states
```

### With filters

The category is at the end of the bar and the other filters stand under it; the rules of each are below. The first bar starts empty, the second with a text and a pick of each kind. These filters filter nothing: they step, slide, fill, open and search.

```specimen
search-bar-filters
```

### The bar

- It is `h-16 rounded-3xl border glass`, with 8px of padding (12px on the side of the magnifier), so what is in it is `rounded-xl` (the bar's radius less the padding) and the magnifier's button `rounded-lg`.
- Its glass is a step lighter than the other containers: it keeps 85% of its own grey, `--card-bar`, where the navbar's glass keeps 92% of `--card`. Whatever is behind it shows through, blurred (see [Glass](../02-foundations.md#glass)).
- The magnifier is a plain icon that is the button that sends the search (`SearchBarSubmit`, a ghost button), with no round button at the other end. Enter in the field sends it too.

### The field

- The field is small and dim like a placeholder: what is typed has the colour of the placeholder (`text-muted-foreground`), in `text-base` on a touch screen, since a smaller text makes iOS zoom the page in on focus, and in `text-sm` where the pointer is fine.
- The placeholder is another matter, since iOS does not zoom for it: it is `text-sm` and, under 24rem of room, `text-xs`, so that the sentence fits a phone from 360 px wide.
- The home's field says what the bar is for, "Search games, tables & tournaments...". Only the games can be searched today (tables and tournaments have no list yet).
- The bar draws no ring or border around itself when the field has the focus: the caret says where the text goes.

### The category

At the end of the bar, a `SearchBarSegment`: an icon and what is picked, dimmed while nothing is (`idle`), in a button without a frame, 48px high and `rounded-xl`, at most three fifths of the bar's width. You wrap it in a `PopoverTrigger asChild`, which gives it `aria-expanded`, which paints it while the panel is open. No label is drawn (a screen reader hears the `label`). The segment is always drawn: with no category yet its panel says so.

Its panel is a [Popover](03-overlays.md#popover) that holds a [Combobox](01-controls.md#combobox) (`@pbgo/ui/platform/combobox`): a list with a search field above it.

- Each option has its icon at the start of its row (`categoryIcon` of `apps/web`, a placeholder until the catalog reads the icon, the color and the description that a `category` document of the platform's Sanity project has) and the check of a pick at the other end.
- The rows are rounded like those of a menu and 4px from each edge of the panel. The field has no ring: it has the focus, the caret says where the text goes.
- Case and accents are ignored. The arrow keys, Enter and a click pick or unpick. Any number can be picked, so the list stays open.
- The list has no scrollbar (it scrolls all the same). The field has the focus the moment the panel opens (`autoFocus`), except on a screen that is touched, where the keyboard would hide the list.
- The panel is `w-52` with no padding (`p-0`), its title and its Clear button 8px from the top, and it opens to the end of the bar.
- The panel is portaled, so like every portal it carries the `platform` class itself, and it sits at `z-50`, above the navbar's `z-40`.

### The picks

With nothing picked, the value of the segment is left out under 28rem of room (the width of the bar), so the field keeps its room on a phone.

With `picks`, a few things that each have a name and an icon (the categories), the segment draws them in place of its own icon and value, up to three. Each is a grey tag: `bg-foreground/15`, `rounded-lg`, 32px high, with its icon and, from 28rem of room, its name, and 8px from the next one, never overlapping it. The tags are lighter under the pointer and while the panel is open (`bg-foreground/25`); the segment behind them is never filled. After them comes how many more there are, `+2`.

| Room | Names | Tags | Count |
| --- | --- | --- | --- |
| Under 28rem | The icons alone | Two | The rest after two |
| From 28rem | Icon and name | Two | The rest after two |
| From 48rem | Icon and name | Three | The rest after three |

So a phone shows two icons and a count.

### The filters under the bar

The other filters are not in the bar: they stand under it, in `SearchBarFilters`, centred, on a line of their own that wraps when the room runs out. Name the row with an `aria-label`. Each filter is in a place of its own, a `SearchBarGroup` that is only a place: 56px high, a rem of room on each side, no background, no outline, no shadow. Only the age, which is a button that opens a menu, goes gray under the pointer.

| Filter | Control | Icon | Starts on | Options |
| --- | --- | --- | --- | --- |
| Players | `SearchBarStepper` | `UserMultipleIcon` | 4 (`DEFAULT_PLAYERS`) | 1 to 7, then 8+ |
| Duration | `Slider` with one thumb | `HourglassIcon` | `20′` (`DEFAULT_DURATION`) | Twelve steps: `5′` to `55′`, five minutes at a time, and `1h+`, the last, which is no limit |
| Complexity | `Meter` of five bars | `Brain02Icon` | Level 3 (`DEFAULT_COMPLEXITY`) | 1 to 5 |
| Age | `SearchBarSegment` that is `boxed` | `ChildIcon` | 8+ (`DEFAULT_AGE`) | 6+ to 18+: one choice, no "any" |

The icons are the ones the game's card and page already use, and `GridViewIcon` is the category's. The starting values are those of `@pbgo/catalog/filter`.

- Players: a minus button, the number with the icon that says what it is just after it, a plus button. No label, and the two buttons are outlined (`icon-xs`).
- Duration: the hourglass (`SearchBarIcon`) and the limit written after it (`SearchBarValue`: the minutes and their mark, `30′`, with no unit word since the hourglass says it, or `1h+` for no limit), then a `Slider` ([Slider](01-controls.md#slider), `@pbgo/ui/platform/slider`) with one thumb. Its track is `w-16`, with no dots, only the fill. Its handle is a white vertical capsule 8px wide and 20px high, which sticks out of the track by half its width, hence the `mx-1` around the slider.
- Complexity: the icon and a `Meter` ([Meter](01-controls.md#meter), `@pbgo/ui/platform/meter`) of five bars of the same height that fill up to the level pressed, with nothing written beside them. It is not `clearable`: there is always a level.
- Age: a `SearchBarSegment` that is `boxed`, which opens a [`DropdownMenu`](03-overlays.md#dropdown-menu) as wide as the button. It always has one age picked, and goes gray under the pointer and while its menu is open, like the category.

The filters are always at work, so nothing in the row is filled in or outlined to say what is picked: what a filter is set to is read from its control. The number of a stepper is plain text and never empty, and each press moves it one place along the options (`stepOption`), down to the first or up to the last, which the buttons stop at. The slider and the bars show what they are set to.

### In the hero

On the home the bar stands under the title and what the platform is (its figures and what is free), in the hero, 64px below them (`mt-16`) and covering none of it. From the `sm` breakpoint it is no wider than the title: `max-w-hero-bar`, `min(48rem, 8.6 × --text-display)`, so 8.6 times the size of the title, 48rem at most, a little under its longest line. On a tablet the bar is narrower than the title, and on a desktop it is 48rem. The filters under it wrap onto a second line when the room runs out.

It is glass (`glass`) over the page's black. Nothing is drawn behind it, no band and no border: the page is flat, and the bar is the one thing on it that is a little lighter.

```specimen
search-bar-hero
```

The bar used to be laid over the foot of the title, its top edge on the baseline of the last line, so that the letters stood on it and the tails of the script letters passed behind it. A token pulled it up, `-mt-title-overlap`, which is gone.

### The head of a page that lists something

Games (`/games`), Tables (`/tables`) and Tournaments (`/tournaments`) share one head, `ListPageHeader` (in `apps/web/src/components`): the title, centred at the top of the page in `page-title`, then the bar of what the page lists, 32px under it (`gap-8`), on the page's black.

- `page-title` (in `platform.css`) is Geist at 720 with a tracking of -0.048em, like the home's title, on one line with no fade and a line-height of 1.05.
- Its size, `--text-page-title`, is 8rem from a 850px window and 16vw less 0.5rem under it, 2.5rem at the least, so that Tournaments, the longest, fits a phone: it is 5.75em wide in that face, and takes 87% of what a 390px window leaves between its gutters and 92% of a 768px one.
- The bar is `PageSearch`, which says what it searches with its `label` and its `placeholder`: "Search games...", "Search tables...", "Search tournaments..." (the home's says "Search games, tables & tournaments..."). The magnifier, or Enter in the field, takes the visitor down to the results (`#results`); on a phone it also puts the keyboard away, which hid them.
- Each page has its own filters. `HeroSearch` (the games, and the home) puts the category in the bar and the four others under it. `ListSearch` is the bar and nothing else until their lists exist: the pages of Tables and Tournaments are `ComingSoonPage`s, the head and then an empty state where the list will be.
- Pricing and About have the same head with the title alone, since there is nothing in them to search. About has its own page, with a "What's new" section under what the site is.

```specimen
search-bar-list-head
```

### Scroll lock and the scrollbar's place

A modal overlay (a menu, a select, a dialog, a sheet) locks the scroll of the page. `react-remove-scroll` hides the scrollbar and adds a margin of its width to the body, which made whatever is fixed, the navbar, jump by that width.

The page keeps the place of its scrollbar instead, the way ui.shadcn.com does:

- `html.platform` has `scrollbar-gutter: stable`, which also keeps a page from changing width between a short one and a long one. While the lock is on, the browser leaves an empty, inactive track where the scrollbar was.
- The lock's margin is taken off the body (`html.platform body[data-scroll-locked]`, in `platform.css`).

`platform.test.ts` keeps both rules from coming undone.

## Title pieces

Module: `@pbgo/ui/platform/title-piece`

Some letters of the home's title are pieces of a game table, and so are the ornaments between its words: a die, a coin and the suits of a deck of cards for three of its letters o, and two cards. They are drawn in CSS and SVG (the utilities `title-piece` and `title-cards` of `platform.css`), in `em`, so that they follow the title and sit on its baseline like the letter they stand for.

They move now and then, not often (`PLAYFUL` of `@pbgo/ui/motion`, see [Playful motion](../02-foundations.md#playful-motion)), and a pointer that comes onto one plays it at once, if it is not playing already (hover the title below). They are on the page's black and nothing else: no table behind them.

The letter stays in the page (`sr-only`), so the title reads as it is written for a screen reader and a search engine.

### The pieces of the title

| Piece | Component | Stands for |
| --- | --- | --- |
| A die | `TitleDie` | The o of "board" |
| The suits of a deck of cards | `TitleSuits` | The o of "favorite" |
| A coin | `TitleCoin` | The first o, in "your" |
| Two dark blue playing cards | `TitleCards` | No letter: an ornament after "games" |

`TitlePiece` draws the first three around the letter they stand for (`kind` is `die`, `coin` or `suits`), and `TitleCards` the cards. The four suits of a deck are `Suit` (`@pbgo/ui/platform/suits`), shown under the title.

```specimen
title-pieces
```

### The title

The title of the home is two lines of the same size in sentence case, "Play your favorite" and "board games online" (`text-display`), set in `display-title` (`platform.css`):

| Property | Value |
| --- | --- |
| Face and weight | Geist at 720 (`--font-weight-strong`, `font-strong`) |
| Tracking | -0.048em (`--tracking-display`) |
| Line-height | 1.05 |
| Colour | The full colour of the text all over |
| Width | The two lines are 7.60em and 8.55em wide in that face, so the second sets the size |
| Size | `--text-display`: `5.8vw + 0.9rem` up to 7rem, 2rem at the least |

- 720 is the one weight the platform sets above 600, a person's name at the head of a profile having it too; everything else is 600. Geist is a variable font, so it can be a weight between the platform's 600 and the Black of the first title.
- The tracking is set on each line too: an `em` is inherited as a length, so a line bigger than the title would keep the title's.
- The line-height of 1.05 lets the descenders of the first line clear the ascenders of the second.
- The title no longer fades: it faded to 60% at the foot, through a mask.
- The size follows the window: the longer line takes 95% of a 390 px window, less its gutters, and 58% of a 1440 px one.
- The face is meant to be able to change. It is `display-title`, the size (it follows the widths of the face's lines) and, for a face that is not Geist, the import of its font, nowhere else.

### The die

- A cube 0.46em on a side, seen straight on and in perspective, so that its top is never seen and only its four sides take turns. Its pips are all of one size.
- Its four sides are a six on the front, a four, a one and a three: opposite sides add up to seven, as on a real die. The four and the one are only seen on the way, and the pips of the three run from the top right to the bottom left.
- `TitleDie` rolls it from the left to the right, 2 or 3 whole turns at random and the quarters it takes to land, so that it switches between a six and a three: each roll lands on the one it does not show.
- The roll is a script like the coin's, an expo snap that swells toward the viewer at its fastest moment (`PLAYFUL.die`).
- Each side is darkened as it turns away from the light, which comes from the left and the front.

### The suits

- `TitleSuits` is a wheel, like the reel of a slot machine, that scrolls up through the suits (`Suit`): a heart, a spade, a diamond and a club, a red one and a white one in turn. The black suits are drawn in the colour of the text, since a black one would be lost on the page's black.
- It turns 2 or 3 whole laps of the four suits at random (8 or 12 places, so that it always stops on the heart it started on), with a wind-up and then slower and slower, a little past its stop and back on a spring (`PLAYFUL.suit`). It takes 0.32 seconds a place on average and is two and a half times as fast, about eight places a second, a fifth of the way through.
- It is blurred up and down by its own speed (an SVG filter on its window, a Gaussian blur with a deviation along the vertical only, in ten steps) and stretched a little.
- Its window is taller than one suit, with a fade of 0.3em above it and under it (a `mask-image`), so that a suit comes in and goes out through the fade and is never cut.

### The coin

- `TitleCoin` tosses the coin from the top to the bottom, without rising, for 1 or 2 whole turns at random, so that it always ends on its profile. It dips as if gathering itself, swells toward the viewer at the top of the toss and lands with a squash that springs back (`PLAYFUL.coin`).
- Heads and tails are drawn and not iconic (`coin-drawings.ts`). On the heads, a laureate in profile facing right, with a wreath of laurel, strands of hair, an eye, an ear and the folds of a drapery. On the tails, a star with facets in a wreath of laurel. They are never a digit, which would make the title read "bo1ard" to a search engine.
- Both are engraved in lines of three weights (a thick outline, thinner details, fine lines; the leaves are almonds in a lighter gold) on a struck gold coin: an edge line, a bevel and a groove inside its rim, a darker line and the same outline a hair lower and lighter for the relief, and a glint across its upper left, as the coin of Teamfight Tactics has them.

### The cards

- Two dark blue playing cards, the backs of a deck (`--piece-navy`, an ivory edge, a border of their own and a lattice of fine lines), that overlap by more than half. `TitleCards` folds them up, brings them together and opens them again (`PLAYFUL.cards`).
- They stand after "games", with the space of a word between the last letter and them, and 0.24em between them and "online".
- They are left out under 40rem, where the line is as wide as the window lets it be.
- They stand for no letter, so they are `aria-hidden`.
- They were white, and half behind the "s" of "games", for a while.

### When they play

| Piece | First play, after the page is shown | Then |
| --- | --- | --- |
| `TitleDie` | 4 seconds | Every 15 seconds |
| `TitleCards` | 8 seconds | Every 15 seconds |
| `TitleSuits` | 11 seconds | Every 15 seconds |
| `TitleCoin` | 12.5 to 15.5 seconds | It rests 14 to 24 seconds between two spins |

- The die, the coin and the wheel of suits are scripts (`TitleDie`, `TitleCoin` and `TitleSuits`: a keyframe cannot be left to chance). They use transforms only, but for the filter of the wheel.
- A visitor who asks for less motion gets them all still: the die on its six, the suit a heart, the coin on its profile and the cards in their fan.

### Sizes and place

A piece is sized in `em` and set on the baseline, like the letter it replaces: an o is 0.6em wide and a little over half an em high. A letter has its tracking after it and a box has none, so a piece would be too near the letter before it: its left margin is the tracking it lacks (0.048em), which puts it where the glyph of an o would start, and the word after it keeps its place (-0.02em).

| Piece | Box | Margin before and after | Baseline |
| --- | --- | --- | --- |
| Die | 0.5em square, the cube being 0.46em | 0.075em and 0.04em | On it |
| Suits | 0.62em by 0.58em | 0.048em and -0.02em | 0.005em under it |
| Coin | 0.6em square | 0.043em and -0.015em | 0.03em under it |
| Cards | 0.72em by 0.74em | 0.088em and 0.24em | On it |

The die has more room than the others, since a hard edge next to a round letter wants more air than an o would give it. The coin sits lower and a little further to the left than the die and the suits: a coin is round, and the o it stands for has an overshoot.

### What was removed

The hero's backdrop is the page's black, flat, and nothing else, as the first screen of every page of the hub is. These were taken out:

- A faint gradient from `card` to `background` (a little lighter at the top: `bg-linear-to-b from-card to-background`) with, over it, a walnut table in perspective under a lamp (`Tabletop`, in CSS, with five perspectives to choose from and a palette tinted toward brown to go with it). Both went in PLT-16: the gradient, the table, its utility, its `--wood-*` colours and the tint of the neutral scale are gone, and `git log -S Tabletop` finds the table.
- A grid of thin lines (`pattern-grid`), a faint backdrop of game pieces (`BoardPattern`) and a word of the title that changed between four display faces every six seconds (`FaceCycle`), in earlier heroes. All three were removed on 2026-10-30, since nothing used them (`git log -S FaceCycle` finds them).

## Stats

Module: `@pbgo/ui/platform/stats`

What the home says about the platform under its title, in two lines. `Stats` is the figures: how many players are connected, how many accounts are registered, how many games there are. `Perks` is what costs the visitor nothing, the way a shop says free delivery.

Both are quiet and say their figures as text, so a screen reader reads 128 players online and not a picture of it. They draw what they are given and know where it comes from: the page gives the figures and the words.

### Under a title

The figures are a `dl`: each a term (what it counts) and its definition (the number), shown the other way round, the number first. The perks are a `ul` with a tick before each. On the home they stand under the title, 32px and 24px below it, and the search bar 64px under them.

```specimen
stats-under-a-title
```

### The figures

- Each figure is in a pill: `rounded-xl`, filled with the colour of the text at 10%, no outline and no shadow, so that the numbers can roll up and down in it one day.
- A pill has a number (`text-sm`, like what it counts, but in the colour of the text, and tabular: it was `text-base`, a size above) followed on the same line by what it counts (`text-sm`, the colour of the text at 80%).
- The figure of what is happening now, the players online, is `live`: it has a green dot before its number, the green of a friend who is online (`text-presence-online`), a circle drawn in SVG.

### The perks

A few words in a row that wraps, in the colour of the text at 70%: white a little faded, and not a grey. On the home they are `Free to play` and `No sign-up needed`.

### Where the figures come from

- The games are the games of the catalog, counted by the page.
- The players connected now and the members are counted in Supabase: `online_player_count()`, kept a minute, and `member_count()`, kept ten minutes (migration `0003_hub_figures.sql`). Each is left out when it cannot be counted, never made up (`docs/accounts.md`).
