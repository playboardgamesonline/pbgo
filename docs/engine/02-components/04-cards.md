# Cards

A card has two sides. The engine keeps an id in one place of the state, and the table draws a `Card` with a front, a back and a pose; neither holds what the card is, which is in the game's catalogue (for the rules) and in its Sanity project (its name, its text, its picture). The table's side is shared, in `packages/table/src`; the engine's is written per game.

## A card in the state

- The state holds the id and nothing that can be looked up: no name, text, picture or colour ([Lean state](../01-the-game/09-state.md#lean-state)). In Flip 7, `ids[card]` of `State` in `games/flip-7/packages/engine/src/types.ts` is the id the card at index `card` of the catalogue holds ([Opaque ids](../01-the-game/10-views.md#opaque-ids)).
- What a card is comes from the catalogue: its index gives a face key, and `CARDS` gives the key its `kind`. In Flip 7 the catalogue is `CATALOGUE` in `games/flip-7/packages/engine/src/catalogue.ts`; Exploding Kittens builds its own from the options of the table with `buildCatalogue`. The name, the text and the picture of a key are Sanity's.
- An id is in one place at a time: exactly one in Flip 7, and one or none in Exploding Kittens, where a card set aside at setup is nowhere. `removeFrom` of `machine.ts` throws for an id that is not where it should be.
- The view names a card with a `Face`, `{ id, type }`, only to a viewer who may see it (`playerView` in `games/flip-7/packages/engine/src/view.ts`; [Hidden information](../01-the-game/10-views.md#hidden-information)). The cards of a hand or a deck the viewer cannot see are a count, never a list of ids: `cardCount` in the template, `handCount` and `deckCount` in Courtisans, `cards` and `deck` in Exploding Kittens.

From `games/flip-7/packages/engine/src/machine.ts`, an id looked up in the catalogue, and the face the view shows for it:

```ts
export function keyOf(s: Pick<State, "ids">, id: number): CardKey {
  const key = CATALOGUE[cardOf(s.ids, id)]
  // …
  return key
}
// …
export function faceOf(s: Pick<State, "ids">, id: number): Face {
  return { id, type: keyOf(s, id) }
}
```

## Kinds of cards

A game can hold cards of different kinds, and its board paints each kind its own way. A kind is defined in the engine or loaded from Sanity, and the view names a card by it. `@pbgo/table` knows no kind: `paintFace` and `standIn` paint what a game gives them, at the `CardSize` the game chose.

| Example | Kinds | Defined in | What the view calls a card |
| --- | --- | --- | --- |
| Flip 7 | `number`, `modifier`, `action` | `CardType` and `CARDS` in `games/flip-7/packages/engine/src/catalogue.ts` | A `Face`: the id and a key of `CARDS`, such as `number-7` or `freeze` |
| Exploding Kittens | `kitten`, `defuse`, `nope`, `action`, `cat` | `CardKind` and `CARDS` in `games/exploding-kittens/packages/engine/src/catalogue.ts` | A `Face`, the same |
| Courtisans, courtiers | A family and a role | `FAMILIES`, `ROLES` and `Courtier` in `games/courtisans/packages/engine/src/types.ts`; the pictures are in Sanity | A `VisibleCard`: the id, the family and the role; a hidden spy has no family |
| Courtisans, missions | A color and a `Condition` | `Mission` in the same `types.ts`; the missions come from Sanity as setup data ([Game data](../01-the-game/08-game-data.md)) | A `Mission`, to its holder; to the others `null` until the game is over |
| La Plus Haute, the template's demo | A color and a value | `Card` in `template/packages/engine/src/demo/types.ts` | The `Card` itself; an opponent's hand is `cardCount` |

- The rules read the `kind` of a card and the `effect` of an action card, never the key of its face. Flip 7 and Exploding Kittens keep both in `CARDS`; Courtisans' state predates the lean state, so each `Courtier` carries its family and its role.
- A face key is a contract: it names the card type in the catalogue, in the Studio and in the art files, and it is append only. In Sanity each kind is a document type of its own, never a `kind` field, as `CATEGORIES` lists them for Flip 7 (`games/flip-7/apps/studio/schemaTypes/constants.ts`).
- Kinds can differ in shape: Courtisans' courtiers are taller than wide and its missions wider than tall (`CARD_W` and `MISSION_W` in `layout.ts`). A `Zone` and a `Pile` take one `size` for all their cards, so cards of another shape go in a zone of their own.

## Card

`Card` is a playing card: a rounded plane with a front, a back and a thickness, and the same behaviour in every game. Shared: `packages/table/src/card/card.tsx`, with the props type `CardProps`. What differs from game to game is passed in: the pictures, the size, the glows and what is drawn on the face. A game draws its cards through a [Zone](07-zones.md#zone) or a [Pile](06-decks-and-piles.md#pile); a `Card` also works alone, inside a `Table`.

- A card glides to a new `target` by damping. It flies when it appears with a `from`, when the pose memory hands back a pose farther than `JUMP` from `target`, and when its `target` moves farther than `JUMP` in one go and the card is not already near it ([Flight and fold](05-poses-and-motion.md#flight-and-fold)). It ignores the visitor's motion preference; only the camera's entrance reads it.
- Each layer of the card (face, overlay, frame, shine and sparkle on the front; outline, halo and shadow on the back) has its own offset from the surface, in `FRONT` and `BACK` of `card.tsx`, far enough apart for the depth buffer to tell them apart: a new layer takes an offset of its own. The rim has one colour, fixed in `card.tsx`; it is not a prop. `JUMP`, `FRONT` and `BACK` are internal.

### Props

| Prop | Role |
| --- | --- |
| `id` | The game's own id for the card, a `CardId`; it feeds the [pose memory](05-poses-and-motion.md#pose-memory) |
| `target` | The `Pose` the card lies in. When it changes the card glides there, and when it jumps far the card flies |
| `from` | The `Pose` the card flies in from when it appears; without it the card appears at `target`, or where the pose memory says |
| `front`, `back` | The textures of the two sides |
| `size` | A `CardSize`, the same for every card of a game: cards of one size share their geometry |
| `glow` | A `Glow` from `defineGlows`, or `null` |
| `gloss` | The shine that follows the pointer over the front: `true` for the usual strength, a number for its own |
| `shadow` | Whether the card casts a drop shadow; on unless set to false |
| `above` | Draws the card over everything else, the glows of other cards included |
| `out` | The card can no longer play, its player being out of the round: a grey filter over its picture and its edge, on the card's own pixels (`uGrey` in the fold shader, `GREY_SHADE`: no colour, half the brightness). It costs no extra mesh or texture, and lifts when `out` turns false, so the next round has colour again. Flip 7 sets it on every card of a busted player |
| `speed` | About how many seconds the card takes to settle on a new `target`; smaller is snappier |
| `onClick`, `onHover` | Pointer events. A card does not lift itself on hover: it reports the pointer, and the game moves the pose and sets `glow` or `gloss` ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)) |
| `onArrive` | Called when a flight ends, for instance to remove a card that exists only for its flight |
| `draggable` | The player can pick the card up with the pointer and let it go on the table: it follows the pointer, lifted, and goes back to its `target` when it is let go ([Dragging](19-dragging.md)) |
| `dropOn`, `onDragStart`, `onDrop`, `onDragCancel` | The zones it may be let go on, and what it reports: `onDrop` is called with a `CardDrop`, the zone it was let go on or `null`, and where it lay ([Dragging](19-dragging.md#dragging-a-card-or-a-piece)) |
| `children` | Three.js elements drawn on the face, such as a value or a suit. Their origin is the middle of the face, x to the right and y up, in the card's units; they move, flip and hover with the card |

Press the card to change its `target` between `FACE_UP` and `FACE_DOWN`; the switches are its `gloss` and `shadow` props. The slider writes `shadow` of `CARD_SETTINGS` and starts at its top so that the shadow shows: the default is far fainter.

```specimen
scene-card
```

### Settings

`CARD_SETTINGS` is one object read on every frame by every card of the page, so the Card folder of the table's debug panel can tune it while the game runs (`CARD_FIELDS` lists the knobs; `thickness` is read when a card is drawn and has none). What a glow looks like belongs to the glow.

| Field | Role |
| --- | --- |
| `gloss` | The opacity of the shine on a hovered card; a card can ask for its own with the `gloss` prop |
| `glossMotion` | How far the shine slides with the pointer |
| `shadow` | The opacity of the drop shadow |
| `flightDuration`, `flightHeight` | Multipliers on how long a flight lasts and how high it arches |
| `easing` | The name of the easing of a flight, one of `EASING_NAMES` of core |
| `thickness` | The thickness of the card, as a fraction of its width |
| `foldable` | How much the card arches in flight, as a fraction of its half height |

## Faces and textures

A card shows two textures, and the package paints them. `paintFace` paints any face or back on a canvas, and `standIn` paints the plain face a card shows while its picture is missing. Shared: `packages/table/src/card/face.ts`. The shine, the shadow, the halo and the sparkle are textures the package generates itself.

| Name | Role |
| --- | --- |
| `CardSize` | `{ width, height, radius? }` in world units. The corners are rounded to a share of the smaller side unless `radius` is set |
| `paintFace(key, size, draw, across?)` | Paints a face or a back once for a key and a size, as an sRGB texture with anisotropic filtering. `draw(g, width, height)` gets the 2D context and the canvas size in pixels, and paints the whole rectangle: the card's shape cuts the rounded corners |
| `faceResolution(size, across?)` | The canvas size in pixels for a card size: `across` wide, as high as the proportions ask. Without `across` it is sharp at the size a card has on screen and light on memory |
| `standIn(key, size, options?)` | A plain face, still a texture on the card. `StandIn` holds its options: `color`, a neutral paper by default, and `label`, written across the middle |

- The same key at the same size and resolution gives back the same texture, painted once and kept. Put in the key everything the picture depends on: a card's id for its face (the template's `faceTexture` paints each card once, under the key `card.id`), the colours for a back.
- A missing picture is never a DOM card and never a blank: pass `standIn` the label `[missing: <key>]`, so the gap stays visible. A game's pictures come from its Sanity project; the template, a demo, paints its faces in code.

## Glows

A glow is what a card lights up with: a halo behind it, an outline, a ring around its front, a band of shine. A game names the glows of its cards once with `defineGlows`, which takes a record of specs and returns the glows under the same names, and a card wears one at a time through its `glow` prop. Shared: `packages/table/src/card/glows.ts`.

| Part | Type | Where it is drawn | Fields |
| --- | --- | --- | --- |
| `halo` | `Halo` | A soft light behind the card, reaching past it | `color`, `opacity`, `pulse` (how far the opacity swings), `speed`, `spread` (how far the light reaches, as a share of the smaller side), `blend` (`"add"` brightens what is behind, a glow; `"normal"` paints over it, a stain) |
| `outline` | `Outline` | A solid line around the back | `color`, `visible` |
| `frame` | `Frame` | A ring around the front that breathes | `color`, `opacity`, `pulse`, `breath` (how much it swells), `speed` |
| `sparkle` | `Sparkle` | A band of shine with sparks that sweeps over the front | `opacity`, `speed` |

Each of the first four cards wears one part, the last all four, all from `defineGlows`.

```specimen
scene-glows
```

- `Glow` is an object of these parts, and a part it leaves out is not built at all. `GlowSpec` is what a game writes: each part says only what differs from the defaults, which live in `glows.ts`, so `{ frame: {} }` is a frame with every default.
- A card wears one glow at a time; a state that needs two looks at once is a glow of its own.
- Colours, opacities and speeds are read on every frame, so the table's debug panel tunes them live in a folder for each glow (`Glow · name`); `spread` and `blend` are read when the card is drawn. Every glow gets its own part objects: tuning one never moves another. `definedGlows()` lists the glows made so far and `glowNameOf(glow)` tells the name one was defined under, which the panel and the card inspector use.
- Name a glow for its meaning in the game (`selection`, `gold`), not for its look.
- A glow is for a card that lies face up: the halo and the outline are behind the card and face its face, and the ring, the shine and the sparkle lie on the face, so a card lying face down shows none of them. A pile that glows to say that it can be pressed turns its top card up with the back for its picture (`top.front` of a [Pile](06-decks-and-piles.md#pile)).

## From the view to the board

- The board keys a card by the id the view gives it, as the `key` and the `id` of its `Card`, so the card keeps its identity from one render to the next and flies between zones ([Pose memory](05-poses-and-motion.md#pose-memory)). The id is a number or a string (`CardId`); a card that goes back into hiding gets a new one, so to the table it is another card.
- A count is drawn as that many backs, keyed by position, with no `id`. Nothing remembers them, so a card that turns up named, one played from a hidden hand, comes with a `from` the board gives it (`backPose` in the template). A card the view never names, such as an opponent's draw in Courtisans, is a card of the board's own that goes away on `onArrive` ([How the view feeds the scene](../04-build-a-game/04-composing-a-board.md#how-the-view-feeds-the-scene)).
- The board has a function that turns what the view calls a card into a texture: `faceTexture` in the template, `face` and `mission` of `useTextures` in Courtisans. It reads the view, never the state. A card the viewer may not see is drawn with the back: the template's opponents, and Courtisans' hidden spy, which keeps its id when it is revealed.
- Courtisans looks a courtier's picture up by `cardKey(family, role)` in the catalog from Sanity, and draws a courtier with no picture in the color of its family. A mission is its picture from Sanity with the text in the player's language written over it (`composeMission`); its back is chosen by its color (`missionBack`).
- Shared: `Card`, `CardSize`, `paintFace` and `standIn`. The game's: the size of each kind, the faces, and which face a card gets. Courtisans draws with its own `useTextures` and `Card3D` ([Not built yet](../03-not-built-yet.md)).
