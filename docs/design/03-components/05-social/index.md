# Social

The social panel is at the heart of the hub's navigation: the friends of a signed-in visitor, their conversations and their requests, one press away on every page of the hub. It is made of five parts:

- [`SocialDock`](01-social-panel.md), the container that is the bar of the games and a side panel in one;
- [`SocialPanel`](01-social-panel.md#the-three-tabs), its body, with the friends, the conversations and the way to add a friend;
- [`ChatWindow`](01-social-panel.md#the-chat-window), the conversation with a friend;
- [`InviteFriendDialog`](04-invite-friend.md), the window that picks the friend to invite to a table, the connected ones first;
- [`FriendsBar`](02-friends-bar.md), the friends who are connected, each a picture with its dot, then a chip for each game some friends are in, with the [dot of their presence](03-the-dots-of-presence.md) on every picture.

All of them are drawn from the friends, conversations and requests they are given and decide nothing about them: where those come from and what a button does are the page's, and a button whose handler is missing is not drawn. The hub mounts them once, in the navbar (`SiteSocial` of `apps/web`, `docs/accounts.md`). The logic is in two modules without React, tested as they are: `@pbgo/ui/friends` (the friend, its sections, the games and the tables) and `@pbgo/ui/social` (the conversations, the requests and the time written on a message).
