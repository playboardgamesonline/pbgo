# Player slots

Module: `@pbgo/ui/platform/player-slots`

The row of places of the signed-in home's play zone: the people who play together, on one line. The visitor is in the middle place and the others fill outwards from them, one to the right and one to the left in turn. The row has a column for each seat of the largest table, nine, the most a lobby holds, so that a whole group fits, and it never wraps: the pictures are as large as their column and shrink with it. The row is wide, and the middle column is half as wide again as the others, so the visitor's picture is the largest. Each place stands in a box as tall as the middle column is wide, with its picture centred in it, so that every picture is level with the middle one and the names sit on one line under them.

```specimen
player-slots
```

- A place that nobody has is a dashed circle with a plus in it, open whatever else the zone holds. A press opens a panel (`picker`): the [friend picker](04-invite-friend.md#as-a-panel), the friends right away, with no menu in front of them.
- A person is their picture with the [dot of their presence](03-the-dots-of-presence.md), their name under it ("You" for the visitor) and a crown on the one who leads. The names are left out in a column too narrow for them to be read. An invitation that has not been answered is a faint picture with a dashed outline.
- A press on a person opens their menu (`menu`), when the page has one for them: their profile and, for the leader, the lead and the way out of the group.
- `size` is how many places there are. A table of fewer seats uses fewer columns, around the visitor. The row has no label: what it is says itself.
- It decides nothing: who is in the row, how many places it has and what a press does are the page's. The order the places fill in is `layoutRow` of `@pbgo/ui/play-zone`, which is tested as it is.
