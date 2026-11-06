# Composing a board

A board is the files of `board/` plus the component that mounts them. The template's are the reference: `template/src/components/board/` and `template/src/components/game/game.tsx`.

## The files

```text
src/ui.tsx                        exports Game, loaded on demand
src/components/game/game.tsx      the HUD around the board; loads Scene on demand
src/components/board/
├── scene.tsx                     Scene (the Table) and World (what lies on it)
├── layout.ts                     where things go: poses and seats
├── camera.ts                     CAMERA and PHOTO, with their knobs
├── textures.ts                   CARD_SIZE, the faces, the back, the mat
├── glows.ts                      the glows of the cards
├── settings.ts                   useSettings, the bridge to the debug panel
└── aura.tsx, crown.tsx, seat-avatar-mesh.tsx, table-text.tsx
                                  the pieces of a seat and the text on the table
```

## What the game supplies

| What | Where in the template | Page |
| --- | --- | --- |
| The camera and the photo camera | `camera.ts`: `CAMERA`, `PHOTO` | [Camera](02-camera.md), [Share photo](05-share-photo.md) |
| The mat | `Surface` in `scene.tsx`, its picture `matTexture` in `textures.ts` | [Surface](04-surface.md) |
| The size of a card, its faces and its back | `textures.ts`: `CARD_SIZE`, `faceTexture`, `backTexture` | [Faces and textures](07-faces-and-textures.md) |
| The glows | `glows.ts` | [Glows](08-glows.md) |
| Where cards and seats go | `layout.ts` | [Layout helpers](12-layout-helpers.md), [Seats](15-seats.md) |
| The pieces of a seat | `aura.tsx`, `crown.tsx`, `seat-avatar-mesh.tsx`, `table-text.tsx` | [Seats](15-seats.md) |
| The knobs | `settings.ts`, with `LAYOUT_SETTINGS` in `layout.ts` | [Tuning](24-tuning.md) |
| The action a click sends | `game.tsx`: the handler passed down as `onPlay` | [Clicks and hover](20-clicks-and-hover.md) |

The shared tools supply the rest: the canvas, the camera and its entrance, the floor and the lights, the card and all it does, the zones, the pose memory and the share photo. A game does not copy them.

## How the view feeds the scene

1. `Game` of the binding receives the `PublicGame`. Its HUD hands `Scene` what it needs from the view and the player: the view, the seat colours, the avatar pictures, the skin's pieces, whether it is the viewer's turn and a handler to play.
2. `World` turns the view into poses and cards with the layouts, and renders them in zones. It holds no rule; what it keeps is presentation, such as the hovered card and the pause before a won trick is collected.
3. A click calls the handler. `game.tsx` posts the action and gives the answer to `onUpdate`, and the next view moves the cards.

- An opponent's hand is a count in the view, so the scene draws backs from `cardCount`, keyed by position. The cards the view names are keyed by their ids.
- A card the view does not name, such as an opponent's draw, is drawn as a card of its own that flies to a pose and goes away on `onArrive`: `Ephemeral` in `games/courtisans/src/components/game3d/scene.tsx`.
- The scene reads the view, never the state: it draws what the viewer may see ([What is public](../01-how-a-game-runs.md#what-is-public)).

## Lazy loading

- The binding loads `Game` with `dynamic` and no server render, in `src/ui.tsx`; `game.tsx` loads `Scene` the same way. All the three.js code enters the page with `Scene`.
- A game imports `@pbgo/table` from the files of `board/` only, never from `game.tsx`, so the chunk of the HUD stays free of it. The game's `package.json` lists it among its dependencies.
- The app lists `@pbgo/table` in `transpilePackages` (`apps/web/next.config.ts`), since the package ships TypeScript sources.
- The pages of the hub, the page of a game included, load none of it.

From `template/src/components/game/game.tsx`:

```tsx
const Scene = dynamic(() => import("../board/scene").then((m) => m.Scene), { ssr: false })
```
