# Surfaces and data

The containers and what they hold: cards, plans, games, credits, the tables of a game and its leaderboard, the blocks of a hub page, avatars, alerts, progress, separators, lists, empty states and tables.

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

## Game head

`GameHead` (`apps/web/src/components/game-head.tsx`) is the top of a game's page on the hub, the first thing a visitor sees. On the left, in one column, the name, with a "Coming soon" badge beside it (outline, as the card of a game to come has it) when the game is not live; under it the figures of the game on one line, each with a small icon: the players, how long, how complex ("Complexity 2.4/5", the weight BoardGameGeek gives it: the figure is not drawn for a game whose Studio row has none, which is most of them for now) and from what age; under them the description, then the game's categories as chips (`Badge`, secondary, the icon of the category before its name, `categoryIcon`, the one of the category filter), each a link to the games' list showing that category (`/games?category=<name>`); then, under a hairline that takes the whole width of the column, the credits, one line each with the lines 12px apart, the last being the year the game came out ("Released 2024": the Studio keeps a day but takes the first of the month or of the year when it knows less, so only the year is said), with their buttons under their lines; last, the big buttons. On the right, the picture of the game's card drawn larger, level with the name. Every one of these is drawn only when the Studio has it, and nothing is written in place of one that is missing.

The buttons of the credits are outline buttons of the default size, in this order, each drawn only when the Studio has what it needs (the row is not drawn when none is):

- **Buy the game**, a link with a shopping bag and an arrow up-right (it leaves the page, in a new tab), to the page of a shop that sells the game: the `buyUrl` of the game in the Studio (`shop` of the game's page). A game that has none has no such link: no search is made up in its place and no shop is announced before there is one.
- **BoardGameGeek**, a small square button with BoardGameGeek's icon and no text (`BggButton`, `apps/web/src/components/bgg-button.tsx`), which opens the game's page there, `https://boardgamegeek.com/boardgame/<id>`, from the game's BGG id (`bggUrl` of `@pbgo/catalog`), in a new tab. A game that has no id has none, and no search is made up in its place. The icon is BoardGameGeek's own, found on its website by the server and served from this site (`/api/catalog/<slug>/bgg`, `bggIconUrl`, `docs/catalog.md`), so that a visitor's browser never asks BoardGameGeek for anything: a plain `<img>` of 20px, which is asked for once the page is interactive (like a publisher's icon in the credits, so that a failure is always heard); when it cannot be had the button says "BGG". Its name for a screen reader and for the pointer is "BoardGameGeek".

