# Social

The friends of a signed-in visitor, the way the Riot Client shows them, on the navbar of every page of the hub. It is made of five parts:

- [`FriendsPanel`](#friends-panel), the friends as a panel for a page, with the dot of their presence;
- [`FriendsBar`](#friends-bar), a pill for each game some of them are in;
- [`SocialDock`](#one-container-two-states), the container that is the bar of the games and a side panel in one;
- [`SocialPanel`](#the-three-tabs-with-friends-and-with-none), the body of the dock, with the friends, the conversations and the way to add a friend;
- [`ChatWindow`](#the-chat-window), the conversation with a friend.

All of them are drawn from the friends, conversations and requests they are given and decide nothing about them: where those come from (PLT-23) and what a button does are the page's, and a button whose handler is missing is not drawn. The hub mounts them once, in the navbar (`SiteSocial` of `apps/web`, `docs/accounts.md`).

## Friends panel

Module: `@pbgo/ui/platform/friends-panel`

`FriendsPanel` is the friends of a signed-in visitor as a panel for a page; the page of their friends (`/me/friends`) uses it. The short way to the same friends, on every page, is the [friends bar](#friends-bar) of the navbar. From the top, the panel has:

- a header with the count of those online and the button to add a friend;
- a search field;
- the list of the friends, game by game and then by status (the roster, described with [the friends tab](#the-friends-tab));
- a footer button to invite a friend who has no account yet.

It is drawn from the friends it is given (`Friend`: nickname, tag, picture, status and what they are doing, and for one who is in a game, that game and the table they are at).

### With friends, and with none

The panel is `h-full` and scrolls its list, so a page gives it a height and a width: here a box of `h-[34rem]`. The buttons of a friend (Join for one in a game, Invite for one who is online) show when the row is hovered or focused, and always on a touch screen. Type in the search field to filter the list.

```specimen
friends-panel
```

### The dots of presence

A status is a shape, a colour and a word, never the colour alone. `PresenceDot` sits on the corner of a picture and takes the picture's size. It has one shape for each status of a friend (`FriendStatus`):

| Status | Word | Dot | Colour |
| --- | --- | --- | --- |
| `online` | Online (active) | a disc | green, `--presence-online` |
| `playing` | In a game | a disc with a play knocked out of it | blue, `--presence-playing` |
| `inactive` | Inactive | a moon | orange-yellow, `--presence-inactive` |
| `dnd` | Do not disturb | a disc with a bar knocked out of it | red, `--presence-dnd` |
| `offline` | Offline (away) | a thick ring | grey, `muted-foreground` |

Only the dot is coloured, never the text: under a name comes a line of quiet text (`text-muted-foreground`). The word of a status heads a group of the roster and, when nothing says more, is the line under the name in a card or a chat.

The four colours are tokens of `platform.css`, with the utilities `bg-presence-*` and `text-presence-*`; only a dot wears them. With `destructive`, the brand colours of the sign-in buttons and the colours of the pieces of the home's title, they are the only hues of the platform ([Colors](../02-foundations.md#colors)).

The dot is small and stands in the bottom right corner of the picture, so that a smaller one recedes into it. A ring cuts it out of the picture: `--cutout`, the colour of what the picture is on, which is the page's black or the grey of a [`glass`](../02-foundations.md#glass) container. The outline of the away ring is a quarter of the dot, not a hairline.

| Picture (`size` of the `Avatar`) | Dot | Ring | Outline of the away ring |
| --- | --- | --- | --- |
| `sm` | 8px | 2px | 2px |
| `default` | 10px | 3px | 3px |
| `lg` | 12px | 3px | 3px |
| `xl` | 16px | 4px | 4px |

The play and the bar are holes in an even-odd path over the dot's own background, `--cutout`. What shows through them is the colour of what the picture is on, whatever the picture under the dot is, since the dot only half covers it.

```specimen
presence-dots
```

## Friends bar

Module: `@pbgo/ui/platform/friends-bar`

`FriendsBar` shows the friends of a signed-in visitor the way the Riot Client shows its social visibility: a small bar on the navbar with a pill for each game some of them are in. It is the start of the dock's bar, before the account's picture and the button of the social panel, and it draws no container of its own: the page puts it in one (on the hub `SocialDock`; in the specimens of this page a `NavbarIsland`, see [Navbar](02-navigation.md#navbar)).

A pill is the picture of the game (`GameIcon`) and how many friends are in it. The bar draws up to three, the most crowded first (`gamesOf`), and a narrow screen has room for fewer: the second pill is hidden under 360px and the third under 400px. Under the pointer a pill takes the fill of the navbar's current item and a line under it.

A friend who is away, or on the hub and in no game, is in none of them: they are in the list of the [friends panel](#friends-panel). With no friend in a game the bar is the button that invites one. While the dock is open the bar is folded away: the dock gives it no room, no pointer and no focus, and the profile takes its place.

### On the navbar, with friends and with none

The bar draws no container, so it stands in an island here (on the hub it is the top of the dock, in the [social panel](#one-container-two-states)). Hover a pill, or focus it with the keyboard, to open the panel of its game, and move to another pill to change it. The panel opens at once, where the card of a friend waits 300ms, and closes a short delay (140ms) after the pointer leaves, which lets the pointer cross the gap to it. On a touch screen a press on a pill opens the panel, and another press closes it.

The second bar is a visitor with no friend in a game: the button that invites one, which shows a tick for a moment once the link is copied.

```specimen
friends-bar
```

### The panel of a game

The panel of a game is one card for all the pills, a `MovingCard` ([the card under the pointer](#the-card-under-the-pointer)): narrow (15rem), centred under the pill that is under the pointer, which it follows from one game to the next. It stands 2px under the pill, which is 8px from the bottom of the bar, so it overlaps the bar a little, covering its padding and none of its pills.

It says two lists, `Online` first and `Playing` after it. `Online` is the friends who wait in the lobby of the game: those at one table come together under a line that names it (`Table K7Q · 2/4`, `tablesOf`), and the others after them. A list with nobody in it is not drawn.

Each friend has the picture and the dot of their presence, their name and what they are doing, the dot and the quiet line being the panel's ([the dots of presence](#the-dots-of-presence)). The Join button of a friend who waits at a table that has room shows when the row is hovered or focused, and always on a touch screen.

`FriendsBarList` is that content on its own, as the specimen shows it.

```specimen
friends-bar-panel
```

## Social panel

Module: `@pbgo/ui/platform/social-panel`

The social panel of a signed-in visitor, the way the Riot Client has it: a column on the right of the page that is the same container as the bar of the games and the account's picture. The dock (`SocialDock`, `@pbgo/ui/platform/social-dock`) is a bar while it is closed and a real side panel while it is open, one glass surface that grows and shrinks between the two.

The panel (`SocialPanel`) is under the bar, which becomes its header. A press on a friend or on a conversation opens the chat with them (`ChatWindow`), a card that floats at the bottom of the page next to the panel.

### One container, two states

The dock holds the games the friends are in, the account's picture, the button of the panel and the panel itself: its bar has the slots `games`, `profile` and `toggle`, and the panel is its child. It is one glass surface (`border glass shadow-surface`, see [Glass](../02-foundations.md#glass)) and the same element in both states:

| | Closed | Open |
| --- | --- | --- |
| Shape | a bar `h-14` (3.5rem), as wide as what is in it | a side panel `20rem` wide, down to the bottom of the window less `1.5rem` and the cookie banner (`--consent-h`) |
| Corners | `rounded-2xl` | `rounded-4xl` |

Press the button of the bar to open the dock into a side panel, and press it again to close it back into the bar. With less motion asked for, it changes at once. The tabs work in the frame too.

```specimen
social-dock
```

### The bar becomes the header

The dock changes with a transition because it is the same element open and closed: its width, its height and its corners (`rounded-2xl` to `rounded-4xl`), over `DURATION.slow` with `EASE_STANDARD` (see [Motion](../02-foundations.md#motion)). The bar is the header of the open panel, the way the Riot Client has it:

- the games fold away: their width and the margin after them over `DURATION.slow`, their opacity in `DURATION.fast`;
- the picture glides to the start of the bar as they go, and what it says beside it unfolds (`SocialDockIdentity`);
- the button of the panel stays at the end and swaps its icon;
- the header grows as it goes, from 54px (the closed dock is 56px with its border) to 80px;
- the panel fades in under the header (its top follows) once there is room for it, after `DURATION.fast`, and out before the room goes.

`SocialDockIdentity` is the name and the word of the status, in the button of the profile. It is laid out at its final size from the first frame and only uncovered as its box grows, so that neither is cut with an ellipsis on the way. A name too long for the header is cut the same way in motion as at rest, at `IDENTITY_ROOM`.

In the open header the picture is 24px from the start, from the top and from the tabs (`HEADER_HEIGHT`, `HEADER_INSET_START`), for the room from the rounded corner, with the name beside it in `text-lg` and `font-strong`. The button is 16px from the end (`HEADER_INSET_END`), in line with the tabs, the search and the list, and at the top of the header, where it was when the dock was closed.

The width needs more care than the rest. The bar is as wide as what is in it, and `motion` animates `auto` to a number, but it measures `auto` with the bar of the other state, so the dock would jump. The width is therefore a motion value that the component drives: from the width it has to 20rem, and back to the width the bar had when it opened, then `auto`.

### The place in the navbar

The page puts a place for the dock in the navbar: `h-14` (3.5rem high) and as wide as the bar, so that the rest of the navbar does not move. The dock grows out of that place, over the page.

The navbar lets the pointer through (`pointer-events-none`, which its children inherit, a `fixed` one too), so the dock and the chat window take it back (`pointer-events-auto`): a panel that did not could not be clicked.

### The profile and its menu

The `profile` slot is the account's picture, usually the trigger of the account's menu (`AccountMenu` of `apps/web`), with a `SocialDockIdentity` after it for what it says while the dock is open. The menu opens under the picture, to its end, in the bar. While the dock is open it opens to the left of the panel instead, as the Riot Client's does: overlapping it by 16px (the edge of what the panel holds) and 12px under its top, where the card of a friend also stands ([the card under the pointer](#the-card-under-the-pointer)).

### The toggle and the counts

`SocialPanelToggle` is the button that opens and closes the dock, at the end of the bar in both states: `PanelRightOpenIcon` while it is closed, `PanelRightCloseIcon` while it is open, the two crossfading. It has `aria-expanded` and a fill under the pointer only: a ghost button is filled while expanded, this one is not, since the icon says whether the panel is open.

What waits for the visitor (messages not read, requests to answer) is not counted on that button but on the corner of their picture: `AvatarCount` (`@pbgo/ui/platform/avatar`, see [Avatar](04-surfaces.md#avatar)), at the top right as `AvatarBadge` is at the bottom right, outlined in `--cutout` like the dots, nothing for 0 and `99+` over 99. A tab that has something for the visitor carries a count too.

Every such count, on the picture, on a tab and on a conversation, is a red `Badge` of the variant `notification` (`bg-destructive`, its text in the colour of the page), as Discord's is (see [Badge](01-controls.md#badge)).

### The three tabs, with friends and with none

`SocialPanel` is the body of the dock. With `bare` it has no surface of its own, the dock is it; with one it is a column for a page, with a `header` above the tabs. Under its header are three tabs, each an icon: [the friends](#the-friends-tab), [the conversations](#the-conversations-tab) with them and [the way to add a friend](#adding-a-friend).

Press a tab to change it. The tile behind the current tab is one element that glides to the one that is pressed (`layoutId`, `SPRING_TRAVEL`), with a small white bar under it that glides with it. The pane of a tab comes in from the side that tab is on while the previous one leaves (`AnimatePresence` in `mode="wait"`). With less motion asked for nothing travels.

The panel is as high as the page gives it and scrolls what a tab holds, without a scrollbar. A visitor with no friend, message or request has an empty state in each tab, and the buttons that need them to exist are the page's to give.

```specimen
social-tabs
```

### The friends tab

The first tab is the friends and what they are doing: the roster (`FriendsRoster`), the list of the [friends panel](#friends-panel) under its search. It goes game by game (`rosterOf`):

- each game some friends are in is a head with its picture, its name and how many of them are in it, the most crowded game first and then by name; under it, all of its friends in one list, the ones who play it first and then the ones who wait in its lobby (the dot and a line of text tell them apart);
- then, by status, the friends who are in no game: online, inactive, do not disturb, and away last. Each of these groups is headed by its word and its count, and an empty group is not drawn.

The heads, of the games and of the statuses, are in `muted-foreground` and the count dimmer still, the head of a game brighter under the pointer, so that what is white is the names of the friends.

The head of a game is a button that folds its friends away and unfolds them: a chevron shows under the pointer, and whenever the game is folded, and the list slides shut. A search shows what it finds whether its game is folded or not. The folded games are the page's to keep (`folded` and `onFoldedChange`): the hub keeps them in the browser, as `pbgo:folded-games` of `localStorage` (`SiteSocial`).

### The conversations tab

The second tab is the conversations with the friends. Each one has the picture and the dot of the friend, their name, the last message, how long ago it was written and how many messages are not read; the one with the latest message comes first (`sortedConversations`). What is new is white (the last message and how long ago) and what was read is grey. The tab carries the count of the messages not read, in all the conversations (`unreadOf`).

### Adding a friend

The third tab is the way to add a friend: `AddFriendForm` (`@pbgo/ui/platform/add-friend-form`, also the form of `/me/friends`). The username and the tag are side by side, the tag narrow and after a hash, and under them is one button as wide as both, dark grey while a field is empty and white once both are filled. The form sends with its button or Enter, and a whole id pasted in the username field (`Username#Tag`) is split at its hash, the tag going to its field. It hands what was typed to `onSendRequest` as `username#tag`, and without that handler the form is off.

Under it wait the requests that need an answer, as the Riot Client lists them: first the ones that came in, then the ones that went out, each group under a small label with how many there are (`Incoming 2`, `Outgoing 3`). A request is a picture, the username with the tag under it, and a square button with rounded corners for each answer: a white one to accept, a grey one to decline or to cancel. The tab carries the count of the requests that came in. At its end is the button that invites a friend who has no account yet.

### The card under the pointer

Under the pointer a friend has a card (`FriendCard`), to the left of the panel. It shows their picture, big, with the dot of their presence, their name and tag, their game and what they do there, and a button for a note where the page keeps one (`onNote`). It will say more one day, how far their game has got.

There is one card for the whole list (`MovingCard` and `useMovingCard`, `@pbgo/ui/platform/moving-card`, the placement in `@pbgo/ui/card-position`). It does not close and open again from one friend to the next: it moves there, with the transition of the platform (`DURATION.slow`, `EASE_STANDARD`), its words crossfading and its height following what it holds. It opens after 300ms, to the left of the panel, overlapping it by 16px (it covers the border and the padding of the panel and none of its rows), and stays while the pointer crosses to it.

The card is for the pointer and the keyboard, never a touch: a touch has no hover, and a press on a friend opens the chat. Any other press, the Escape key and the scrolling of the page or of a box in it close the card. It is drawn in the page (a portal), above the navbar, and stays inside the window, 16px from its edges. The [panel of a game](#the-panel-of-a-game) in the friends bar is the same kind of card.

### The chat window

`ChatWindow` (`@pbgo/ui/platform/chat-window`) is the conversation that a press on a friend or on a conversation opens: a card that floats at the bottom of the page, next to the panel. The page places it, it slides in from the bottom (`PanelPresence`) and it stands to the left of the dock while the dock is open. From the top it has:

- the friend: their picture, the dot of their presence, their name and what they are doing;
- the `···` button that opens the menu of what can be done with them (join them or invite them, remove them, block them: an entry whose handler is missing is not drawn, and without any the button is not), and the button that closes the chat;
- the messages as bubbles, the visitor's on the right, filled, and the friend's on the left, quiet, with the last one in view;
- the field, which takes the focus when the chat opens and sends with Enter or its button.

Try it: what is written is added here and goes nowhere.

```specimen
chat-window
```

## The pure modules

The logic of all this is in two modules without React, tested as they are. `@pbgo/ui/friends` is what the friends are made of: the friend, the sections they are listed in, the games and the tables they are at, and what is drawn from a name.

| Function | What it gives |
| --- | --- |
| `sectionsOf` | the friends in their sections by status, in order, each with its word; a section nobody is in is left out |
| `gamesOf` | the games the friends are in, the most crowded first and then by name, each with those who wait in its lobby and those who play it: the pills of the bar |
| `rosterOf` | the groups of the roster: the games first, then the friends in no game by status |
| `tablesOf` | a list of friends cut into the tables they are at, those at no table last |
| `activityLine` | the line under a name when the game is not already said: the game, then what they are doing |
| `initials` | the letters of a picture that has none: up to two initials of the name, in capitals |

`@pbgo/ui/social` is the rest of the panel: the conversations, the requests to be friends and the time written on a message.

| Function | What it gives |
| --- | --- |
| `sortedConversations` | the conversations, the one with the latest message first |
| `unreadOf` | how many messages wait to be read, in all the conversations |
| `timeAgo` | how long ago, in the one unit that fits: `now`, `2m ago`, `1h ago`, `3d ago` |
