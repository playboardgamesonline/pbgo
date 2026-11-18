# Seats

A seat is a place at the table where a player sits. `seats` gives the places, and `Seat` draws the player who sits at one: the name with the avatar and the turn crown, and the score and a status under it, on a plate that stands above the player's cards. Nothing lies under the plate, and it never reacts to the pointer: the line across the table says whose turn it is ([The turn line](#the-turn-line)), and a player is chosen by pressing their cards ([Choosing a player](25-floor-buttons.md#choosing-a-player)). What else stands at a seat, such as the cards the player holds, is the game's, given to the `Seat` as its children. Shared: `seats` in `packages/table/src/layout.ts`, `Seat` and its pieces in `packages/table/src/seat/`.

## The ring

`seats(count, options)` returns one `Spot` per player, on an ellipse around the table, indexed like the players. `SeatsOptions`:

| Option | Role |
| --- | --- |
| `radiusX`, `radiusZ` | Half the width and half the depth of the ring |
| `me` | The index of the viewer's seat. Without it, or when it is not a seat (the -1 of an `indexOf`, an index past the players), nobody is the viewer |
| `margin` | The angle kept free at each end of the far half, so the outer seats do not close in on the viewer's sides |

- The viewer sits in front, on the +z side, with a yaw of zero, so what lies there reads upright.
- The others share the far half of the ring in turn order, starting with the player after the viewer, who sits at the viewer's left: the turn passes to the left. A single opponent sits straight across.
- Without a viewer, as at a spectator's view, everyone sits on the far half in order.
- Every other seat has the yaw that sends the top edge of a face-up card away from the middle of the table: the cards of a seat across from the viewer read upright for the viewer, and those of a seat at the side lie on their side.
- The ring is symmetric: the opponents mirror each other.

The ring for two to eight players, with the viewer's seat in front or with none; the arrow is the way a layout drawn in the seat's frame points.

```specimen
scene-seats
```