The big buttons are what the page is for: one row at the end of the column, all 48px high (`xl` and `icon-xl`, [Sizes](01-controls.md#sizes) of the button), 12px apart:

- **Find a game**, the main button (the white fill of the page), puts the visitor in a queue and becomes a counter with a cross while it lasts, of the same size so that nothing moves (`FindGameButton`, `QueueButton`: see [Queue](#queue)).
- **Create a game**, in outline, with a plus, leads to the space that opens a lobby, under the head (`CREATE_ANCHOR` of `game-play.tsx`, the name that `GamePlay` gives the space on the page, since a name is one per page; the target stops under the fixed navbar, `scroll-mt-navbar`). A game that is not live has both of these disabled, under the "Coming soon" badge: there is nothing to play yet.
- **Rules**, a picto at the right of the two: an outline button as tall as they are, with a book and no text, named "Rules" for a screen reader and for the pointer. The rules are the rulebooks of the Studio (`RulesButton`, `apps/web/src/components/rules-button.tsx`): with one language the picto is the link, which opens the PDF in a new tab, and with several a press opens a menu under it with a row for each, the visitor's language first, a chip with the language's code (EN, FR, ES, DE; hidden from screen readers, the link carries the `lang`), the title in that language ("Règles du jeu - Flip 7") and an arrow up-right. A game to come keeps it. A game with no rulebook has no such picto.

On a narrow screen the head is one column, so the picture comes after the buttons, and the buttons wrap: the rules picto goes under the other two when the three do not fit on a line.

### A live game

```specimen
game-head-a-live-game
```

### A game to come, and one with little data

The first has the "Coming soon" badge, both buttons disabled and one rulebook, so its rules are a link and not a menu. The second is a game the Studio knows little of: only its name and its players.

```specimen
game-head-a-game-to-come-and-one-with-little
```

## Queue

Module: `@pbgo/ui/platform/queue` (the counter and the reading of what is kept: `@pbgo/ui/queue`)

A visitor who presses "Find a game" is looking for a game: they are in the queue of that game, and the same wait is shown in three places. Nothing matches players yet, so no table is found for them and the counter runs until they stop it. The day the platform matches players (the tables of PLT-13), the two functions of `apps/web/src/lib/matchmaking.ts` that start and stop a search are what ask for it, and the blocks do not change.

- **The button** (`QueueButton`): "Find a game", an `xl` button (48px high) with no icon. A press starts the search and the button becomes, in the same place and at the same width (so that nothing next to it moves) and on the same fill, a counter of the time waited, a turning ring before it, with a cross that stops the search. The counter is written as minutes and seconds, with hours once there are some (`queueTime`: "0:12", "12:05", "1:02:03"), in figures of one width so that the digits do not shift. The keyboard follows the button: after a press the cross has the focus, and after the cross the button has it back (not when the search was stopped from elsewhere). A disabled button is the one of a game that cannot be played yet.
- **The card** (`QueueCard`), at the top of the social panel, over the tabs, whatever tab is open: the ring, "Looking for a game", the name of the game under it, the counter and a ghost cross (`queue` of `SocialPanel`).
- **The pill** (`QueuePill`), in the bar of the dock while the panel is closed, before the games the friends are in: the ring, the counter and the cross, with the game's name for the pointer. It folds away with those games as the dock opens, and the card takes over. In a window narrower than 1024px it is not drawn: the bar grows to the left, over the navbar's tabs, and the button of the page and the card show the wait.
- **One queue for the hub**: it is kept in `apps/web/src/lib/matchmaking.ts` for every page, and in the browser's session storage, so that a reload does not forget it (`parseQueue` reads it back and drops what is older than two hours, or not a queue at all). A visitor looks for one game at a time: pressing the button of another game replaces the search, and the button of the first is then "Find a game" again. The server renders nobody in a queue, so a page is first drawn idle and the counter appears once the browser has read it. A visitor who is not signed in has the button and the counter and no social panel.
- **For a screen reader**, each of the three is a group called "Searching for a game" (the card and the pill add the game), the counter is a `timer`, which it reads when asked and never announces each second, and the cross is "Stop searching".

```specimen
queue-button-searching-and-disabled
```

The button, idle (press it), searching and disabled. The ones here keep a queue of their own.

```specimen
queue-card-and-pill
```

The card in a panel and the pill in a bar, a moment into the wait.

## Table card

Module: `@pbgo/ui/platform/table-card`

`TableCard` is one table of a game as the hub lists it: who sits at it, whether it waits for players or is being played, how old it is, and the way in. `TableList` lays the cards of a game out, or says that there is none to list. The home's "Tables in progress" and the page of the tables will draw it, in a grid, for the tables of every game; the page of a game lists its own as [rows](#table-entry), beside the [lobby panel](#lobby-panel).

They draw what they are given and decide nothing. Which tables there are, in which order and what a visitor may do at each one is the page's: `getTables` (`apps/web/src/lib/game-activity.ts`) reads them, `tableCardProps` (`game-activity-props.ts`) words them, and `@pbgo/ui/tables` holds the rules, tested without React (`seatsOf`, `namesOf`, `tableAction`, `ageOf`). Nothing lists the tables of a game yet (a table is reached by its link until the platform schema of PLT-13 has them), so a real page draws the empty state below. The tables in these specimens are made up, in the shape that data will have.

### Waiting and playing

A card is, from the top:

- whether the table waits for players (an outlined [`Badge`](01-controls.md#badge), a clock) or is being played (a `secondary` one, a play), and how old it is: when it was opened ("Opened 4 min ago") or how long it has been played ("Playing for 18 min");
- its name, the host's ("Marly's table"), and under it what is worth knowing before sitting down: "Fast turns" or "Async" (the usual pace is not said), then the expansions it is played with;
- its seats, and how many are taken ("3 / 5");
- who is at it, in words (up to three names, then "and 2 others"), and the button that leads in.

The card is a surface, `rounded-4xl` with `shadow-surface` and a hairline, like a [game card](#game-card), and a card that leads somewhere rises under the pointer the way a game card does ([`shadow-float`](../02-foundations.md#shadows-and-rings), the `secondary` fill). Its button is the one link, stretched over the whole card, so that a click anywhere is a click on it and no button sits inside a link. `size="sm"` tightens it (`p-4`, a smaller gap) for a column that holds several. The tables a page lists are the public ones: a private table is reached by its link and never listed.

```specimen
table-card-waiting-and-playing
```

### What a visitor may do

`tableAction` decides it from the state of the table and the seats left:

| Table | Button |
| --- | --- |
| Waits, a seat is free | Join |
| Waits, no seat is free | Full, disabled: it is about to start |
| Is played | none, the card is only read: nobody looks on at a game for now |

A button leads to the table's page, `/<slug>/game/<code>`: a plain link, the table being in the game's own site, another root layout, which a visitor loads whole.
```specimen
table-card-what-a-visitor-may-do
```

### Of several games

On a page that lists the tables of several games, a card says which game it is of above its name: the game's icon, when it has one, and its name (`game`). The page of a game leaves it out.

```specimen
table-card-of-several-games
```

### The seats

`TableSeats` draws a picture for each person at the table, their initials when they have none, and a dashed place for each seat nobody has taken, so that how many seats there are and how many are left read at a glance. Only the picture of a person is a circle, and a seat is the place of one. The name of each seat is for screen readers; the pointer finds a player's card on their picture ([Hover card](03-overlays.md#hover-card)), and the card says the names in words under the seats. The seats wrap onto a second line when they do not fit, since a table can have ten.

`seatsOf` makes them from the people at the table and the number of seats it has: each person in the seat they took, one whose seat is not the table's in the first seat left, and "Deleted player" for one who has deleted their account. A name written `Alex#0042` is drawn `Alex` (`nicknameOf`): the tag tells two players of one name apart on their profile.

```specimen
table-card-the-seats
```

### The list, and when it is empty

`TableList` is a list of cards in one column, which a page spreads over as many columns as it has room for by giving the list its own (`md:grid-cols-2`, where a row of cards is as tall as its tallest and each card's way in sits at its bottom). With none to list it is an empty state, compact (`p-6`), that says so, fills the height it is given and, when it is given the address where a table is opened (`createHref`), has a button that leads there. A page that has a lobby panel beside the list gives it the panel's address: both lead to the same place, and the button is for the visitor whose eyes went to the empty state first. The empty state's words are the page's to change (`emptyTitle`, `emptyDescription`; the page says what the home and the page of the tables say, `COMING_SOON.tables`).

```specimen
table-card-the-list
```

## Table entry

Module: `@pbgo/ui/platform/table-entry`

A table as one row of a list, which is how a game's page lists its open tables (`OpenTables`, `apps/web/src/components/open-tables.tsx`), in two lines. On the first, who opened it ("Hosted by Marly"), what to know before sitting down ("Fast turns · First expansion") and how old it is ("Opened 4 min ago", "Full · Opened 8 min ago" for a table with no seat left). On the second, a circle for each seat of the table, all of them and none over another, so that the room that is left is seen at once, with the nickname of each person under their picture and a crown on the one who opened the table. There is no badge that says it waits: a game's page lists only the tables that wait for players. Like the [table card](#table-card) it draws what it is given and decides nothing, and it shares its rules (`tableEntryProps` of `game-activity-props.ts`, then `@pbgo/ui/tables`: `hostOf`, `seatCount`, `tableAction`).

A seat nobody has taken is a dashed circle with a plus in it, and the plus does what the seat is for ([open seat](#open-seat)): for a visitor who is not at the table it is a link that joins it, labelled "Join"; at the table the visitor sits at (`mine`) it opens a menu to invite a friend or copy the link, labelled "Invite". The pointer finds a player's card on their picture ([Hover card](03-overlays.md#hover-card): name, rank, record), and a press on the row anywhere but on a plus shows the table's details, with its settings, in the [lobby panel](#lobby-panel) beside the list. The first line is a `button` (`aria-pressed`, `aria-controls` the panel) that says the row once to a screen reader (who hosts it, how many seats are taken, what to know, its age); the seats under it are a list of their own, read as they are. The picked row has the `muted` fill.

### The rows

Five rows, the second one picked, then four of them in a narrow column. A row follows the width of its list, not the window's (`TableEntries` is the container it measures), and its circles wrap onto a second line when they do not fit, a table having up to ten seats. The fourth row is the table the visitor sits at: its free seat invites where the others join.

```specimen
table-entry-the-rows
```

## Open seat

Module: `@pbgo/ui/platform/open-seat`

A seat that nobody has taken, as a dashed circle with a plus in it, and the plus does something. For a visitor who is not at the table it joins it (`join`): a link to the table's page, the table being in the game's own site, another root layout that a visitor loads whole. For one who is at it it opens a small menu to bring someone (`invite`): "Invite a friend", which a page that has friends gives a way to do (`onInvite`) and which is disabled without, there being no friend yet (PLT-23), and "Copy link", which copies the table's address and says so for a moment ("Link copied") before the menu closes. With neither it is the dashed place alone, which only says that there is room. The circle is a picture's size (`size-8`) unless it is given another (`size-10` in a row), and a little more there under the pointer. A table has several of these and they all do the same, so only one of them is a stop for the keyboard (`tabbable`).

```specimen
open-seat-join-and-invite
```

## Lobby panel

Module: `@pbgo/ui/platform/lobby-panel`

The tall space on the right of a game's page, beside the open tables, where a visitor plays: the lobby they are in, or, when they are in none, the space to open one, which gives way to the details of the table that they pick in the list. A lobby is a table that waits for players. It is a [`Card`](#card) that is not shorter than 32rem from `lg`, with a roomier `--card-spacing`, and whose content takes the height that is left, so that its footer, the main button and the one beside it, stays at the bottom whether the panel holds two lines or twelve rows; it is built from the parts of a card (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) and from `LobbySeats`, `LobbySettings` and `LobbySetting`, with `LobbyMainButton` and `LobbySideButton` for the two buttons of its footer (the main one as wide as the room allows, the secondary one a square of the same height); `LobbyDetail` is a table drawn in it. What it says, what its settings are and where its button leads are the page's: `GameLobby` (`apps/web/src/components/game-lobby.tsx`).

A table is opened in the game's own site (`/<slug>`, another root layout, which a visitor loads whole), so the space says what it is, "Create a game", and leads there with its one button, "Open a table". Its settings are at the bottom, over the way in ([below](#the-settings)): the speed of the game, who may find the table and the expansions of the game. Every table counts for the leaderboard and none can be looked on at for now, so neither is a setting. What a visitor sets here stays in the page, a lobby having no place to keep it yet (the tables of PLT-13).

### Open a lobby

Two panels: the one of a game that has no expansion, and the one of a game that has some (Courtisans has one in the Studio). The settings are at the bottom, over the way in, under a hairline: the speed of the game, who may find the table and the expansions as pictures. The space above them is empty: the panel has nothing else to say. A single setting that is one word and one control is still a row, `LobbySetting`: its name on the left, with a quiet line under it when it needs one, and its control on the right; a control gives itself a name (`aria-label`), since the label of a row is not a `<label>`.

```specimen
lobby-panel-open-a-lobby
```

### Your lobby

A visitor who sits at a table finds it here instead (`getViewerTable`: public or private, waiting for players or being played), drawn as any table's [details](#a-tables-details) are, under the name "Your lobby" or "Your game" and with a main button at the bottom: for a lobby that waits, "Start game" for the one who opened it (`start`, the page's `StartGameButton`, which calls the game's own route and then leads into the table's page; it cannot be pressed until the game has its minimum of players, `minPlayers`) and, for anybody else, a button that cannot be pressed and says how many have joined of those expected ("Waiting to start · 3/5"); for a game in play, "Rejoin your game". A lobby that waits, whoever opened it, has beside the main button a secondary one, an icon alone, that leaves it (`leave`, the page's `LeaveLobbyButton`, which calls the game's own route; the page then asks again where the visitor sits); a game in play has none, that route taking a visitor out of a lobby only. The settings are the visitor's to set when they opened the lobby (`viewerIsHost`) and are only read otherwise. The plus of its free seats opens the menu of an [open seat](#open-seat): "Invite a friend", disabled until there are friends to invite, and "Copy link". Four panels: a lobby the visitor opened, one they have just opened and sit alone at (the game needs two players, so "Start game" cannot be pressed yet), one a friend opened, and a game in play.

```specimen
lobby-panel-your-lobby
```

### A table's details

`LobbyDetail` is what the panel shows for one table: whether it waits or is played and how old it is, its name ("Max's table"), the table's code, its people (`LobbySeats`: the picture and the name of each, "Host" on the one who opened it, their rank under the name as a quiet word (`RankBadge` with `quiet`; nothing for a player who has none), a dashed place that says "Waiting for a player" for each seat nobody has taken, whose plus is an [open seat](#open-seat): it joins the table, or, in the visitor's own lobby, opens the menu that invites a friend or copies the link; one under another in a narrow panel, in two columns from 28rem, the panel being the container), its settings at the bottom (`LobbySettings`, only read here: how fast, then the expansions it is played with, as pictures with the outline), and the main button, Join or a disabled "Full", with, in the visitor's own lobby, the secondary button that leaves it ([above](#your-lobby)). When the page gives it `onClose` a close button sits at the top right: it puts the table down and the panel is the space to open a lobby again.

The names are written here, and the pictures of the list only say who is there: this is where a visitor learns whom they would play with. `tableDetailProps` (`game-activity-props.ts`) makes it from a table.

```specimen
lobby-panel-a-tables-details
```

### The settings

`LobbySettings` (`@pbgo/ui/platform/lobby-settings`, a client component) is how fast a table is played, who may find it and what it is played with, in groups with a small title and in that order, at the bottom of the panel:

- **Speed**: the pace of the game, `PACES` of `@pbgo/ui/tables` (Fast, Normal, No timer, Async), a group of chips that picks one when it is set and a word when it is read.
- **Who can find it**: Public or Private, only for a lobby that is opened or set; the tables of the list are all public.
- **Expansions**: the game's own, each a picture in a 3 × 2 frame on the `muted` fill with its name under it (wrapped, never cut, since an expansion's name often starts with its game's and says nothing before its end; the frames of a row are as tall as the tallest): its cover fills the frame, the front of its box is drawn whole in it when it has no cover (a box is not made for that shape), and its initials stand in when it has neither. When the lobby is the visitor's to set (`editable`) each is a button (`aria-pressed`) that chooses it or leaves it, and a 2px outline in the colour of the text says it is chosen (a hover shows a faint one); a screen reader hears the state. When a visitor only reads a table, the group is "Played with" and holds the chosen ones alone, outlined, and a table that is played with none has no group. A game that has no expansion has no group at all: the page reads them with `getExpansions`, which asks the catalog for the `expansion` documents of the platform's Sanity project that name the game as their base game, by name, with their cover and the front of their box, so a game has some as soon as they are created and published in the Studio; the specimens below draw imagined ones (the third has a box and no cover, the fourth no picture).

The columns follow the panel (`@container`): two expansions across in a narrow panel, three from 28rem. Nothing is kept: `onChange` gives what was set to a page that has somewhere to put it. Every table counts for the leaderboard and none can be looked on at for now, so "ranked" and "spectators" are not settings; they come back here the day a game needs them.

```specimen
lobby-settings-set-and-read
```

### Beside the open tables

`GamePlay` (`apps/web/src/components/game-play.tsx`) is the first block under the head of a game's page: the open tables on the left, seven twelfths of the width from `lg`, as the rows of a list ([table entry](#table-entry)), and the panel on the right, five twelfths, wide enough for the pictures of the expansions. A press on a row picks it and the panel shows its details; a press on it again, the close button or Escape puts it down, and the panel is the space to open a lobby, or the lobby the visitor is in. The two cards start at the same height and have the same, `lg:h-176`: it does not depend on what they hold, so that picking a row moves nothing below, and the list scrolls inside it. A header says what the list holds ("4 waiting"). With no table to list it is an empty state with a button that opens one, the panel being the same.

On a narrow screen the panel comes first, since opening a table is what most visitors came to do, then the list; a press on a row scrolls the panel into view, and the way in is in the panel, since a row that narrow has no room for it. A game that is not live has the panel alone, half transparent and with no way in, and no tables. Below, drawn at the width of a page and scaled to this column: a game with tables and a panel with settings, a visitor in a lobby of an empty game, and a game to come.

```specimen
lobby-panel-beside-the-open-tables
```

## Rank badge

Module: `@pbgo/ui/platform/rank-badge` (the type and the way a rank is written: `@pbgo/ui/ranks`)

`RankBadge` is a player's rank in a game, a small badge: the name of the tier and, but for Legend, its division ("Gold II"). The platform shows a rank where it would show a rating: a player's rating, an Elo, is hidden, never drawn and never sent to the browser. The server derives the rank from it and from the player's position among the game's players, and the browser only ever gets a tier and a division (`Rank`). No type of the hub's page has a rating.

- **Nine tiers**, from the lowest to the highest: Apprentice, Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Legend (`TIERS`). Each tier but Legend has three divisions, I, II and III, I the lowest and III the highest inside the tier; Legend has none. `rankLabel` writes them: "Gold II", "Legend".
- It is plain on purpose: the outline badge (the one that is not a status: `success` and `destructive` are the results of games, `secondary` is a label such as "Host"), with no colour, no icon and no word besides the tier's own, until the owner asks for them.
- A screen reader hears "Rank: Gold II", unless something around the badge already says it is a rank (the header of the leaderboard's column, the label of the card or of the stat tile: `labelled`). `quiet` draws it as a word under a name (the seats of a [lobby panel](#lobby-panel): no border, no padding, the muted colour), and `className` sizes it where it is a figure (the visitor's [stat tile](#stat-tile): `h-9 rounded-lg px-3 text-xl`).
- It is what the [leaderboard](#leaderboard) has in its column of ranks, what the seats of a lobby say under a name, what a player's [card](03-overlays.md#hover-card) says, and the figure of the visitor's rank in their stats.

```specimen
rank-badge-the-tiers
```

## Stat tile

Module: `@pbgo/ui/platform/stat-tile`

One figure and what it counts: the label, quiet, then the figure, big, then a word more when there is one. It is no card: no outline and no fill, the figure (`text-5xl`) and the room around it are what make it stand out, and the figures of a row stand in a line across what holds them. The tiles of a row go in a list of terms (`<dl>`: each is a term and its values, so that a screen reader reads "Games played: 24"). A tile draws what it is given and writes no figure itself: the page words them (`statFigures` of `game-activity-props.ts`, with `winRate` of `@pbgo/ui/results`).

### The figures

The four of a game's page: how many games a visitor played with the time they spent at them under it ("38 h played": minutes under an hour, hours after, `timePlayed` of `@pbgo/ui/results`), their win rate with how many wins that is, their rank, drawn as a [rank badge](#rank-badge) at the size of a figure, and their position on the board, out of how many players ("27th of 143 players"; "Not on the board yet" for a visitor with no position). A figure that is not known, a rank before any ranked game, is a dash. A rating is never one of the figures. The row follows the width of its container: four figures in a line from 36rem, two by two under it.

```specimen
stat-tile-the-figures
```

## Leaderboard

Module: `@pbgo/ui/platform/leaderboard`

`Leaderboard` is the best players of a game, as its page lists them: their place, who they are, their rank, the games they won and the games they played. The signed-in visitor finds themselves on it. Like the table card it draws what it is given: the order is that of a rating (an Elo) that stays on the server: no row carries it, each says a rank. The rows come from `getStandings` (`apps/web/src/lib/game-activity.ts`: the `ratings` of PLT-13 as ranks, with the nickname and the picture of the `profiles` row), `leaderboardRow` (`game-activity-props.ts`) picks what a row shows of a standing, and `boardOf` (`@pbgo/ui/leaderboard`, tested without React) decides which rows are drawn. Nobody is ranked yet, so a real page draws the empty state below; the players in these specimens are made up.

### The top, and the visitor in it

A table, a real one with a caption for screen readers, of the first `size` players (all of the rows it is given by default; a game's page gives it a hundred): place, picture and nickname, rank (a [rank badge](#rank-badge)), wins and games played. There is no column of points. The top three have their place in Geist semibold and their name in the full colour of the text; the others are quiet (`muted-foreground`). The platform has no medal colour to give, and its only hue is a game's art. A nickname too long for its column is cut with an ellipsis.

The visitor's own row has the `muted` fill, a "You" badge after the name and `aria-current`. When they are in the top it is the row in the top, and nothing is added after it.

```specimen
leaderboard-the-top
```

### The visitor outside the top

A visitor who is signed in and has a rank but is not in the top has their row after it, behind a gap (three dots) that says other players stand between; the first player after the top has no gap. A player is on the board after five ranked games (`LEADERBOARD_MIN_GAMES`): until then their place is a dash, and their row, which they can still see, follows the top behind the gap. The first board below shows the visitor 27th, the second a visitor who is not ranked yet.

```specimen
leaderboard-the-visitor-outside-the-top
```

### A long board

A board is as tall as its rows, up to the height its page gives it (`max-h-176` on a game's page, the height of the open tables above it): past that it scrolls inside its card, with the wheel, a swipe or the keyboard (the scrolling part is a focusable region, named by the board's label). Its header stays at the top, and the visitor's own row stays in view wherever they stand on the board: it keeps its place in the list, sticks under the header when the board is scrolled past it, and to the bottom when it is scrolled short of it. A visitor who is not among the rows has their row at the end, behind the gap, and it sticks to the bottom until the end of the board comes. The rows draw their borders themselves (`border-separate`), since a border that the table collapses would not stay with a `sticky` cell. The first board below has forty players and the visitor 27th among them, the second the visitor outside them.

```specimen
leaderboard-scrolling
```

### In a narrow column, and empty

The board is a container (`@container`). Under 28rem wide, as in a third of a page, the column of the games played is left out so that the name keeps its room. With nobody ranked it is an empty state, with a trophy, that says what the board will hold; the page words it.

```specimen
leaderboard-narrow-and-empty
```

### Your stats

On the left of the board, a visitor's own figures in the game (`GameStats`, `apps/web/src/components/game-stats.tsx`): the four [stat tiles](#stat-tile), then their achievements, each an [achievement tile](#achievement-tile). A visitor who is not signed in has nothing to show, so it invites them to sign in (`getPlayerStats` returns null for nobody), and one who is signed in and has played nothing has the figures at their start, dashes where there is no rating yet, and no achievement. Achievements are the page's guess: PLT-13's schema has no table for them, so they stay empty until there is one to read.

```specimen
game-stats-signed-in-and-out
```

### Your latest games

Under their stats, on the left, their ten latest games in the game (`GameHistory`, `apps/web/src/components/game-history.tsx`). A row has, on the left, the game's name with the expansions it was played with after it ("Courtisans + First expansion") and the pictures of the others at the table, with no names (the group is labelled for a screen reader, and the pointer says each name); on the right, how long ago it was ("3 d ago"), what it scored ("42 pts") and the experience it gave ("+120 XP"), and at the far end how it ended, as a badge in a dark tint: a win in green (`success`), a loss in red (`destructive`), a draw or a game that was left outlined. A rating is never shown, nor what a game did to it. Their place among the players ("1st of 4") is for a screen reader; a card narrower than 24rem leaves out the score, and one narrower than 28rem the experience. The first three are there at once, the third fading out at the bottom (a mask on the list, as in the home's previews) under a "Show more" button that is pulled up over the fade; it unrolls the other games, the fade gives way, and the button, now "Show less", comes down under the last one. It is a [collapsible](01-controls.md#collapsible): what is not shown is not in the page until the button opens it. A visitor with no game has no such block, and one with three or fewer has all of them, with no fade and no button.

```specimen
game-history-closed-and-open
```

### On a game's page

The second row of a game's page, drawn at the width of a page: the stats on the left, two thirds of it, with the latest games under them (`GameStats` holds `GameHistory` as its children), and the board on the right, the first hundred (`LEADERBOARD_SIZE`), which scroll inside a card no taller than the open tables above it, and the visitor's own row, which stays in view. Under `lg` the two stack. A game to come has neither. Below, a visitor who is signed in and one who is not, with the empty board that every game has for now.

```specimen
leaderboard-on-a-games-page
```

## Achievement tile

Module: `@pbgo/ui/platform/achievement-tile`

One thing a visitor earned in a game, as a badge: an emblem drawn in SVG, its name, and the day they earned it. It has no card, no outline and no fill around it, and the emblem (6rem, `AchievementBadge`) is what stands out. The badges of a game's stats go in a grid that follows its container, three across, then four, then six, under the title of the group, which has a small pill ([`Badge`](01-controls.md#badge)) that counts them. A game gives no art for its achievements yet, so the emblem is drawn from the achievement's id (`badgeOf`, `packages/ui/src/achievements.ts`, tested without React): one of five shapes (a hexagon, a shield, a seal, a diamond, an octagon) in the `muted` fill with a hairline and a dotted ring inside, and one of six marks in the middle (an award, a trophy, a star, a crown, a target, a flash), the same ones every time and not the same for every achievement. The platform has no colour to give a medal, and its only hue is a game's art. A name too long for the room is cut with an ellipsis and the pointer says it whole (`title`), with what it was for, which a screen reader reads as well. A visitor who has earned none has the pill at 0 and is told what the place is for, and no badge is drawn. PLT-13's schema has no table for achievements, so a real page has none to list yet; the ones below are made up.

```specimen
achievement-tile-the-badges
```

## Scroll row

Module: `@pbgo/ui/platform/scroll-row`

A titled row of cards that does not wrap and scrolls sideways, for a list of which the page shows the first and lets the visitor walk along: the games similar to a game, on its page under "Similar games" (nine at most). The cards keep one width (16rem, 18rem from `sm`), so that the next one is always half in view and says that there is more, and they snap to the start of the row as it scrolls. The row runs out to the edges of the page, past its gutters, and its first card starts where the page does. It scrolls with the pointer, a trackpad, a swipe or the keyboard (a card is a link, and focus brings it into view); it draws no scrollbar. Two outlined icon buttons at the end of the title move it by most of its width, which a mouse with no sideways wheel needs: they are only there when the row holds more than it shows, and each is disabled at its end. The move is instant when less motion is asked for. What the row holds is the page's: the title and the cards.

```specimen
scroll-row-similar-games
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
