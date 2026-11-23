import { type Rng, createRng } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import type { Action, GameState, Target } from "./types"

/**
 * Golden seeds: ten whole games, played by a scripted bot, and what each one ends on. They are written once, before the engine is rewritten on the kit, and they must
 * hold across the whole rewrite (lean state, the missions in the engine, the contract): the rules, the deal and the scoring are the same whatever the state looks like.
 *
 * The bot plays through the public view and the engine's `apply`, with a stream of its own, so that nothing of the engine's own automatic play (which the rewrite changes) is in
 * the result: only the deal (the seed), the missions and the rules. What the games end on is written as plain facts, a line for each player, never the ids of the cards.
 *
 * The missions are the engine's own. The expected facts were written with the twenty missions as the game's Sanity project had them, in the order the engine now lists them, so that the
 * draw of each player's two missions and what each one is worth are the ones the games had before the rules of the missions moved into the engine.
 */

/** What a game ends on, as plain facts. */
type Summary = {
  /** How many cards were played. */
  plays: number
  /** The turn the game ended on. */
  turns: number
  winners: string[]
  /** By family, in the order of the table: the weight above the mat, the weight below it and the standing that gives. */
  families: string[]
  /** One line for each player, in the order of the results: rank, total, domain points, the weight of their families and their two missions. */
  players: string[]
}

/** The bot's move: a card of the hand picked at random, the first zone still free, a level or an opponent picked at random, and for an assassin the first card that is not a guard. */
function move(state: GameState, rng: Rng): Action {
  const active = GAME.view(state, null).activePlayerId!
  const view = GAME.view(state, active)
  const hand = view.me!.hand
  const card = hand[Math.floor(rng() * hand.length)]!
  const zone = view.availableZones[0]!
  const opponents = view.players.filter((player) => player.id !== active)
  const target: Target =
    zone === "table"
      ? { zone: "table", level: rng() < 0.5 ? "up" : "down" }
      : { zone: "domain", playerId: zone === "domain" ? active : opponents[Math.floor(rng() * opponents.length)]!.id }
  let victimId: string | undefined
  if (card.role === "assassin") {
    const cards = target.zone === "table" ? view.table.map((placement) => placement.card) : view.players.find((player) => player.id === target.playerId)!.domain
    victimId = cards.find((candidate) => candidate.role !== "guard")?.id
  }
  return { type: "playCard", playerId: active, cardId: card.id, target, ...(victimId === undefined ? {} : { victimId }) }
}

function play(seed: number, count: number): Summary {
  const rng = createRng(seed * 31 + count)
  const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, nickname: `Player ${i}` }))
  let state = GAME.setup({ players, options: {}, seed })
  for (const { id } of players) state = GAME.apply(state, { type: "readMissions", playerId: id })

  let plays = 0
  while (!GAME.isOver(state)) {
    state = GAME.apply(state, move(state, rng))
    if (++plays > 500) throw new Error("The game does not end")
  }

  const view = GAME.view(state, null)
  const results = view.results!
  return {
    plays,
    turns: view.turnNumber,
    winners: results.winners,
    families: Object.entries(results.statuses).map(([family, { up, down, status }]) => `${family} ${up}-${down} ${status}`),
    players: results.players.map((player) => {
      const families = player.families.map((family) => `${family.family}:${family.weight}:${family.points}`).join(" ")
      const missions = player.missions.map((mission) => `${mission.missionId}:${mission.done ? "done" : "failed"}`).join(" ")
      return `${player.playerId} rank ${player.rank} total ${player.total} domain ${player.domainPoints} [${families}] ${missions}`
    }),
  }
}

/** The tables the games are played at, one for each seed. */
const GAMES: { seed: number; players: number }[] = [
  { seed: 1, players: 2 },
  { seed: 2, players: 3 },
  { seed: 3, players: 4 },
  { seed: 4, players: 5 },
  { seed: 5, players: 2 },
  { seed: 6, players: 3 },
  { seed: 7, players: 4 },
  { seed: 8, players: 5 },
  { seed: 9, players: 3 },
  { seed: 10, players: 4 },
]

