# The 3D scene

The board of a game is a 3D scene drawn with react-three-fiber on one canvas, and none of it is DOM. `@pbgo/table` gives every game the same table: a canvas with its camera, an endless table, cards that glide, fly and bend, the helpers that say where cards go and the zones that place them. What depends on a game's look (its pictures, the name plates, the aura, the crown) is written per game in the `board/` folder of its binding, and `template/src/components/board/` is the reference.

Each page of this group is one item of the scene: what it is and where it lives, what you give it and the rules it keeps. The tools are in `packages/table/src` and `pnpm --filter @pbgo/table test` runs their tests. The exports of `packages/table/src/index.ts` are the whole API of the package; a file can hold more than it exports, and a page says so when a piece is internal.

Hover a card of the hand to lift it, press it to play it to the middle, and change the number of players under the table.

```specimen
scene-board
```

## What sits in what

```text
GameHud                          DOM, shared: ticker, announcements, game over
└── Scene                        the board, loaded on demand
    └── Table                    the canvas, with the pose memory
        ├── Surface              the endless table, always
        ├── CameraRig            puts the camera where the settings say, every frame
        ├── Lights               when asked for
        ├── SharePhoto           when a photo camera is given
        └── World                what lies on the table, the game's own
            ├── a group per seat
            │   ├── Aura         lit for the player whose turn it is
            │   ├── TableText    the nickname, with SeatAvatarMesh and TurnCrown
            │   ├── TableText    the points
            │   └── Zone         the cards held there, face down
            ├── Zone             the viewer's hand
            └── Zone             the middle of the table
                └── Card …       a front, a back, a glow, a shadow
```

`GameHud` is core's ([In-game UI](../../design/04-in-game/index.md)). `Scene` and `World` are the names the template gives the two halves of its `board/scene.tsx` ([Composing a board](23-composing-a-board.md)).

## Words and names

The code has no component for some of the words used for the parts of a table. This maps them.

| Word | In the code | Shared or per game | Page |
| --- | --- | --- | --- |
| table | `Table`: the canvas, the camera, the lights and the pose memory, with an endless `surface` | Shared | [Table](01-table.md) |
| table surface | The `surface` prop of `Table`: a colour, and a picture that repeats | Shared | [Surface](04-surface.md) |
| mat | No component: the table has no edge, so a mat is a plane the game draws on it | Per game | [Surface](04-surface.md) |
| card | `Card` | Shared | [Card](06-card.md) |
| deck, draw pile, discard pile | `Pile` for cards the game only counts; a `Zone` over `pile` for cards it names | Shared | [Pile](14-pile.md) |
| hand | A `Zone` over a `fan` layout in front of the viewer | Tools shared, layout per game | [Zone](13-zone.md) |
| player zone | No component: a `Spot` from `seats`, used as the `frame` of a `Zone`, with the seat's own pieces beside it | The ring is shared, the pieces are per game | [Seats](15-seats.md) |
| seat | A `Spot` from `seats`; there is no `Seat` component | The ring is shared | [Seats](15-seats.md) |
| name plate | `TableText`, with `SeatAvatarMesh` | Per game | [Text on the table](19-text-on-the-table.md), [Seat avatar](18-seat-avatar.md) |
| aura | `Aura` | Per game | [Aura](16-aura.md) |
| crown, turn marker | `TurnCrown` | Per game | [Crown and the turn marker](17-crown.md) |
| turn transition | No component: the crown and the aura move, the hand becomes playable, the `turn` announcement plays | The scene is per game, the announcement is shared | [Turn change](21-turn-change.md) |
| opening, ending | No component: only the camera's entrance is shared | Per game | [Opening and ending](22-opening-and-ending.md) |

## Coordinates

- The world is y up. Distances are world units: a card's `size`, the `tile` of the surface and the camera's `distance` are in them.
- The viewer sits on the +z side and looks toward -z; +x runs to the right of the screen at a camera `yaw` of zero.
- A card is a plane facing +z. `FACE_UP` lays it flat with its front to the sky and its top edge toward -z, away from the viewer; `FACE_DOWN` shows the back and points the top edge toward +z.
- The `y` of a pose is the height of the card's centre above the table; `RESTING_HEIGHT` is a card lying on it. From the bottom up: the table, the cards.
- `yaw` turns about the vertical axis, counterclockwise seen from above. Poses and layouts take radians; the camera's `tilt`, `yaw` and `fov` are degrees.
- A `Spot` is `{ x, z, yaw }`: a place on the table and the way it faces. A layout is drawn in the frame of a spot and `inFrame` puts it on the table.

## Rules

- A board is 3D, never 2D: no DOM or CSS board. A missing picture is a generated texture (`standIn`) or a plain material, and only the shared HUD is DOM.
- A game imports `@pbgo/table` from its lazy board chunk only, so the hub, a game's page on it included, loads no three.js ([Lazy loading](23-composing-a-board.md#lazy-loading)).
- `@pbgo/table` imports no game. It depends on `@pbgo/core` (easing, share photo, motion preference), and core never imports it.
- A game's pictures and words stay in its Sanity project: the tools take textures, sizes and labels as arguments.
- Every material is unlit and not tone mapped, so a colour on the screen is the texture's own.
- The layout helpers read no setting: every number is an argument. A card reads `CARD_SETTINGS`, the camera reads the objects it is given, and a debug panel edits those objects ([Tuning](24-tuning.md)).
- A scene is a function of the view: the same view gives the same poses on every client, and a pose never calls `Math.random` (`hashRandom` gives the small differences).
- The scene holds no rule and sends intents: a click calls a handler, and the board posts the action ([The life of an action](../01-how-a-game-runs.md#the-life-of-an-action)).

## Pages

The shared tools of `@pbgo/table`:

- [Table](01-table.md): the canvas and what it carries.
- [Camera](02-camera.md): the settings, the entrance, the rig.
- [Lights](03-lights.md): the ambient light and the sun.
- [Surface](04-surface.md): the endless table.
- [Share photo](05-share-photo.md): the picture of the finished table.
- [Card](06-card.md): props, settings, layers.
- [Faces and textures](07-faces-and-textures.md): painting a face, the stand-in.
- [Glows](08-glows.md): what a card lights up with.
- [Flight and fold](09-flight-and-fold.md): how a card gets from one pose to another.
- [Pose memory](10-pose-memory.md): a card that changes zone starts from where it was.
- [Poses](11-poses.md): `Pose`, `onTable`, `lean`, `shifted`.
- [Layout helpers](12-layout-helpers.md): `fan`, `row`, `pile`, `grid`, `inFrame`.
- [Zone](13-zone.md): cards placed by a layout.
- [Pile](14-pile.md): a deck or a discard pile.

Written per game, with the template as the reference:

- [Seats](15-seats.md): the ring and what stands on a seat.
- [Aura](16-aura.md): the light under a seat.
- [Crown and the turn marker](17-crown.md): who plays.
- [Seat avatar](18-seat-avatar.md): the picture beside a nickname.
- [Text on the table](19-text-on-the-table.md): nicknames, points, counters.
- [Clicks and hover](20-clicks-and-hover.md): how the scene takes the pointer.
- [Turn change](21-turn-change.md): what follows when the turn passes.
- [Opening and ending](22-opening-and-ending.md): the sequences around a game.

Putting it together:

- [Composing a board](23-composing-a-board.md): the files of a board, what the game supplies, lazy loading.
- [Tuning](24-tuning.md): the settings objects and the debug panel.
- [Not in the package yet](25-limits.md): the limits, with their tickets.
