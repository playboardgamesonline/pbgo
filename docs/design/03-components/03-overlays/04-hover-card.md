# Hover card

Modules: `@pbgo/ui/platform/hover-card`, `@pbgo/ui/platform/user-card`

A card that opens under the pointer when it rests on its trigger, for what a sighted visitor may want to glance at without pressing anything. It is for the pointer alone: a touch has no hover and the keyboard does not reach the trigger, so whatever the card says is also said somewhere a press reaches. `HoverCardTrigger` takes the element the pointer rests on with `asChild`.

## A player's card

`UserCard` is what the picture of a player opens: their nickname and tag, a quiet line when there is something to say, their rank in the game and their record, and, for an account, a button that leads to their profile. A seat's picture opens it already (`SeatAvatar`).

```specimen
hover-card-a-players-card
```
