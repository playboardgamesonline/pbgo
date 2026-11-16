# Group

Module: `@pbgo/ui/platform/group-panel`

A group is the members who play together: two to nine players, one of whom leads. `GroupPane` is the pane of the group tab of the [social panel](01-social-panel.md#the-tabs): the visitor's group, its members, and the way in and out. A group of one is no group, so a visitor with none sees an empty state.

```specimen
group-pane
```

- The heading says "Your group" and how many are in it out of how many it takes.
- A member is drawn as a friend is in the roster: the picture with the [dot of their presence](03-the-dots-of-presence.md), the name with its tag, masked in a recording, and under it what they are doing.
- The leader comes first and wears a crown, with a word for a screen reader. The visitor is marked "(you)".
- A member need not be the visitor's friend: the pane shows whoever is in the group.
- The `···` menu of a member is under the pointer and the focus, and always on a touch screen. Any member can open another member's profile; only the leader can make a member the leader or remove them, and removing is the destructive entry. The visitor has no menu on their own row.
- At the foot, "Invite a friend" opens the [picker](04-invite-friend.md) and "Leave group" leaves. A full group says so in place of the invite button.
- With no group, the pane says so and offers the invite button: the group is made when the friend accepts.
- The pane decides nothing: the group and what each button does are the page's. A button whose handler is missing is not drawn, nor a menu with nothing in it.

## In a friend's row

A friend's row has the one thing that can be done about groups with them (`groupActionOf` of `@pbgo/ui/friends`), as a button under the pointer and the focus and as the first entry of the `···` menu. The [chat window](01-social-panel.md#the-chat-window) has the same entry in its menu.

| The friend | Button | Menu entry |
| --- | --- | --- |
| Connected, in no group | Invite | Invite to your group |
| In another group | Join | Ask to join their group |
| In the visitor's group | none | none |
| Away, in no group | none: invite them from the picker | none |
| Invited, or asked to let the visitor in | Invited or Requested, off | the same, off |

- What waits for an answer stays in view and cannot be sent twice.
- The quiet line under a friend's name says "In your group" or "In a group".
- A friend's table is never joined from a row: only groups are.

## Invitations and requests

An invitation to a group and a request to join one are rows of the [invitations card](01-social-panel.md#the-invitations-card) and the [toasts](../03-overlays/05-toast.md#about-a-person) that stay, answered with the same two buttons as an invitation to a table.
