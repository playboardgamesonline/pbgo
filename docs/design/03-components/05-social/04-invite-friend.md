# Invite a friend

Module: `@pbgo/ui/platform/invite-friend`

`InviteFriendDialog` is the window that "Invite a friend" opens, in the menu of a free seat of a table the visitor sits at (`OpenSeat`, `invite.onInvite`). `InviteFriendList` is its content: a search field, then the friends the visitor may invite, in two lists.

- **Online**, the suggestions: the friends who are connected, those who are free first (online, inactive, do not disturb), then those who are playing, each with their picture, the [dot of their presence](03-the-dots-of-presence.md), their name and what they are doing (the game they are in and, in its lobby, "In the lobby").
- **Offline**: the other friends. They are listed too: the invitation waits for them and is seen when they come back, until it expires.

One press on a row sends the invitation, and nothing else: the row says "Sending…", then "Invited" with a tick and stays in the list, so that a table with several free seats can invite several friends; the window is left with its close button or Escape. The search narrows both lists by nickname, tag or the whole handle (`matchingFriends`, `suggestionsOf` of `@pbgo/ui/friends`). The component decides nothing: `onInvite` sends and answers `false` (or a promise of it) when the invitation was refused, which puts the row back.

```specimen
invite-friend
```
