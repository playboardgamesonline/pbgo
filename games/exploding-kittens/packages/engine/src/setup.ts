import { EngineError, type PlayerInfo, createSaveableRng, deal, issueIds, normalizeOptions, randomSeed, shuffle, sideSeed } from "@pbgo/engine-kit"
import { buildCatalogue } from "./catalogue"
import { cardType } from "./machine"
import type { Rules } from "./rules"
import type { State } from "./types"

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5

/** Salt of the stream of the card ids (see `sideSeed`): it never moves the stream of the shuffles. */
const IDS_STREAM = 1

/**
 * A new game, in the order of the booklet (see `SetupPlan`): the hands, the draw pile, who starts. Everything comes from `seed`
 * (drawn when missing): the same seed and the same options deal the same game.
 */
export function setupGame(rules: Rules, args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): State {
  const { players } = args
  const seats = Array.isArray(players) ? players.map((player) => player?.id) : []
  if (
    seats.length < MIN_PLAYERS ||
    seats.length > MAX_PLAYERS ||
    seats.some((id) => typeof id !== "string" || id === "") ||
    new Set(seats).size !== seats.length
  ) {
    throw new EngineError("INVALID_PLAYERS", `A table is ${MIN_PLAYERS} to ${MAX_PLAYERS} different players`)
  }
  const n = seats.length
  const options = normalizeOptions(rules.options, args.options, { playerCount: n })
  const seed = args.seed ?? randomSeed()
  const rng = createSaveableRng(seed)
  const idsRng = createSaveableRng(sideSeed(seed, IDS_STREAM))

  const types = buildCatalogue(rules, options)
  const ids = issueIds(types.length, idsRng)
  const plan = rules.plan(options, n)
  const idsOfKind = (wanted: (kind: string) => boolean) => ids.filter((_, i) => wanted(cardType(rules, types[i]!).kind))

  // 1. the Kittens and the Defuses are taken out, 2. each player gets their Defuses
  const defuses = shuffle(idsOfKind((kind) => kind === "defuse"), rng)
  const spare = defuses.slice(n * plan.defusesEach)
  // 3. some of the spare Defuses go back into the pool, the others leave the game
  const back = plan.defusesBack === "all" ? spare : spare.slice(0, plan.defusesBack)
  // 4. the pool is shuffled and dealt
  const pool = shuffle([...idsOfKind((kind) => kind !== "kitten" && kind !== "defuse"), ...back], rng)
  const dealt = deal(pool, n, plan.hand)
  const hands = dealt.hands.map((hand, seat) => [...defuses.slice(seat * plan.defusesEach, (seat + 1) * plan.defusesEach), ...hand])
  // faster game: a third of what is left disappears unseen (the pile is shuffled already: its top is a random third)
  const pile = plan.trim ? dealt.pile.slice(Math.floor(dealt.pile.length / 3)) : dealt.pile
  // 5. the Kittens go in (one fewer than players, the others leave the game), then the pile is shuffled
  const kittens = shuffle(idsOfKind((kind) => kind === "kitten"), rng).slice(0, plan.kittens)
  const deck = shuffle([...pile, ...kittens], rng)
  // 6. a random player starts
  const turn = Math.floor(rng() * n)

  return {
    options,
    seats: seats as string[],
    ids,
    idsRng: idsRng.save(),
    rng: rng.save(),
    deck,
    discard: [],
    hands,
    out: [],
    turn,
    owed: 1,
    attacked: false,
    known: {},
    stats: seats.map(() => ({ turns: 0, defused: 0, nopes: 0 })),
    phase: { kind: "turn" },
  }
}