const EXPECTED: Summary[] = [
  // seed 1, 2 players
  {
    plays: 60,
    turns: 20,
    winners: ["p1"],
    families: [
      "butterfly 6-0 light",
      "toad 0-2 disgrace",
      "nightingale 1-3 disgrace",
      "hare 2-1 light",
      "stag 1-1 neutral",
      "carp 1-4 disgrace",
    ],
    players: [
      "p1 rank 1 total 6 domain 0 [butterfly:2:2 toad:2:-2 nightingale:3:-3 hare:6:6 stag:3:0 carp:3:-3] mission-light-9:done mission-dark-8:done",
      "p0 rank 2 total 0 domain -3 [butterfly:3:3 toad:6:-6 nightingale:1:-1 hare:4:4 stag:3:0 carp:3:-3] mission-light-8:failed mission-dark-6:done",
    ],
  },
  // seed 2, 3 players
  {
    plays: 72,
    turns: 24,
    winners: ["p2"],
    families: [
      "butterfly 3-0 light",
      "toad 2-2 neutral",
      "nightingale 3-1 light",
      "hare 3-2 light",
      "stag 3-1 light",
      "carp 2-3 disgrace",
    ],
    players: [
      "p2 rank 1 total 14 domain 14 [butterfly:5:5 nightingale:4:4 hare:2:2 stag:4:4 carp:1:-1] mission-light-5:failed mission-dark-5:failed",
      "p1 rank 2 total 10 domain 10 [butterfly:1:1 toad:3:0 nightingale:3:3 hare:5:5 stag:4:4 carp:3:-3] mission-light-10:failed mission-dark-4:failed",
      "p0 rank 3 total 7 domain 7 [butterfly:4:4 toad:6:0 nightingale:3:3 stag:3:3 carp:3:-3] mission-light-1:failed mission-dark-9:failed",
    ],
  },
  // seed 3, 4 players
  {
    plays: 84,
    turns: 28,
    winners: ["p2", "p3"],
    families: [
      "butterfly 1-1 neutral",
      "toad 2-3 disgrace",
      "nightingale 2-4 disgrace",
      "hare 4-3 light",
      "stag 1-4 disgrace",
      "carp 5-1 light",
    ],
    players: [
      "p2 rank 1 total 7 domain 4 [butterfly:4:0 toad:1:-1 nightingale:3:-3 hare:5:5 carp:3:3] mission-light-7:failed mission-dark-8:done",
      "p3 rank 1 total 7 domain 1 [butterfly:2:0 toad:2:-2 nightingale:1:-1 hare:4:4 stag:4:-4 carp:4:4] mission-light-2:done mission-dark-7:done",
      "p0 rank 3 total -6 domain -9 [butterfly:3:0 toad:1:-1 nightingale:5:-5 stag:5:-5 carp:2:2] mission-light-10:failed mission-dark-10:done",
      "p1 rank 4 total -7 domain -7 [butterfly:3:0 toad:4:-4 nightingale:3:-3 hare:1:1 stag:2:-2 carp:1:1] mission-light-6:failed mission-dark-9:failed",
    ],
  },
  // seed 4, 5 players
  {
    plays: 90,
    turns: 30,
    winners: ["p0"],
    families: [
      "butterfly 1-4 disgrace",
      "toad 1-1 neutral",
      "nightingale 3-1 light",
      "hare 6-1 light",
      "stag 4-3 light",
      "carp 5-4 light",
    ],
    players: [
      "p0 rank 1 total 12 domain 9 [toad:1:0 nightingale:1:1 hare:2:2 stag:3:3 carp:3:3] mission-light-4:done mission-dark-4:failed",
      "p3 rank 2 total 10 domain 7 [toad:4:0 nightingale:3:3 hare:2:2 stag:1:1 carp:1:1] mission-light-7:failed mission-dark-5:done",
      "p2 rank 3 total 8 domain 8 [butterfly:3:-3 toad:1:0 nightingale:4:4 hare:1:1 stag:3:3 carp:3:3] mission-light-5:failed mission-dark-2:failed",
      "p1 rank 4 total 7 domain 4 [butterfly:4:-4 toad:2:0 nightingale:2:2 hare:4:4 carp:2:2] mission-light-6:done mission-dark-1:failed",
      "p4 rank 5 total 4 domain 4 [butterfly:4:-4 toad:4:0 nightingale:4:4 hare:1:1 stag:3:3] mission-light-9:failed mission-dark-8:failed",
    ],
  },
  // seed 5, 2 players
  {
    plays: 60,
    turns: 20,
    winners: ["p0"],
    families: [
      "butterfly 1-3 disgrace",
      "toad 2-0 light",
      "nightingale 2-0 light",
      "hare 3-1 light",
      "stag 4-3 light",
      "carp 0-1 disgrace",
    ],
    players: [
      "p0 rank 1 total 18 domain 15 [butterfly:2:-2 toad:10:10 nightingale:3:3 hare:2:2 stag:3:3 carp:1:-1] mission-light-6:done mission-dark-4:failed",
      "p1 rank 2 total 5 domain 5 [butterfly:5:-5 toad:3:3 nightingale:4:4 hare:5:5 stag:3:3 carp:5:-5] mission-light-4:failed mission-dark-9:failed",
    ],
  },
  // seed 6, 3 players
  {
    plays: 72,
    turns: 24,
    winners: ["p0", "p2"],
    families: [
      "butterfly 2-2 neutral",
      "toad 7-1 light",
      "nightingale 2-0 light",
      "hare 4-1 light",
      "stag 3-0 light",
      "carp 2-6 disgrace",
    ],
    players: [
      "p0 rank 1 total 11 domain 8 [butterfly:2:0 toad:5:5 nightingale:3:3 hare:1:1 stag:4:4 carp:5:-5] mission-light-8:done mission-dark-5:failed",
      "p2 rank 1 total 11 domain 8 [butterfly:4:0 toad:1:1 nightingale:3:3 hare:1:1 stag:5:5 carp:2:-2] mission-light-3:done mission-dark-2:failed",
      "p1 rank 3 total 7 domain 7 [butterfly:2:0 toad:3:3 nightingale:1:1 hare:4:4 stag:2:2 carp:3:-3] mission-light-7:failed mission-dark-6:failed",
    ],
  },
  // seed 7, 4 players
  {
    plays: 84,
    turns: 28,
    winners: ["p3"],
    families: [
      "butterfly 0-4 disgrace",
      "toad 1-3 disgrace",
      "nightingale 2-3 disgrace",
      "hare 3-0 light",
      "stag 2-3 disgrace",
      "carp 1-6 disgrace",
    ],
    players: [
      "p3 rank 1 total -1 domain -7 [butterfly:3:-3 toad:3:-3 nightingale:1:-1 hare:3:3 stag:2:-2 carp:1:-1] mission-light-2:done mission-dark-10:done",
      "p2 rank 2 total -5 domain -8 [butterfly:1:-1 toad:3:-3 nightingale:1:-1 hare:3:3 stag:3:-3 carp:3:-3] mission-light-9:failed mission-dark-5:done",
      "p0 rank 3 total -9 domain -12 [butterfly:6:-6 toad:3:-3 nightingale:3:-3 hare:4:4 stag:3:-3 carp:1:-1] mission-light-7:failed mission-dark-9:done",
      "p1 rank 4 total -11 domain -14 [butterfly:1:-1 toad:5:-5 nightingale:5:-5 hare:2:2 carp:5:-5] mission-light-6:failed mission-dark-7:done",
    ],
  },
  // seed 8, 5 players
  {
    plays: 90,
    turns: 30,
    winners: ["p2"],
    families: [
      "butterfly 1-2 disgrace",
      "toad 2-7 disgrace",
      "nightingale 4-1 light",
      "hare 6-3 light",
      "stag 1-7 disgrace",
      "carp 5-1 light",
    ],
    players: [
      "p2 rank 1 total 6 domain 3 [butterfly:4:-4 toad:2:-2 nightingale:1:1 hare:4:4 carp:4:4] mission-light-1:failed mission-dark-3:done",
      "p0 rank 2 total 5 domain 5 [nightingale:3:3 hare:2:2 stag:1:-1 carp:1:1] mission-light-7:failed mission-dark-6:failed",
      "p3 rank 2 total 5 domain -1 [butterfly:6:-6 toad:1:-1 nightingale:3:3 hare:1:1 stag:1:-1 carp:3:3] mission-light-9:done mission-dark-7:done",
      "p1 rank 4 total 4 domain 1 [butterfly:2:-2 toad:2:-2 nightingale:2:2 hare:3:3 stag:2:-2 carp:2:2] mission-light-10:failed mission-dark-9:done",
      "p4 rank 5 total -3 domain -6 [butterfly:3:-3 toad:2:-2 nightingale:1:1 stag:3:-3 carp:1:1] mission-light-8:failed mission-dark-8:done",
    ],
  },
  // seed 9, 3 players
  {
    plays: 72,
    turns: 24,
    winners: ["p2"],
    families: [
      "butterfly 2-2 neutral",
      "toad 2-3 disgrace",
      "nightingale 0-4 disgrace",
      "hare 4-3 light",
      "stag 4-0 light",
      "carp 2-0 light",
    ],
    players: [
      "p2 rank 1 total 9 domain 6 [butterfly:2:0 toad:2:-2 nightingale:3:-3 hare:2:2 stag:5:5 carp:4:4] mission-light-3:failed mission-dark-8:done",
      "p0 rank 2 total 8 domain 5 [butterfly:2:0 toad:2:-2 nightingale:4:-4 hare:4:4 stag:4:4 carp:3:3] mission-light-7:done mission-dark-4:failed",
      "p1 rank 3 total 3 domain 0 [butterfly:2:0 toad:1:-1 nightingale:6:-6 hare:2:2 stag:2:2 carp:3:3] mission-light-1:done mission-dark-1:failed",
    ],
  },
  // seed 10, 4 players
  {
    plays: 84,
    turns: 28,
    winners: ["p1"],
    families: [
      "butterfly 0-3 disgrace",
      "toad 3-3 neutral",
      "nightingale 4-2 light",
      "hare 1-2 disgrace",
      "stag 1-5 disgrace",
      "carp 5-2 light",
    ],
    players: [
      "p1 rank 1 total 7 domain 4 [butterfly:3:-3 toad:1:0 nightingale:7:7 stag:2:-2 carp:2:2] mission-light-5:failed mission-dark-8:done",
      "p0 rank 2 total 3 domain -3 [butterfly:3:-3 toad:3:0 nightingale:2:2 hare:1:-1 stag:1:-1] mission-light-2:done mission-dark-5:done",
      "p2 rank 3 total 0 domain -3 [butterfly:3:-3 toad:6:0 nightingale:3:3 hare:2:-2 stag:3:-3 carp:2:2] mission-light-4:done mission-dark-1:failed",
      "p3 rank 4 total -6 domain -9 [butterfly:2:-2 toad:2:0 nightingale:1:1 hare:8:-8 stag:2:-2 carp:2:2] mission-light-1:failed mission-dark-4:done",
    ],
  },
]

describe("golden seeds", () => {
  it.each(GAMES.map((game, i) => [game.seed, game.players, i] as const))("ends seed %i at %i players on the same facts", (seed, count, i) => {
    expect(play(seed, count)).toEqual(EXPECTED[i])
  })
})
