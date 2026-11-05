# Social

The social panel is at the heart of the hub's navigation: the friends of a signed-in visitor, their conversations and their requests, one press away on every page of the hub. It is made of four parts:

- [`SocialDock`](#social-panel), the container that is the bar of the games and a side panel in one;
- [`SocialPanel`](#the-three-tabs), its body, with the friends, the conversations and the way to add a friend;
- [`ChatWindow`](#the-chat-window), the conversation with a friend;
- [`FriendsBar`](#friends-bar), a chip for each game some friends are in, with the [dot of their presence](#the-dots-of-presence) on every picture.

All of them are drawn from the friends, conversations and requests they are given and decide nothing about them: where those come from and what a button does are the page's, and a button whose handler is missing is not drawn. The hub mounts them once, in the navbar (`SiteSocial` of `apps/web`, `docs/accounts.md`). The logic is in two modules without React, tested as they are: `@pbgo/ui/friends` (the friend, its sections, the games and the tables) and `@pbgo/ui/social` (the conversations, the requests and the time written on a message).

## Social panel

Module: `@pbgo/ui/platform/social-dock`, `@pbgo/ui/platform/social-panel`

The dock (`SocialDock`) is a bar while it is closed and a side panel while it is open: one glass surface that grows and shrinks between the two. The bar holds the games the friends are in, the account's picture and the button of the panel (the slots `games`, `profile` and `toggle`). When the dock opens, the bar becomes the header of the panel and the panel (`SocialPanel`) is under it. With less motion asked for, it changes at once.

```specimen
social-dock
```

The navbar lets the pointer through, so the dock and the chat window take it back (`pointer-events-auto`). What waits for the visitor (messages not read, requests to answer) is counted on the corner of their picture (`AvatarCount`, see [Avatar](04-surfaces.md#avatar)) and a tab that has something carries a count too: every such count is a [`notification`](01-controls.md#badge) badge.

### The three tabs

Under the header, three tabs, each an icon: the friends, the conversations and the way to add a friend. The pane of a tab comes in from the side its tab is on; with less motion nothing travels. A visitor with no friend, message or request has an empty state in each tab.

- **Friends:** the roster, game by game with the most crowded first and then, by status, the friends in no game. The head of a game folds its friends away and unfolds them, and a search shows what it finds whether its game is folded or not.
- **Conversations:** the picture and the dot of the friend, their name, the last message, how long ago it was written and how many are not read; the latest comes first. What is new is white and what was read is grey.
- **Add a friend:** the username and the tag, then the requests that wait, the ones that came in first and then the ones that went out, each with its answer: white to accept, grey to decline or cancel.

```specimen
social-tabs
```

### The card under the pointer

Under the pointer a friend has a card to the left of the panel: their picture and presence, their name, their game and what they do there. There is one card for the whole list (`MovingCard`): it moves from one friend to the next instead of closing and opening again. It is for the pointer and the keyboard, never a touch, where a press on a friend opens the chat.

### The chat window

`ChatWindow` is the conversation that a press on a friend or on a conversation opens: a card that floats at the bottom of the page, next to the dock. From the top: the friend, the `···` menu of what can be done with them (an entry whose handler is missing is not drawn), the button that closes the chat, the messages as bubbles (the visitor's on the right and filled, the friend's on the left and quiet) and the field, which takes the focus when the chat opens.

```specimen
chat-window
```

## Friends bar

Module: `@pbgo/ui/platform/friends-bar`

`FriendsBar` is the start of the dock's bar: a chip for each game some friends are in, with the picture of the game (`GameIcon`) and how many friends are in it. It draws up to three, the most crowded first, and fewer on a narrow screen. A friend who is away, or in no game, is in none of them: they are in the friends tab of the social panel. With no friend in a game the bar is the button that invites one. It draws no container of its own: the dock is the one that holds it.

### On the navbar, with friends and with none

Hover or focus a chip to open the panel of its game; it opens at once and closes shortly after the pointer leaves, which lets the pointer cross the gap to it. On a touch screen a press opens it and another closes it.

```specimen
friends-bar
```

### The panel of a game

One card for all the chips, a `MovingCard` ([the card under the pointer](#the-card-under-the-pointer)), centred under the chip it follows. It lists the friends who wait in the lobby of the game (`Online`, those at one table together under a line that names it) and those who are `Playing`; a list with nobody in it is not drawn. The Join button of a friend who waits at a table that has room shows on hover or focus, and always on a touch screen.

```specimen
friends-bar-panel
```

## The dots of presence

Module: `@pbgo/ui/platform/friends-panel`

A status is a shape, a colour and a word, never the colour alone. `PresenceDot` sits on the corner of a picture and takes the picture's size, cut out of it by a ring of `--cutout`. It has one shape for each status of a friend (`FriendStatus`):

| Status | Word | Dot | Colour |
| --- | --- | --- | --- |
| `online` | Online (active) | a disc | green, `--presence-online` |
| `playing` | In a game | a disc with a play knocked out of it | blue, `--presence-playing` |
| `inactive` | Inactive | a moon | orange-yellow, `--presence-inactive` |
| `dnd` | Do not disturb | a disc with a bar knocked out of it | red, `--presence-dnd` |
| `offline` | Offline (away) | a thick ring | grey, `muted-foreground` |

Only the dot is coloured, never the text: under a name comes a line of quiet text (`text-muted-foreground`). The four colours are tokens (`bg-presence-*`, `text-presence-*`) that only a dot wears.

```specimen
presence-dots
```
