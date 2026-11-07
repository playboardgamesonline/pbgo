# Components

The components are what lies on the table: the table itself, cards, decks and piles, the zones that hold them, a score. Each has two sides, what the engine keeps of it in the state and what the board draws, and a page says both.

The board of a game is a 3D scene drawn with react-three-fiber on one canvas, and none of it is DOM. `@pbgo/table` gives every game the same table: a canvas with its camera, an endless table, cards that glide, fly and bend, the helpers that say where cards go and the zones that place them. The plate of a player, with its name, its avatar, its crown and its aura, is the shared `Seat`. What depends on a game's look (its pictures, its layouts, its camera) is written per game in the `board/` folder of its binding, and `template/src/components/board/` is the reference.

The tools are in `packages/table/src` and `pnpm --filter @pbgo/table test` runs their tests. The exports of `packages/table/src/index.ts` are the whole API of the package; a file can hold more than it exports, and a page says so when a piece is internal.

Hover a card of the hand to lift it, press it to play it to the middle, and change the number of players under the table.

```specimen
scene-board
```

## The components

- [Words and names](00-words-and-names.md): what sits in what on a board, and the word each part goes by.
- [Table](01-table.md): the canvas, the lights, the endless surface, the share photo and the coordinates.
- [Camera](02-camera.md): the settings, the entrance, the rig.
- [Seats](03-seats.md): the ring of seats around the table, the plate of the player who sits at one (name, avatar, crown, aura, score) and the picture beside a nickname.
- [Cards](04-cards.md): a card in the state and on the table, its faces, its kinds and its glows.
- [Poses and motion](05-poses-and-motion.md): where a card lies, how it gets from one pose to another and where it starts from.
- [Decks and piles](06-decks-and-piles.md): drawing, dealing and reshuffling in the engine, and the pile on the table.
- [Where cards are](07-zones.md): the places of a card, the hand and the zones that lay cards out.
- [Layout helpers](08-layout-helpers.md): `fan`, `row`, `pile`, `grid` and `inFrame`.
- [Score](09-score.md): the points during a game, and the text that shows them.
- [Rules of the board](10-rules-of-the-board.md): what holds for every board, whatever the game.

What no tool draws, such as tokens, dice and boards, is on [Not built yet](../03-not-built-yet.md). The players and the turn are in [The game](../01-the-game/index.md).
