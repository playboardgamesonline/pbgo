# Score

The score is the points a board shows while a game goes on. Nothing shared draws it during the game: the engine derives each number from its state and puts it in the view, and the board writes it on the table as [text on the table](#text-on-the-table). The references are `games/flip-7/packages/engine/src/view.ts` and `template/src/components/board/scene.tsx`; at the end the numbers become the `Results` of [Victory and results](../01-the-game/06-victory.md#victory-and-results).

## In each game

| Example | Stored | Derived | In the view while the game goes on |
| --- | --- | --- | --- |
| Flip 7 | `rounds[round][seat]`, the points of each finished round | `totalsOf` with `sumRounds`; `roundScore` from `lineScore` | For each seat `score`, what the cards in front of it are worth now, and `total`, what it has banked; `rounds` and `target` |
| The template | `pointsPerRound` on each player | `points`, their sum, built in `view` | `points` and `pointsPerRound` for each player |
| Courtisans | No points | `computeResults`, from `computeStatuses`, `domainPoints` and the missions | None: `results` is `null` until `phase` is `"over"` |
| Exploding Kittens | `out`, the order the players left | `results`, whose `total` counts the opponents a player outlasted | No points: `out`, and `alive` for each player |

## Keeping the score

- Store the points of each round and derive the totals, with `sumRounds` of the kit ([Rounds](../01-the-game/06-victory.md#rounds)): neither Flip 7 nor the template stores a total.
- The view carries every number the board shows. The template's scene writes `j.points` as it comes and adds nothing up.
- A score that depends on something hidden stays out of the view until the end: the missions of Courtisans are secret, so `results` is `null` before `phase` is `"over"`.

## Showing the score

- Core shows points only at the end, from `view.results`: in the game-over panel, where `detail` of each `PlayerResult` makes the chips, and in the victory announcement ([Game over](../../design/04-in-game/07-game-over.md)). Its HUD and its players strip show none.
- On the table the points are a `TableText` placed from the spot of the seat; the template writes them in a second one under the nickname ([Seats](03-seats.md)).
- At the end a board may draw `results` on the table: the ending of Courtisans writes the points of each pile with `PilePoints` and each player's total with `Counters`, which grows as the piles resolve (`games/courtisans/src/components/game3d/ending3d.tsx`).
- Flip 7's `score` and `total` are drawn by no board, since the game has none, and no tool draws a score sheet or a track ([what is not built](../03-not-built-yet.md)).

## Text on the table

Text lies flat on the table as a texture painted on a canvas: nicknames, points, a counter. The reference is `TableText` in `template/src/components/board/table-text.tsx`.

### Props

| Prop | Role |
| --- | --- |
| `text` | What is written |
| `style` | A `TextStyle`, below |
| `height` | The size of the letters, in world units |
| `position`, `yaw` | Where it lies and its turn about the vertical axis |
| `onClick`, `onHover` | Make the text a click target: it takes pointer events only with one of them, and shows a pointer cursor only with `onClick` ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)) |
| `layer` | The render order |
| `children` | What sits before the text, in a frame whose origin is the text's left edge and whose x grows to the right, so a negative x is just left of the first letter |
| `trailing` | What sits after the text, in a frame whose origin is its right edge |

- The template does not turn its plates toward each player: they read upright from the viewer's side. A game that wants them to follow its seats passes `yaw`.
- A label painted on the table is still the game's text: it comes from the view, the skin or Sanity, never a literal in the scene.

### Style

`TextStyle` is a `color` and optional effects, all painted into the texture:

| Field | Effect |
| --- | --- |
| `color` | The fill |
| `outline`, `glow` | A stroke around the letters, and a blur of colour around the stroke |
| `weight`, `spacing` | The font weight, and the letter spacing as a CSS length |
| `shadow` | A drop shadow, written as three parts joined by a bar: colour, blur and offset |
| `bloom`, `aura` | A soft light of that colour around the letters |
| `relief` | A stack of copies for depth, with a gloss and a shimmer |
| `holo` | Scan lines cut out of the letters, and a slow flicker |

- The texture is painted again only when the text, the style or the readiness of the font changes, and the old one is disposed. The component waits for the font (`document.fonts`), or a fallback font would be frozen into the texture.
- The font is the `FONT` constant of the file; a game with its own font changes it there.
- The plane is larger than the letters, to leave room for the effects.
