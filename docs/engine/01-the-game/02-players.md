# Players

To the engine a player is an id and a nickname, `PlayerInfo` in `packages/engine-kit/src/contract.ts`; to the app a player is a seat at a table and a cookie. Core makes the ids (`packages/core/server/player-id.ts`, `packages/core/server/player.ts`) and keeps the seats, which a board reads as `PublicGame.players` (`packages/core/lib/game-types.ts`); the engine keeps the order, who is out and what each seat holds. Where a seat is on the board is in [Seats](../02-components/03-seats.md).

## The seats

- `setup` receives `players` as `{ id, nickname }` and nothing more, in the order the players sat down (`GameRow.players`): a join goes last, a leave closes the gap and a rematch keeps the order.
- A nickname is never empty and never longer than `NICKNAME_MAX` when it reaches `setup` (`packages/core/server/profile.ts`); the picture of an account stays in `PublicGame.players` (`avatarUrl`) and never reaches `setup`.
- A lean state keeps the ids: a board takes names, colours and pictures from the table's `players` with `nickname(id)`, `color(id)` and `avatarUrl(id)` of `useGame()` (`packages/core/components/game/context.tsx`).
- `setup` refuses a table it cannot play with `EngineError("INVALID_PLAYERS")`: a count outside its bounds, an empty id or the same id twice.
- Core holds a table to `minPlayers` and `maxPlayers`: `join` answers `GAME_FULL` past the maximum and `start` answers `NOT_ENOUGH_PLAYERS` under the minimum. The gamemaster narrows both in Setup › Mechanics, and `clampPlayers` (`packages/core/lib/settings.ts`) keeps them inside the engine's, so they never widen.

## Where an id comes from

- The browser keeps a random secret in the cookie `<slug>_player`, one per game and `httpOnly`; a character of the slug other than a letter or a digit becomes `_` in the name.
- The id every table shows is made from the secret and the slug by `playerIdOf`, and it is the same at every table of the game.
- Only the server makes a secret (`newPlayerSecret`), and only the create and join routes write the cookie (`getOrCreatePlayerId`); every other route reads the id with `getPlayerId`, which is `null` for a browser with no secret.
- The id is public and proves nothing: the server takes only a secret for a cookie (`isPlayerSecret`), so an id sent back as the cookie identifies nobody.
- A request cannot name its player: the action route sets the `playerId` of the action to the caller's id ([What reaches apply](05-actions.md#what-reaches-apply)).
- A signed-in visitor sits down as their account: the name and the picture their provider gives, read on the server from the session and never from the request, the picture only as an `https` address (`resolveProfile`). A guest sits down under the nickname they typed and has no picture, so the avatar is generated. An account never gives the id.

From `packages/core/server/player-id.ts`, the id of a secret:

```ts
export const playerIdOf = (slug: string, secret: string): string =>
  createHash("sha256").update(`pbgo:player:${slug}:${secret}`).digest("hex").slice(0, 32)
```

## The viewer

- `view` gets the id of a player who sits at the table and `null` for everybody else, a signed-in account included; `PublicGame.meId` is the same id ([What is public](10-views.md#what-is-public)).
- The view tells the board who it is for in `me`, `null` for a spectator; core reads `view.me?.id` for the ticker's "your turn" and the takeover pill ([What core reads from a view](10-views.md#what-core-reads-from-a-view)).
- Who is present at a table, and the vote to play for a player who left, are core's ([Absent players](03-turns.md#absent-players-in-core)).

## Leaving a table

- A player can leave a table that waits for players or is starting: `POST /api/<slug>/games/<code>/leave` (`packages/core/routes/api/games/[code]/leave/route.ts`) takes them off `players` and hands the host's place to the first seat left when the host goes. Leaving a table in its ready check ends the check for everybody, since the game was set up for the seats it had.
- Once the game runs the route changes nothing. A player who walks away is an absent player, and the others vote to play for them when the game waits for them ([Absent players](03-turns.md#absent-players-in-core)). Giving up a game that runs is not built ([Not built yet](../03-not-built-yet.md)).
- The engine never sees a leave: `setup` is given the seats the table has when it starts.

## Players who are out

A player can be out while the table goes on, of the game or of a round. The state keeps it, the rules read it and the view shows it. The kit has nothing for it and core does not know of it: a player who is out stays in `PublicGame.players`, counts as present while their board reads the table and stays among the voters a takeover requires (`requiredVoters` in `packages/core/server/takeover.ts`).

- Out of the game: Exploding Kittens lists the eliminated in `out`, in the order they left, and keeps their seats so that the lists by seat (`hands`, `stats`) keep their indexes. The last player in wins, and `results` ranks the others from the last one out.
- Out of a round: Flip 7 holds a `Status` per seat (`active`, `stayed`, `frozen`, `busted`), which `startRound` sets back to `active`; `nextActive` passes over the seats that are not active, and the round ends when it finds none.
- `waitingFor` names the players who can still act, and a rule that names a player who is out refuses it (`hasCards` in Exploding Kittens, with `INVALID_TARGET`).
- The view says who is out: Exploding Kittens gives each player an `alive` flag and gives a player who is out `me: null`, the view of a spectator; Flip 7 gives each seat its `status`.
- No board draws a status: the two games with a board, Courtisans and the template, never put a player out.

## The order around the table

The order of the seats is the order of an array of the state: `seats` in Exploding Kittens and Flip 7, `players` in Courtisans and in the template's demo. The turn, the deal and the neighbours are all computed from it.

- The array is the only source of order ([Every order comes from an array](09-state.md#every-order-comes-from-an-array)): every list per player is aligned with it (`hands`, `lines`, `status`, `rounds[round][seat]`), and `seatOf` gives the index of a player.
- The seats run clockwise: seat `n + 1` is on the left of seat `n`, and the turn passes to the left. No engine of the repo reverses the order and the kit has no helper for the next seat: each engine writes `(seat + 1) % n` and decides whom to pass over, such as the players who are out.
- Core does not shuffle the seats: the engine draws the first player from the seed in `setup` (`turn` in Exploding Kittens, `dealer` in Flip 7, `activePlayer` in Courtisans, `roundLeader` in the demo). The dealer of Flip 7 is a seat that `endRound` hands to the left.
- A neighbour is the seat next to another, the modulo wrapping both ends: the left one is the next seat, the right one the previous, and at a table of two both are the other player (`leftNeighbor` and `rightNeighbor` of the missions of Courtisans).
- Core colours a seat by its place in `PublicGame.players` (`seatColor`), the order `setup` received, and a board hands the players in seat order and the viewer's index to `seats` ([Seats](../02-components/03-seats.md)).

From `games/flip-7/packages/engine/src/machine.ts`, the seat that plays after `from`, `from` itself last:

```ts
export function nextActive(s: State, from: number): number | null {
  const n = s.seats.length
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n
    if (isActive(s, seat)) return seat
  }
  return null
}
```
