# Social

The friends of a signed-in visitor, the way the Riot Client shows them, on the navbar of every page of the hub. It is made of five parts:

- [`FriendsPanel`](#friends-panel), the friends as a panel for a page, with the dot of their presence;
- [`FriendsBar`](#friends-bar), a chip for each game some of them are in;
- [`SocialDock`](#one-container-two-states), the container that is the bar of the games and a side panel in one;
- [`SocialPanel`](#the-three-tabs-with-friends-and-with-none), the body of the dock, with the friends, the conversations and the way to add a friend;
- [`ChatWindow`](#the-chat-window), the conversation with a friend.

All of them are drawn from the friends, conversations and requests they are given and decide nothing about them: where those come from and what a button does are the page's, and a button whose handler is missing is not drawn. The hub mounts them once, in the navbar (`SiteSocial` of `apps/web`, `docs/accounts.md`).

## Friends panel

Module: `@pbgo/ui/platform/friends-panel`

`FriendsPanel` is the friends of a signed-in visitor as a panel for a page (`/me/friends` uses it). From the top: a header with the count of those online and the button to add a friend, a search field, the list of the friends (the roster, by game and then by status, see [the friends tab](#the-friends-tab)) and a footer button to invite a friend who has no account yet. It is drawn from the `Friend`s it is given.

### With friends, and with none

The panel is `h-full` and scrolls its list, so a page gives it a height and a width. The buttons of a friend (Join for one in a game, Invite for one who is online) show when the row is hovered or focused, and always on a touch screen.

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

Only the dot is coloured, never the text: under a name comes a line of quiet text (`text-muted-foreground`). The word of a status heads a group of the roster and, when nothing says more, is the line under the name in a card or a chat. The four colours are tokens (`bg-presence-*`, `text-presence-*`); only a dot wears them.

The dot stands in the bottom right corner of the picture, and a ring of `--cutout` (the colour of what the picture is on) cuts it out of the picture.

```specimen
presence-dots
```

## Friends bar

Module: `@pbgo/ui/platform/friends-bar`

`FriendsBar` is a small bar on the navbar with a chip for each game some friends are in. It is the start of the dock's bar and draws no container of its own: the page puts it in one (on the hub `SocialDock`; in the specimens of this page a `NavbarIsland`, see [Navbar](02-navigation.md#navbar)).

A chip is the picture of the game (`GameIcon`) and how many friends are in it. The bar draws up to three, the most crowded first (`gamesOf`), and fewer on a narrow screen. A friend who is away, or on the hub and in no game, is in none of them: they are in the [friends panel](#friends-panel). With no friend in a game the bar is the button that invites one. While the dock is open the bar is folded away.

### On the navbar, with friends and with none

Hover or focus a chip to open the panel of its game, and move to another to change it. The panel opens at once and closes shortly after the pointer leaves, which lets the pointer cross the gap to it. On a touch screen a press opens it and another closes it. The second bar is a visitor with no friend in a game: the button that invites one, which shows a tick for a moment once the link is copied.

```specimen
friends-bar
```

### The panel of a game

One card for all the chips, a `MovingCard` ([the card under the pointer](#the-card-under-the-pointer)), centred under the chip it follows from one game to the next. It says two lists, `Online` first and `Playing` after it. `Online` is the friends who wait in the lobby of the game: those at one table come together under a line that names it (`tablesOf`), the others after them. A list with nobody in it is not drawn. Each friend has the picture and the dot of their presence, their name and what they are doing. The Join button of a friend who waits at a table that has room shows when the row is hovered or focused, and always on a touch screen. `FriendsBarList` is that content on its own.

```specimen
friends-bar-panel
```

## Social panel

Module: `@pbgo/ui/platform/social-panel`

The dock (`SocialDock`, `@pbgo/ui/platform/social-dock`) is a bar while it is closed and a side panel while it is open: one glass surface that grows and shrinks between the two. The panel (`SocialPanel`) is under the bar, which becomes its header. A press on a friend or on a conversation opens the chat with them (`ChatWindow`), a card that floats at the bottom of the page next to the panel.

### One container, two states

The dock holds the games the friends are in, the account's picture, the button of the panel and the panel itself: its bar has the slots `games`, `profile` and `toggle`, and the panel is its child. It is one glass surface (`border glass shadow-surface`, see [Glass](../02-foundations.md#glass)) and the same element in both states: a bar when closed, a side panel down to the bottom of the window (less the cookie banner) when open. Its corners go from `rounded-2xl` to `rounded-4xl`.

Press the button of the bar to open the dock and again to close it. With less motion asked for, it changes at once.

```specimen
social-dock
```

### The bar becomes the header

The dock is one element in both states, so its width, height and corners animate with the platform's slow duration and standard easing (see [Motion](../02-foundations.md#motion)). The bar is the header of the open panel: the games fold away, the picture glides to the start of the bar and what it says beside it unfolds (`SocialDockIdentity`), the toggle stays at the end and swaps its icon, and the panel fades in under the header once there is room. `SocialDockIdentity` (the name and the word of the status) is laid out at its final size from the first frame and only uncovered as its box grows, so that neither is cut on the way.

### The place in the navbar

The page puts a place for the dock in the navbar, as wide as the closed bar, so that the rest of the navbar does not move; the dock grows out of it, over the page. The navbar lets the pointer through (`pointer-events-none`), so the dock and the chat window take it back (`pointer-events-auto`).

### The profile and its menu

The `profile` slot is the account's picture, usually the trigger of the account's menu (`AccountMenu` of `apps/web`), with a `SocialDockIdentity` after it. The menu opens under the picture in the bar, and to the left of the panel while the dock is open, where the card of a friend also stands ([the card under the pointer](#the-card-under-the-pointer)).

### The toggle and the counts

`SocialPanelToggle` opens and closes the dock, at the end of the bar in both states, its icon swapping with a crossfade. It has `aria-expanded` and a fill under the pointer only: the icon says whether the panel is open. What waits for the visitor (messages not read, requests to answer) is counted on the corner of their picture with `AvatarCount` (see [Avatar](04-surfaces.md#avatar)), not on that button. A tab that has something for the visitor carries a count too. Every such count is a [`notification`](01-controls.md#badge) badge.

### The three tabs, with friends and with none

`SocialPanel` is the body of the dock. With `bare` it has no surface of its own, the dock is it; otherwise it is a column for a page, with a `header` above the tabs. Under the header are three tabs, each an icon: [the friends](#the-friends-tab), [the conversations](#the-conversations-tab) with them and [the way to add a friend](#adding-a-friend). The tile behind the current tab glides to the one pressed (`layoutId`, `SPRING_TRAVEL`) and the pane comes in from the side its tab is on; with less motion nothing travels. The panel is as high as the page gives it and scrolls what a tab holds, without a scrollbar. A visitor with no friend, message or request has an empty state in each tab.

```specimen
social-tabs
```

### The friends tab

The roster (`FriendsRoster`) goes game by game (`rosterOf`): each game some friends are in is a head with its picture, its name and how many are in it, the most crowded first, and under it all of its friends, the ones who play it first and then the ones who wait in its lobby. Then, by status, the friends in no game: online, inactive, do not disturb, away last, each group headed by its word and its count; an empty group is not drawn. The heads are `muted-foreground`, so that what is white is the names of the friends. The head of a game is a button that folds its friends away and unfolds them; a search shows what it finds whether its game is folded or not. The page keeps the folded games (`folded`, `onFoldedChange`; the hub keeps them in the browser).

### The conversations tab

Each conversation has the picture and the dot of the friend, their name, the last message, how long ago it was written and how many messages are not read; the latest comes first (`sortedConversations`). What is new is white and what was read is grey. The tab carries the count of the messages not read (`unreadOf`).

### Adding a friend

`AddFriendForm` (`@pbgo/ui/platform/add-friend-form`, also the form of `/me/friends`): the username and the tag side by side, and under them one button, dark grey while a field is empty and white once both are filled. It sends with the button or Enter; a whole id pasted in the username field (`Username#Tag`) is split at its hash. It hands what was typed to `onSendRequest` as `username#tag`, and without that handler the form is off.

Under it wait the requests that need an answer: first the ones that came in, then the ones that went out, each group under a small label with its count. A request is a picture, the username with the tag under it, and a button for each answer: white to accept, grey to decline or cancel. The tab carries the count of the requests that came in, and ends with the button that invites a friend who has no account yet.

### The card under the pointer

Under the pointer a friend has a card (`FriendCard`) to the left of the panel: their picture with the dot of their presence, their name and tag, their game and what they do there, and a button for a note where the page keeps one (`onNote`). There is one card for the whole list (`MovingCard`, `useMovingCard`): it does not close and open again from one friend to the next, it moves there with the platform's transition, its words crossfading and its height following what it holds. It is for the pointer and the keyboard, never a touch (a press on a friend opens the chat). Any other press, Escape and scrolling close it. It stays inside the window. The [panel of a game](#the-panel-of-a-game) in the friends bar is the same kind of card.

### The chat window

`ChatWindow` (`@pbgo/ui/platform/chat-window`) is the conversation that a press on a friend or on a conversation opens: a card that floats at the bottom of the page, next to the dock, that slides in from the bottom (`PanelPresence`). From the top: the friend (picture, dot, name, what they are doing); the `···` button that opens the menu of what can be done with them (an entry whose handler is missing is not drawn, and without any the button is not) and the button that closes the chat; the messages as bubbles, the visitor's on the right and filled, the friend's on the left and quiet, with the last one in view; and the field, which takes the focus when the chat opens and sends with Enter or its button.

```specimen
chat-window
```

## The pure modules

The logic of all this is in two modules without React, tested as they are. `@pbgo/ui/friends` is what the friends are made of: the friend, the sections they are listed in, the games and the tables they are at, and what is drawn from a name.

| Function | What it gives |
| --- | --- |
| `sectionsOf` | the friends in their sections by status, in order, each with its word; a section nobody is in is left out |
| `gamesOf` | the games the friends are in, the most crowded first and then by name, each with those who wait in its lobby and those who play it: the chips of the bar |
| `rosterOf` | the groups of the roster: the games first, then the friends in no game by status |
| `tablesOf` | a list of friends cut into the tables they are at, those at no table last |
| `activityLine` | the line under a name when the game is not already said: the game, then what they are doing |
| `initials` | the letters of a picture that has none: up to two initials of the name, in capitals |

`@pbgo/ui/social` is the rest of the panel: the conversations, the requests to be friends and the time written on a message.

| Function | What it gives |
| --- | --- |
| `sortedConversations` | the conversations, the one with the latest message first |
| `unreadOf` | how many messages wait to be read, in all the conversations |
| `timeAgo` | how long ago, in the one unit that fits |
