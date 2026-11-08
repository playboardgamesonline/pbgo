# Actions

An action is what a player sends: `{ type, ...fields }`, where the server sets `playerId`; on the board it starts as a click. Core receives it in the action route and hands it to the engine's `apply`; the types a client may send are the engine's `clientActions`.

## What reaches apply

The modifier of step 3 of [The life of an action](01-how-a-game-runs.md#the-life-of-an-action), from `packages/core/routes/api/games/[code]/action/route.ts`:

```ts
const row = await updateGame(game, params.code ?? "", (row) => {
  if (!row.state || row.status !== "playing") throw notPlaying(row)
  const state = GAME.apply(row.state, { ...action, playerId: id })
  return { state, status: GAME.isOver(state) ? "over" : "playing" }
})
```

- Core sets `playerId` to the caller's id, made from the secret of their cookie, whatever the body says, so a client cannot act for another player ([Where an id comes from](02-players.md#where-an-id-comes-from)).
- An `EngineError` ends the request before the write; any other error is logged and answers `SERVER_ERROR`.
- A table that is not in play is refused by `notPlaying` before `apply` runs: `GAME_OVER` when the game has ended, `GAME_NOT_STARTED` when it has not begun.

## What clientActions controls

- `clientActions` lists the action types a client may send; any other `type` is refused with `INVALID_ACTION` before `apply` runs.
- It filters, it does not validate: the rest of the body reaches `apply` as written. `debug` commands, `autoPlayFor` and `setup` do not go through the list.
- Type the list against the union so it cannot drift. From `games/flip-7/packages/engine/src/types.ts`:

  ```ts
  export const CLIENT_ACTIONS = ["hit", "stay", "target", "deal"] as const satisfies readonly Action["type"][]
  ```

## What `apply` checks

- Core checks nothing else, so `apply` checks the payload, that the player sits at the table and that the move is theirs.
- Flip 7's `perform` checks, in this order: the game is not over, the action is well formed, the game waits for the player, the action belongs to what the game waits for, then the rule itself.

## Errors

An engine refuses a move by throwing, and what the request does next depends on what it threw.

### Two kinds of errors

- A player's mistake (an illegal move, a move out of turn, a card they do not hold) is an `EngineError(code, message?)`. The answer carries the `code` only, so `message` is for tests and debugging. `isEngineError(error)` also accepts an engine's own class of the same shape (`name === "EngineError"` and a string `code`): `instanceof` alone misses it, since one app serves every game.
- A bug of the game (an id that does not exist, a pile too short, a position out of range) is a plain error: the kit's helpers throw `RangeError`. Validate the player's input first, so a `RangeError` never comes from a move.

### The shared codes

An engine refuses with a code of one vocabulary, `SHARED_ERROR_CODES` of the kit, whenever the refusal means the same in every game. The platform words each of them (`CORE_ERROR_MESSAGES` of core, English in the code), so an engine writes no message for them and its binding lists none.

| Code | The engine refuses because |
| --- | --- |
| `INVALID_PLAYERS` | The table cannot be played: a number of players outside the bounds, an empty id, the same id twice |
| `INVALID_ACTION` | The action is malformed, or is not one of the game's |
| `INVALID_PHASE` | The action is one of the game's, but the game is not at a stage that takes it |
| `GAME_OVER` | The game has ended: nothing more can be played |
| `NOT_YOUR_TURN` | The action belongs to another player, or to nobody |
| `NOT_WAITING` | The game does not wait for this player; the kit throws it too |
| `UNKNOWN_PLAYER` | The player is not at the table |
| `UNKNOWN_CARD` | The card is not in the player's hand |
| `INVALID_TARGET` | The player the action aims at cannot be chosen |
| `AUTOPLAY_UNSUPPORTED` | The engine cannot play for this player; the kit throws it |

- Take the code whose meaning is yours: `INVALID_ACTION` for an action that is wrong anywhere (an unknown type, a missing field), `INVALID_PHASE` for the right action at the wrong moment, `GAME_OVER` for any action once the game has ended.
- A refusal that only the game can explain, such as `CANNOT_STAY` in Flip 7, is a code of its own: throw it as a string literal and list it in the `ERROR_CODES` of the binding ([Error codes](../04-build-a-game/05-wiring-it-in.md#error-codes)).
- A game that keeps a list of everything its engine refuses with (`FLIP7_ERROR_CODES`, a comment per code) puts the shared codes in it too, and gives its binding the codes of its own: `FLIP7_ERROR_CODES.filter((code) => !isSharedErrorCode(code))`.

### What the player reads

- The client shows, in order: the message written in Sanity for the code (Setup › Copy › Errors), the platform's own message in the visitor's language, then `[missing: errorMessages.<CODE>]`. For a code the platform words, only a message written in the visitor's own language replaces it; for a code of the game, the language asked falls back on English.
- The platform words the shared codes and the codes of its own routes: the list is `CORE_ERROR_MESSAGES` (`packages/core/lib/api.ts`), English in the code. The other languages are `ERROR_TRANSLATIONS` of studio-kit; a message with no translation yet reads in English, and `ENGLISH_ONLY` in `language-chain.test.ts` lists those. A test keeps every shared code and every code that the routes of a game throw in the list.
- A game words its own codes through `ERROR_CODES` of its binding, which fills Setup › Copy › Errors. A listed code without a message is logged and reads `[missing: …]`; a code thrown and not listed has no message.

### Keeping the vocabulary honest

`errorVocabularyProblems` of `@pbgo/engine-kit/testing` reads the sources of an engine and says, in sentences, what is wrong with its codes: one that is neither shared nor listed, one whose `EngineError` takes a code that is not a string literal (nothing can read it), a shared code in `ERROR_CODES`, a code listed twice. It is a test of the binding, not of the engine. From `template/src/error-codes.test.ts`, which `pnpm new-game` copies into every game:

```ts
it("throws only the shared codes and the codes it lists, and lists only its own", () => {
  expect(errorVocabularyProblems({ engineDir: new URL("../packages/engine/src", import.meta.url), own: ERROR_CODES })).toEqual([])
})
```

## Clicks and hover

The scene takes the pointer through react-three-fiber events on meshes. `Card` is the shared piece that reports it; the rest is what a game adds. The template's `board/scene.tsx` is the reference.

| Piece | Events | Cursor |
| --- | --- | --- |
| `Card` | `onClick` and `onHover`, on its face, its rim and its back | A pointer while hovered, when it has an `onClick` |
| `TableText` | `onClick` and `onHover`, only when one is given | A pointer while hovered, when it has an `onClick` |
| `Seat`, with `onSelect` | `onClick`, `onPointerOver` and `onPointerOut` on an invisible plane over the plate, and the name's own `onClick` and `onHover`; the name, nearer, takes the pointer over its own area | A pointer while the plate is under the pointer |
| A click target the game adds | Its own handlers, on a mesh it draws | `useCursor` of drei |

- Everything that decorates takes no events. The picture of the table, the parts of a glow, the shadow and the shine of a card, `Aura`, `SeatAvatarMesh` and `TurnCrown` all set `raycast={() => null}`. A decoration a game adds does the same, or it steals the click from what lies under it.
- A hovered card stops the event, so only the front-most card is hovered. A click handler stops it too, so the click does not also reach what lies behind: the template's does.
- Hover is reported, not shown. The game keeps the id of the hovered card, moves the pose (`shifted`) and sets `glow` or `gloss`. The template lifts the hovered card of the hand and gives it the selection glow, on the viewer's turn only.
- A card the viewer may not click has no `onClick`, and its cursor stays an arrow: the template passes `onClick` only on the viewer's turn.
- `Table` has no prop for a click on empty space; the `onPointerMissed` of its canvas is not passed on.
- Hover has no touch equivalent: game pages are desktop only ([Desktop only](../../design/04-in-game/01-screens-and-game-flow.md#desktop-only)).
- A place on the table that the player clicks, such as a column of the board or a player's area, is not a shared piece. It is a flat mesh over the table with `onClick`, `onPointerOver`, `onPointerOut` and `useCursor`, drawn only while the move is possible. A board that has them: `ClickableZone`, an invisible plane just above a zone, in `games/courtisans/src/components/game3d/scene.tsx`, and `Column`, a glowing rectangle on the table, in `column.tsx` of the same folder.
