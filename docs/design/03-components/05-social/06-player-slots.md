# Player slots

Module: `@pbgo/ui/platform/player-slots`

The row of places of the signed-in home's play zone: the people who play together, on one line. The visitor has the first place, at the left, and the others follow in the order they came, the free places after them. Every place is a large avatar of one size, a person's and a free place's, as large as the room of the row allows for the places there are, up to a most that grows with that room (the page makes it a container): a few places are a few large avatars, nine are nine smaller ones on one line; a column too narrow for them wraps the row to a second line. It has all its places from the start, the most a table holds, free but for the visitor's (`placesFor` of `@pbgo/ui/play-zone`), the way the row of games has all its slots (`gameSlotsFor` of `@pbgo/ui/play-zone`). The places are a little further apart in a section wide enough for it.

```specimen
player-slots
```

- A place that nobody has is a circle with a plus in it, with the thin outline and the background of a free slot of the row of games, open whatever else the zone holds. A press opens a panel (`picker`): the [friend picker](04-invite-friend.md#as-a-panel), the friends right away, with no menu in front of them.
- A person is their picture with the [dot of their presence](03-the-dots-of-presence.md), their name under it ("You" for the visitor) and a crown on the one who leads. A name that does not fit under the picture is cut. An invitation that has not been answered is a faint picture with a dashed outline.
- A press on a person opens their menu (`menu`), when the page has one for them: their profile and, for the leader, the lead and the way out of the group.
- `size` is how many places there are, which the page says: `placesFor` for a group, the seats of the game for a table of one's own. The row has no label: what it is says itself.
- It decides nothing: who is in the row, how many places it has and what a press does are the page's. The order the places fill in is `layoutRow` of `@pbgo/ui/play-zone`, which is tested as it is.
