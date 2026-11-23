# Composing a board

A board is the files of `board/` plus the component that mounts them. The template's are the reference: `template/src/components/board/` and `template/src/components/game/game.tsx`.

## The files

```text
src/ui.tsx                        exports Game, loaded on demand
src/components/game/game.tsx      the HUD around the board; loads Scene on demand
src/components/board/
├── scene.tsx                     Scene (the Table) and World (what lies on it)
├── layout.ts                     where things go: poses and seats
├── camera.ts                     CAMERA and PHOTO (the table's debug panel makes their knobs)
├── textures.ts                   CARD_SIZE, the faces, the back, the mat of the table
└── crown.tsx, seat-avatar-mesh.tsx, table-text.tsx
                                  the pieces of a seat and the text on the table
```

## What the game supplies

| What | Where in the template | Page |
| --- | --- | --- |
| The camera and the photo camera | `camera.ts`: `CAMERA`, `PHOTO` | [Camera](../02-components/02-camera.md), [Share photo](../02-components/01-table.md#share-photo) |
| The table's colour, picture and light | The `surface` prop of `Table` in `scene.tsx`, fed by `MAT_COLOR`, `MAT_LAYERS` and `MAT_LIGHT` of `textures.ts` | [Surface](../02-components/01-table.md#surface) |
| The size of a card, its faces and its back | `textures.ts`: `CARD_SIZE`, `faceTexture`, `backTexture` | [Faces and textures](../02-components/04-cards.md#faces-and-textures) |
| Where cards and seats go | `layout.ts` | [Layout helpers](../02-components/08-layout-helpers.md), [Seats](../02-components/03-seats.md) |
| The pieces of a seat | `crown.tsx`, `seat-avatar-mesh.tsx`, `table-text.tsx` | [Seats](../02-components/03-seats.md) |
| The knobs of the layout | `LAYOUT_SETTINGS` in `layout.ts`, bound in `scene.tsx` with `useSettings` of `@pbgo/table` (the camera, the cards, the seats and the rest have theirs from the `Table`) | [Tuning](07-tuning.md) |
| The action a click sends | `game.tsx`: the handler passed down as `onPlay` | [Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover) |
| The hold of the start screen | `game.tsx`: `held` and `onLoaded`, handed to `Scene` and on to `Table` | [Table](../02-components/01-table.md), [Opening and ending](../01-the-game/06-victory.md#opening-and-ending) |

The shared tools supply the rest: the canvas, the camera and its entrance, the endless table and the lights, the card and all it does, the zones, the pose memory and the share photo. A game does not copy them.

## How the view feeds the scene

1. `Game` of the binding receives the `PublicGame`. Its HUD hands `Scene` what it needs from the view and the player: the view, the seat colours, the avatar pictures, the skin's pieces, whether it is the viewer's turn and a handler to play.
2. `World` turns the view into poses and cards with the layouts, and renders them in zones. It holds no rule; what it keeps is presentation, such as the hovered card and the pause before a won trick is collected.
3. A click calls the handler. `game.tsx` posts the action and gives the answer to `onUpdate`, and the next view moves the cards.

- An opponent's hand is a count in the view, so the scene draws a `HeldHand` from `cardCount`: the cards are named by a rule (the one played leaves from the left end, the one drawn comes in at the right end), not by position ([Held hands](../02-components/07-zones.md#held-hands)). The cards the view names are keyed by their ids.
- A card the view does not name, such as an opponent's draw, is drawn as a card of its own that flies to a pose and goes away on `onArrive`: `Ephemeral` in `games/courtisans/src/components/board/scene.tsx`.
- The scene reads the view, never the state: it draws what the viewer may see ([What is public](../01-the-game/10-views.md#what-is-public)).

## Lazy loading

- The binding loads `Game` with `dynamic` and no server render, in `src/ui.tsx`; `game.tsx` loads `Scene` the same way. All the three.js code enters the page with `Scene`.
- A game imports `@pbgo/table` from the files of `board/` only, never from `game.tsx`, so the chunk of the HUD stays free of it. The game's `package.json` lists it among its dependencies.
- The app lists `@pbgo/table` in `transpilePackages` (`apps/web/next.config.ts`), since the package ships TypeScript sources.
- The pages of the hub, the page of a game included, load none of it.

From `template/src/components/game/game.tsx`:

```tsx
const Scene = dynamic(() => import("../board/scene").then((m) => m.Scene), { ssr: false })
```

## Keeping a board on the kit

A board is drawn with the kit so that a change of the kit reaches every game. Nothing at run time says so, so the repository does ([Scripts](../../scripts.md)):

- **What a board loads of the kit** is read from the source. `pnpm check:kit` lists the files of `@pbgo/table` by the boards that load them, and `pnpm check:kit Card`, or a file such as `seat/seat.tsx`, says which boards an edit of it changes. Ask it before a change of the kit.
- **What every table is made of** is loaded by every board: the `Table`, its camera, the mat, the card, the zone, the plate of a player and the text on the table. The test of the boards (`packages/games/src/boards.test.ts`) fails when a board stops loading one of them: draw with the kit's piece again. A game with no use for a piece, no cards say, is listed there with its reason.
- **What a board draws with three.js itself** is listed. A scene element other than `group` (a `mesh`, a `planeGeometry`) or a hook of react-three-fiber (`useFrame`, `useThree`) in a board is a piece the kit lacks or a copy of one it has: `pnpm check:game` warns of it, and the test fails for a board that writes one that is not in its list (`OWN_DRAWING`). Look for the piece in these pages first; when there is none, ask for it; when the thing is only this game's, add it to the list with the reason.
- **The boundary is linted**: only a game's `src/components/board` imports `@pbgo/table`, three.js and react-three-fiber, and no board opens a `Canvas` of its own, since the `Table` does.