From `template/src/components/board/layout.ts`, the seats of a table, by player id (`SeatSpot` is the template's name for `Required<Spot>`):

```ts
export function seats(ids: string[], meId: string | null): Map<string, SeatSpot> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: R.radiusX, radiusZ: R.radiusZ, me: viewer < 0 ? null : viewer })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]]))
}
```

## The plate

`Seat` draws one player's plate above the box of their cards. Three seats of a table for five players, each holding a few cards: play with whose turn it is (the crown and the line across the middle), the players expected together, a seat that is away, the score and a status, and choose a player by pressing their cards:

```specimen
scene-seat
```

The props are `SeatProps`:

| Prop | Role |
| --- | --- |
| `nickname`, `color` | The name, as typed (not in capitals), in Geist at weight 600, in the seat colour (cut to `NAME_LIMIT` characters, see [Long names](#long-names)), and the colour that the avatar is made of until a picture exists |
| `imageUrl` | The player's picture; when it is null the avatar is generated |
| `theme` | The game's `SeatTheme`, `UI_THEME.seat`, read with `useSeatTheme()` |
| `above` | The box of all of the player's cards on the table, a `TableBox`: the plate stands above it, centred on it, upright for the viewer, the viewer's seat and every other, whichever way the cards are turned ([Where the plate stands](#where-the-plate-stands)) |
| `spot`, `viewer` | Where the plate stands when it has no `above`: the seat's spot on the ring, from which it stands out. By default the middle of the table, for a board that draws the seat in a group of its own |
| `active` | The player of the turn: the crown shows on the avatar |
| `away` | The player is away: the plate fades |
| `line` | The info line under the name, already written in the visitor's language: the score ("132 pts") |
| `status` | A word on the same info line, after the score ("132 pts · Stayed"), plain text, written the same way |
| `trailing` | What stands to the right of the name, in a frame whose origin is the name's right edge (`0.2` is just right of the last letter): tokens, a count, an icon |
| `crownIcon` | The crown's icon, the skin's `hostIcon`; without one, a drawn crown |
| `font` | The CSS font of the lettering; `PLATE_FONT` (Geist) by default. `PLATE_FONT` and `PLATE_WEIGHT` are exported: a game that uploaded its own display font to its Sanity project puts it in front (`"Site Title", ${PLATE_FONT}`, `tableFonts` of Flip 7) so that the plates, and the buttons and counts of the table, are drawn in it, and the kit's own is what the lettering reads in until it has loaded |
| `nameStyle`, `lineStyle` | What is changed in the `TextStyle` of the name and of the info line |
| `children` | What else stands at the seat, in the frame of the world: the cards held there |

- `PlayerSeat` is the `Seat` of a player of the table. Give it their `id` and it takes the nickname, the colour, the account picture, the seat theme, the crown icon and the font of the seat label from the platform (`useGame()`, `useSeatTheme()` and `useSkin()`), as `PlayerSeatLabel` does for the DOM ([Seat label](../../design/04-in-game/04-seat-label.md)), and what the table says of the player. The canvas of `Table` hands the contexts of the page on to the scene, so it works inside it.
- A player is therefore named one way in the DOM and on the table: the same avatar, the same seat colour and the same account picture, with no copy to keep in step. `Seat` takes the same values as props, for a scene outside a game such as the example above.
- The game does not say who has the turn: `seatStateOf` reads it from the table (a `SeatTable`: the status, who is waited for, who is present and the winners), from what every game already has in `PublicGame` (below), and gives a `SeatState`. `PlayerSeat` hands the plate `active` and `away`; a prop of the same name wins, for a game whose rules say otherwise. `waiting` and `winner` mark nothing on a plate: the turn line says who is waited for, and the end screen says who won.
- The score is the game's. The `line` is a text of the visitor's language, which the template writes with `pointsShort` of the skin and never with a literal.

| State | When | Read from |
| --- | --- | --- |
| `active` | The game waits for this player alone | `waitingFor` is this player's id only |
| `waiting` | The game waits for several players at once, this one among them (the turn line says it) | `waitingFor` lists more than one id |
| `away` | The game runs and the table has not seen the player lately | `status` is `playing` and `present` does not list the id |
| `winner` | The game is over and the player won (the end screen says it) | `status` is `over` and `results.winners` lists the id |

- A step several players answer together has no player of the turn: nobody has the crown, and the turn line says who the game waits for ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)).
- A player who is away keeps the turn: the plate fades and the crown stays, so the others see that the game waits for someone who left ([Absent players](../01-the-game/03-turns.md#absent-players)).
- Nobody fades once the game is over, whoever has left by then.
- `status` is the game's to say, from its view: the `status` of a seat in Flip 7. The contract has no word for it ([Players who are out](../01-the-game/02-players.md#players-who-are-out)). A player who is out is shown on their cards, not on the plate: the name is never struck out, and `Card` takes `out` to grey its picture ([Cards](04-cards.md#props)).

From `template/src/components/board/scene.tsx`, a seat of the template; the backs of an opponent's cards are its children, and `cardsBox` (`layout.ts`) is the box of the player's cards. It says nothing of the turn: the table does.

```tsx
<PlayerSeat key={j.id} id={j.id} above={cardsBox(s, j.id === meId)} line={pointsText(j.points)}>
```

### The layout of a plate

A plate is one block. A game fills the slots and does not place anything:

```
 ┌────────┬──────────────────────────┬──────────────┐
 │ avatar │ name                     │ trailing     │
 └────────┴──────────────────────────┴──────────────┘
           info line: line · status
```

- **The avatar is always to the left of the name**, as the plate is read, whatever way the seat is turned: the plate is read left to right, and a plate that would be turned more than a quarter turn from upright is turned back by half a turn as a whole, avatar and text together, so the avatar never goes above, below or to the right of the name. (The older rule that put the avatar after the name for a right-hand seat is gone: `rightFrom` and `Plate.after` with it.) The avatar and the name are centred as one block on the plate.
- **The name** is as typed, in Geist (`PLATE_FONT`, the platform's variable font from `@fontsource-variable/geist`, so the weight asked for is the weight drawn) at the platform's weight 600 (`PLATE_WEIGHT`), in the seat colour.
- **The info line** stands under the name: the `line` (the score, "132 pts"), then the `status` (Stayed, Bust, Frozen) as plain text after a "·". It is one `TableText`, centred under the block.
- **`trailing`** stands to the right of the name for whatever a game's players hold: Love Letter's affection tokens, a count, an icon. Give it three.js elements in the frame of the name's right edge. No game uses it yet.
- **The plate never reacts to the pointer, and nothing lies under it.** There is no `onSelect`, no aura, no rim, no tint: a plate is read, not pressed. To choose a player, the game puts an invisible `Hotspot` over their cards and their plate, and lights the cards ([Choosing a player](25-floor-buttons.md#choosing-a-player)).

## Where the plate stands

The nickname of a seat is above the player's cards, for every seat, the viewer's included, whichever way the cards are turned: the plate is upright for the viewer, and what is read of the cards is the top edge of their box on the screen, not the way they face. A game gives the `Seat` the box of the player's cards and places nothing by hand.

- `above` is the box of all of the player's cards on the table: their hand, their grid, their play area, in one `TableBox`. It is made from the layout of the cards with `boxOfPoses` (poses in the frame of a seat, as a `Zone` takes them), from a rectangle with `boxOfRect`, and joined with `joinBoxes` ([Boxes](08-layout-helpers.md#boxes)). `plateAbove(box)` is the plate it gives: centred on the box, the foot of the plate (the bottom of the info line) `plateGap` above its top edge.
- A hand that leans toward its player, or stands raised off the table, hides part of the table behind it as the camera sees it: its box must be what the camera sees, which reaches farther up the screen than where the cards lie. `boxOfPoses(poses, size, { tilt })` takes the camera's tilt (as `CameraSettings.tilt`) and gives that box. Cards that lie flat need no tilt.
- A plate that moves as cards are dealt and played looks like a glitch. A board boxes the room of the biggest hand (`joinBoxes` of the boxes of the hands of every size, or of a nominal one), so the plate stands where it stood and clears every card that can be there. The template does it (`cardsBox`).
- The info line stands under the name and the name `nameLift` toward the middle of the table from the centre of the plate; the avatar stands before the first letter and the crown on the avatar's upper-right corner, in the avatar's own frame.
- A `Seat` given no `above` stands out of the ring from its `spot` (`plateOf`): an opponent's at `reachX` and `reachZ` times the spot, the viewer's level with it and a little in front. A board that draws the seat in a group of its own places it by the middle of the group.
- A player who is away keeps `awayOpacity` of the plate: the name, the avatar and the info line fade, and the crown does not.
- `plateBoxOf(plate)` is what a plate covers of the table (`plateWidth`, the width of the avatar and `PLATE_LETTERS` letters, by the height from the top of the name to the foot of the info line): a board checks with a pure test, on the boxes and not on a screenshot, that no plate lies over a card, another plate, the piles, the clock or the line of the turn, for every table of its players, seated and as a spectator (`template/src/components/board/layout.test.ts` is the model).

| Setting | Role |
| --- | --- |
| `plateGap` | The clear space between the top edge of a player's cards and the foot of their plate |
| `reachX`, `reachZ` | How far out of the ring an opponent's plate stands when it has no `above`, as factors of the spot |
| `viewerReachX`, `viewerReachZ` | The same for the viewer's plate |
| `nameHeight`, `nameLift` | The size of the name's letters, and how far toward the middle of the table it stands from the centre of the plate |
| `lineHeight`, `lineDrop` | The same for the info line, which drops toward the viewer |
| `avatarSize`, `avatarGap` | The avatar's diameter and its gap to the first letter |
| `crownSize`, `crownRight`, `crownBack` | The crown's size, and how far its foot stands from the avatar's centre: to the right and away from the viewer |
| `awayOpacity` | How opaque the plate of a player who is away stays |

`SEAT_SETTINGS` is a plain object (its type is `SeatSettings`) that the Seat folder of the table's debug panel edits (`SEAT_FIELDS` lists its knobs, and a `Seat` follows them as they move). With the panel's View folder on, every `Seat` also marks the middle of its plate, the box the plate covers and the box of the cards it stands above. `plateAbove`, `plateOf`, `plateBoxOf` and `seatStateOf` are the same numbers and rules as pure functions: `placement.test.ts` checks them (the plate is above the cards of every seat of every table of two to eight, whatever its yaw, and the places a plate placed from its spot has had since the template wrote them), and `state.test.ts` checks the states.

## The turn line

One line of the table says whose turn it is: "It's your turn" when the game waits for the viewer, "Ann's turn" when it waits for another player, "Waiting for Ann, Bob" when it waits for several others at once. It is the platform's words in the visitor's language (`yourTurn`, `turnOf`, `waitingFor` of `UI_TEXTS`, the ones of the ticker at the top left of the screen) and what the table says, so a game writes no sentence and keeps no turn marker of its own: it gives the line a place.

```tsx
<TurnLine at={{ x: 0, z: 3 }} height={0.5} maxWidth={5} />
```

| Prop | Role |
| --- | --- |
| `at` | Where the line is centred on the table. The only thing a board must give |
| `height` | The size of the lettering, in world units (default `TURN_LINE_HEIGHT`, 0.7) |
| `maxWidth` | The widest the line may be: a sentence that does not fit is broken in two lines, at the space that leaves them the most alike, in letters of the same height, and is set smaller only if two lines are not enough (`setLine`) |
| `style`, `font` | What is changed in the style of the lettering, and its CSS font (the game's display font by default, `useLettering`) |

- `whoseTurn({ status, waitingFor, meId })` is the rule, pure: the viewer when they are one of the players waited for, a classic turn (one player) else, the players waited for together when the viewer is not one of them, nobody before the game, after it and when the game waits for nobody. `turnSentence` words it with the platform's texts. The ticker's rule and this one are the same.
- `TurnLine` reads the game (`useGame`) and the platform's words (`useText`) and draws a `TurnText`; a scene outside a game, such as the specimens of these docs, gives `TurnText` the sentence.
- It is lettering laid flat on the table, in the game's lettering and the colour of its text, and it takes no pointer. When the sentence changes it settles in; a visitor who asks for less motion has it at once.
- Where it lies is the board's: a place the cards, the plates and the piles never reach, and the camera shows (the template keeps it in the band above the viewer's hand, beside their plate).

## What stands on a plate

| Piece | Component | Page |
| --- | --- | --- |
| The nickname | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| The avatar to its left | `SeatAvatarMesh` | [The avatar](#the-avatar) |
| The turn marker | `TurnCrown` | [Crown and the turn marker](../01-the-game/03-turns.md#crown-and-the-turn-marker) |
| The info line (score, then status) | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| What stands to the right of the name | `trailing`, the game's | [The layout of a plate](#the-layout-of-a-plate) |
| The cards held there | A `Zone` framed on the seat, a child of the `Seat` | [Zone](07-zones.md#zone) |

- Each piece is exported on its own too.
- The viewer's `Seat` has no zone of backs: their cards are the hand, in front of them and outside the ring ([Zone](07-zones.md#zone)).

## Long names

A nickname is typed by its player, so it can be any length, and a plate, a list of players and a heading must not grow with it. Every place that draws a name on the board or in the HUD draws `shortName(name)` of `@pbgo/core/lib/short-name` (`packages/core/lib/short-name.ts`), once, for every game: the `Seat` plate, the `SeatLabel` (the strip of the players still to play, the game over, the seat labels of the docs), the list of the players of the HUD and the name that heads a turn in the ticker.

| Export | What it does |
| --- | --- |
| `NAME_LIMIT` | The one constant: 12, the most characters of a name that are drawn, the ellipsis included |
| `shortName(name, limit = NAME_LIMIT)` | The name as drawn: unchanged when it fits, else its first `limit - 1` characters, the spaces before the cut dropped, then "…" |

- Characters are counted as the eye counts them, not as JavaScript does: an emoji, a letter with its accent written as a combining mark and a family joined by zero-width joiners are each one character, so a name is never cut in the middle of one. `Intl.Segmenter` does it; a runtime without it counts code points.
- The full name stays the accessible one: the DOM that draws a short name carries the whole of it in `title`. The canvas of a `Seat` has no DOM, so the plate's name reads as drawn there; the full name is in the list of the players beside the board.
- Only what is drawn is cut. The state, the log, the chat and the profile keep the name the player typed. To change the limit, change `NAME_LIMIT`: `short-name.test.ts` follows it.

## The avatar

The seat avatar is the picture that stands for a player next to their nickname. The same picture is drawn in the DOM by `SeatLabel` and on the table by `SeatAvatarMesh` ([Seat label](../../design/04-in-game/04-seat-label.md)). Core specifies the avatar (`seatAvatar`) and paints it on a 2D canvas (`useSeatAvatarCanvas`), and stays free of three.js; the package wraps that canvas in a texture and lays it on a plane. Shared: `packages/table/src/seat/seat-avatar-mesh.tsx`.

| Prop | Role |
| --- | --- |
| `nickname`, `color` | What the avatar is made of until a picture exists: the initial on the seat colour |
| `imageUrl` | The player's picture; when it is null the avatar is generated |
| `theme` | The game's `SeatTheme`, `UI_THEME.seat`, read with `useSeatTheme()` |
| `position` | Where it lies, in the frame it is placed in |
| `size` | The diameter of the avatar, in world units |
| `opacity` | How opaque it is, 0 to 1: a `Seat` fades the avatar of a player who is away or out |
| `layer` | The render order, to draw it over or under other flat things |

- It draws nothing until the canvas is ready (a font or a picture may still be loading), then lies flat on the table.
- The plane is larger than the avatar by `AVATAR_FILL` of core, the share of the canvas the avatar fills, so the ring and the shadow fit. `size` is the avatar's own diameter.
- The texture is disposed when it changes or when the component goes, and it takes no pointer events ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)).
- A `Seat` places it with the nickname: a child of the `TableText` (left of the first letter) or its `trailing` (right of the last) ([Text on the table](09-score.md#text-on-the-table)).
