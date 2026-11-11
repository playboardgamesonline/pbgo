# Game card

Module: `@pbgo/ui/platform/game-card`

The hub's tile for a game: `GameCard`, built on `GameCardVisual`, its picture. The picture fills a grey frame (`bg-muted`) with nothing over it: no logo, scrim or tint. Under it come the name, on one line, and the practical facts (`players`, `duration`). Two variants: `play` (the default) and `soon`, for a game to come.

- Every tile is a link, to the page of the game (`/game/<slug>`).
- The card draws what it is given and chooses nothing: a `picture` fills the frame, a `logo` sits contained on the plain frame, and with neither the frame stays plain grey, no placeholder. A `picture` wins over a `logo`.
- The hub chooses (`gamePicture()`, `apps/web/src/lib/game-card-props.ts`): the game's cover, else its background, as the `picture`; a game with neither has its logo, else its icon.
- Hover lifts the card ([`shadow-float`](../../02-foundations/05-shadows-and-rings.md)), changes its fill to `secondary` and zooms the picture.

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

`GameCardVisual` is the picture of a card on its own: a picture that fills the frame, a logo on the plain frame, or nothing.

```specimen
game-card-the-picture-alone
```

## Cover tile

Module: `@pbgo/ui/platform/cover-tile`

A small frame for the picture of a game, where a whole card is too much: an option of a list, a chip, a row of favourites. It draws what it is given, as the card does: a `picture` fills it, else a `logo` is contained on it, else it is a plain frame. Its size is yours and its corner is its own, the tile's (`rounded-tile`).

```specimen
cover-tile
```
