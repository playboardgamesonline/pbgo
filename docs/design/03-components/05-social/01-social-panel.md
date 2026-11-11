# Social panel

Module: `@pbgo/ui/platform/social-dock`, `@pbgo/ui/platform/social-panel`

The dock (`SocialDock`) is a bar while it is closed and a side panel while it is open: one glass surface that grows and shrinks between the two. The bar holds the games the friends are in, the account's picture and the button of the panel (the slots `games`, `profile` and `toggle`). When the dock opens, the bar becomes the header of the panel and the panel (`SocialPanel`) is under it. With less motion asked for, it changes at once.

```specimen
social-dock
```

The navbar lets the pointer through, so the dock and the chat window take it back (`pointer-events-auto`). What waits for the visitor (messages not read, requests to answer) is counted on the corner of their picture (`AvatarCount`, see [Avatar](../04-surfaces/03-avatar.md)) and a tab that has something carries a count too: every such count is a [`notification`](../01-controls/02-badge.md) badge.

## The three tabs

Under the header, three tabs, each an icon: the friends, the conversations and the way to add a friend. The pane of a tab comes in from the side its tab is on; with less motion nothing travels. A visitor with no friend, message or request has an empty state in each tab.

- **Friends:** the roster, game by game with the most crowded first and then, by status, the friends in no game. The head of a game folds its friends away and unfolds them, and a search shows what it finds whether its game is folded or not. A friend's row has a `···` menu (view their profile, remove them, block them) when the page gives its handlers; it is under the pointer and the focus, and always on a touch screen. An entry whose handler is missing is not drawn.
- **Conversations:** the picture and the dot of the friend, their name, the last message, how long ago it was written and how many are not read; the latest comes first. What is new is white and what was read is grey.
- **Add a friend:** the username and the tag, then the requests that wait, the ones that came in first and then the ones that went out, each with its answer: white to accept, grey to decline or cancel. The form keeps what was typed when the page says the request was refused, and its button is off while the answer is awaited. A request that was sent, or that came in, is also a [toast](../03-overlays/05-toast.md) with the same answers.

```specimen
social-tabs
```

## The card under the pointer

Under the pointer a friend has a card to the left of the panel: their picture and presence, their name, their game and what they do there. There is one card for the whole list (`MovingCard`): it moves from one friend to the next instead of closing and opening again. It is for the pointer and the keyboard, never a touch, where a press on a friend opens the chat.

## The chat window

`ChatWindow` is the conversation that a press on a friend or on a conversation opens: a card that floats at the bottom of the page, next to the dock. From the top: the friend, the `···` menu of what can be done with them (an entry whose handler is missing is not drawn), the button that closes the chat, the messages as bubbles (the visitor's on the right and filled, the friend's on the left and quiet) and the field, which takes the focus when the chat opens.

```specimen
chat-window
```
