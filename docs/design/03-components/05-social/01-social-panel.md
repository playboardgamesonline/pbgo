# Social panel

Module: `@pbgo/ui/platform/social-dock`, `@pbgo/ui/platform/social-panel`

The dock (`SocialDock`) is a bar while it is closed and a side panel while it is open: one glass surface that grows and shrinks between the two. The bar holds the games the friends are in, the account's picture and the button of the panel (the slots `games`, `profile` and `toggle`). When the dock opens, the bar becomes the header of the panel and the panel (`SocialPanel`) is under it. With less motion asked for, it changes at once.

```specimen
social-dock
```

The navbar lets the pointer through, so the dock and the chat window take it back (`pointer-events-auto`). What waits for the visitor (messages not read, requests and invitations to answer) is counted on the corner of their picture (`AvatarCount`, see [Avatar](../04-surfaces/03-avatar.md)) and a tab that has something carries a count too: every such count is a [`notification`](../01-controls/02-badge.md) badge.

## The tabs

Under the header, three tabs, each an icon: the friends, the conversations and the way to add a friend. The pane of a tab comes in from the side its tab is on; with less motion nothing travels. A visitor with no friend, group, message or request has an empty state in each tab.

- **Friends:** the roster, game by game with the most crowded first and then, by status, the friends in no game. The head of a game folds its friends away and unfolds them, and a search shows what it finds whether its game is folded or not. A friend's row has the one button that does something about groups with them, Invite or Join (see [Groups in a friend's row](#groups-in-a-friends-row)), and a `···` menu (the same entry, view their profile, remove them, block them) when the page gives its handlers; both are under the pointer and the focus, and always on a touch screen. An entry whose handler is missing is not drawn.
- **Conversations:** the picture and the dot of the friend, their name, the last message, how long ago it was written and how many are not read; the latest comes first. What is new is white and what was read is grey.
- **Add a friend:** the username and the tag, then the requests that wait, the ones that came in first and then the ones that went out, each with its answer: white to accept, grey to decline or cancel. The form keeps what was typed when the page says the request was refused, and its button is off while the answer is awaited. A request that was sent, or that came in, is also a [toast](../03-overlays/05-toast.md) with the same answers.

```specimen
social-tabs
```

## Groups in a friend's row

The panel has no tab for the visitor's group: a group is managed from the row of places of the home's play zone ([`PlayerSlots`](06-player-slots.md)). What the panel does about groups is on the rows of the friends, and in the invitations card.

A friend's row has the one thing that can be done about groups with them (`groupActionOf` of `@pbgo/ui/friends`), as a button under the pointer and the focus and as the first entry of the `···` menu. The [chat window](#the-chat-window) has the same entry in its menu.

| The friend | Button | Menu entry |
| --- | --- | --- |
| Connected, in no group | Invite | Invite to your group |
| In another group | Join | Ask to join their group |
| In the visitor's group | none | none |
| Away, in no group | none: invite them from the [panel of friends](04-invite-friend.md#as-a-panel) of a free place | none |
| Invited, or asked to let the visitor in | Invited or Requested, off | the same, off |

- What waits for an answer stays in view and cannot be sent twice.
- The quiet line under a friend's name says "In your group" or "In a group".
- A friend's table is never joined from a row: only groups are.
- An invitation to a group and a request to join one are rows of the [invitations card](#the-invitations-card) and the [toasts](../03-overlays/05-toast.md#about-a-person) that stay, answered with the same two buttons as an invitation to a table.

## The card under the pointer

Under the pointer a friend has a card to the left of the panel: their picture and presence, their name, their game and what they do there. There is one card for the whole list (`MovingCard`): it moves from one friend to the next instead of closing and opening again. It is for the pointer and the keyboard, never a touch, where a press on a friend opens the chat.

## The chat window

`ChatWindow` is the conversation that a press on a friend or on a conversation opens: a card that floats at the bottom of the page, next to the dock. From the top: the friend, the `···` menu of what can be done with them (the same group entry as the friend's row, then remove and block; an entry whose handler is missing is not drawn), the button that closes the chat, the messages as bubbles (the visitor's on the right and filled, the friend's on the left and quiet) and the field, which takes the focus when the chat opens.

```specimen
chat-window
```

## The invitations card

Module: `@pbgo/ui/platform/invitations-card`

What waits for the visitor's answer is a card at the top of the panel, over the tabs, whatever tab is open, as the search for a game is: the friend's picture, who writes and, under it, what it is about and how long is left; a white button to accept and a grey one to decline. There are three kinds, one row each (`Invitation`, its `kind`):

- **Table:** the invitation of a friend to the lobby they sit at (PLT-109), with the game, its picture and its name. Accepting takes the visitor to the table.
- **Group:** the invitation of a friend to their group, under the icon of a group. Accepting makes the visitor one of the group.
- **Join:** a request to join the visitor's own group. Accepting lets the one who asks in; any member of the group can answer, and the first answer is everybody's.

```specimen
invitations-card
```

The card draws nothing with no invitation, decides nothing (`onAnswer` does the work and may answer `false`, or a promise of it, for a refusal) and has no button without it; an invitation past its time says "expired" and can only be declined. `SocialPanel` takes `invitations` and `onAnswerInvitation`; the count is on the corner of the picture like the rest of what waits. A new invitation is also the [toast](../03-overlays/05-toast.md#about-a-person) that stays: `GameInvitationToast`, `GroupInvitationToast` and `JoinRequestToast`.

## The chat window and real messages

`ChatWindow` draws a message as text in a bubble that keeps its line breaks and is masked in a recording (`ph-mask`); its field takes `maxLength` and keeps what was written when `onSend` answers `false` (or a promise of it), so that a refused message is not lost. The hub reads the conversation from the server while the window is open (`useChatThread`, PLT-25).
