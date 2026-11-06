# Game card

Module: `@pbgo/ui/platform/game-card`

The hub's tile for a game: `GameCard`, built on `GameCardVisual`, its picture. The picture is the game's `logo` over its `background` on a grey frame (`bg-muted`); under it come the name, on one line, and the practical facts (`players`, `duration`). Two variants: `play` (the default) and `soon`, for a game to come.

- Every tile is a link, to the page of the game (`/game/<slug>`).
- A game with a logo and no background shows the logo on the plain grey frame. With neither picture, the frame stays plain grey, no placeholder.
- Hover lifts the card ([`shadow-float`](../../02-foundations/05-shadows-and-rings.md)), changes its fill to `secondary` and zooms the pictures.

## The live games, and without art

`players` and `duration` arrive already formatted, since the card does not know the visitor's language: `catalogCardProps()` (`apps/web/src/lib/game-card-props.ts`) does it.

```specimen
game-card-the-live-games-and-without-art
```

## A game to come

The `soon` variant is the tile of a game that is not playable yet: built the same way, plus a small Coming soon badge. It links to the game's page like any other.

```specimen
game-card-a-game-to-come
```

## The picture alone

`GameCardVisual` is the picture of a card on its own; a game's page draws it larger, so the two cannot drift apart.

```specimen
game-card-the-picture-alone
```
