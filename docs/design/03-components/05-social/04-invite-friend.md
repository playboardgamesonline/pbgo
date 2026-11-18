# Invite a friend

Module: `@pbgo/ui/platform/invite-friend`

`InviteFriendDialog` is the window that "Invite a friend" opens: in the menu of a free seat of a table the visitor sits at (`OpenSeat`, `invite.onInvite`). `InviteFriendList` is its content: a search field, then the friends the visitor may invite, in two lists. The window says what it is for in its title and under it (`title`, `description`); it is "Invite a friend" unless the page says more, as it does for the table it is for.

- **Online**, the suggestions: the friends who are connected, those who are free first (online, inactive, do not disturb), then those who are playing, each with their picture, the [dot of their presence](03-the-dots-of-presence.md), their name and what they are doing (the game they are in and, in its lobby, "In the lobby").
- **Offline**: the other friends. They are listed too: the invitation waits for them and is seen when they come back, until it expires.

For a group the page lists the friends who are in none (a friend in a group is asked to let the visitor in from their row, never invited), and gives the ones already invited (`invited`), which show as sent.

One press on a row sends the invitation, and nothing else: the row says "Sending…", then "Invited" with a tick and stays in the list, so that a table with several free seats can invite several friends; the window is left with its close button or Escape. The search narrows both lists by nickname, tag or the whole handle (`matchingFriends`, `suggestionsOf` of `@pbgo/ui/friends`). The component decides nothing: `onInvite` sends and answers `false` (or a promise of it) when the invitation was refused, which puts the row back.

```specimen
invite-friend
```

## As a panel

`FriendPicker` is the same list for a [popover](../03-overlays/03-popover.md), the one a free place of the [player slots](06-player-slots.md) opens: the friends right away, with no menu that leads to a window. The connected ones come first, then the others, with the search field above; `limit` keeps the list short, and a line says how many more the search will find. Under the list, after a separator, `link` gives a "Copy link" row that says so once it is copied, for somebody who is not a friend yet. The search field takes the focus as the panel opens and has no ring round it then.

```specimen
friend-picker
```
