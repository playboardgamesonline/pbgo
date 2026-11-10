import {
  type GameDefinition,
  type OptionDefinitions,
  type Results,
  type SetupArgs,
  EngineError,
  allSubmitted,
  assertPlayers,
  createRng,
  normalizeOptions,
  openSubmissions,
  pendingSubmissions,
  shuffle,
  submit,
  submittedFlags,
} from "@pbgo/engine-kit"
import { type Action, type Card, CARD_COLORS, type DemoOptions, type DemoStep, type GameEvent, MAX_VALUE, type PlayerState, type PlayerView, type State } from "./types"

type PlayCard = Extract<Action, { type: "playCard" }>
type Bid = Extract<Action, { type: "bid" }>

// The options name no text: their words (`option.rounds.label`, `option.handSize.help`…) are written in the game's Sanity, in every language of the game
export const DEMO_OPTIONS: OptionDefinitions = {
  rounds: { type: "number", defaultValue: 3, min: 1, max: 5 },
  handSize: { type: "number", defaultValue: 5, min: 3, max: 8 },
  inverse: { type: "boolean", defaultValue: false },
  bids: { type: "boolean", defaultValue: true },
}

const DECK: Card[] = CARD_COLORS.flatMap((color) => Array.from({ length: MAX_VALUE }, (_, i) => ({ id: `${color}-${i + 1}`, color, value: i + 1 })))

/** Ids of the players in seat order: the order of every list of players the engine builds (an object's keys do not keep it in the stored state) */
const seats = (state: State) => state.players.map((j) => j.id)

/** A move that says what it did: the new state and the events, each one public (none is for some players only). */
const say = (state: State, ...events: GameEvent[]): DemoStep => ({ state, events: events.map((event) => ({ event })) })

const addPoint = (player: PlayerState): PlayerState => ({
  ...player,
  pointsPerRound: player.pointsPerRound.map((p, m) => (m === player.pointsPerRound.length - 1 ? p + 1 : p)),
})

function deal(state: State): State {
  const rng = createRng(state.seed + state.round * 7919)
  const deck = shuffle(DECK, rng)
  const size = Math.min(state.options.handSize, Math.floor(DECK.length / state.players.length))
  return {
    ...state,
    players: state.players.map((j, i) => ({ ...j, hand: deck.slice(i * size, (i + 1) * size), pointsPerRound: [...j.pointsPerRound, 0] })),
    activePlayer: state.roundLeader,
    trick: [],
    // every round opens with the simultaneous step when the option is on
    phase: state.options.bids ? "bidding" : "playing",
    bids: state.options.bids ? openSubmissions(seats(state)) : {},
  }
}

function trickWinner(trick: State["trick"], inverse: boolean) {
  return trick.reduce((best, p) => ((inverse ? p.card.value < best.card.value : p.card.value > best.card.value) ? p : best))
}

/** A simultaneous step: everybody answers in any order, and the step ends inside the action of the last one, so the state never sits between two phases. */
function bid(state: State, action: Bid): State {
  if (state.phase !== "bidding") throw new EngineError("INVALID_PHASE")
  const player = state.players.find((j) => j.id === action.playerId)
  if (!player) throw new EngineError("UNKNOWN_PLAYER")
  if (!Number.isInteger(action.amount) || action.amount < 0 || action.amount > player.hand.length) throw new EngineError("INVALID_BID")
  // a bid can be changed until the last player has bid
  const bids = submit(state.bids, player.id, action.amount)
  return allSubmitted(bids) ? { ...state, bids, phase: "playing" } : { ...state, bids }
}

/** +1 point for each exact bid: the points of the round at this stage are the tricks the player won */
function scoreBids(state: State): State {
  if (!state.options.bids) return state
  return { ...state, players: state.players.map((j) => (j.pointsPerRound.at(-1) === state.bids[j.id] ? addPoint(j) : j)) }
}

function playCard(state: State, action: PlayCard): DemoStep {
  if (state.phase !== "playing") throw new EngineError("INVALID_PHASE")
  const index = state.players.findIndex((j) => j.id === action.playerId)
  if (index < 0) throw new EngineError("UNKNOWN_PLAYER")
  if (index !== state.activePlayer) throw new EngineError("NOT_YOUR_TURN")
  const player = state.players[index]!
  const card = player.hand.find((c) => c.id === action.cardId)
  if (!card) throw new EngineError("UNKNOWN_CARD")

  const played: GameEvent = { type: "cardPlayed", playerId: player.id, card }
  let nextOne: State = {
    ...state,
    players: state.players.map((j, i) => (i === index ? { ...j, hand: j.hand.filter((c) => c.id !== card.id) } : j)),
    trick: [...state.trick, { playerId: player.id, card }],
    activePlayer: (index + 1) % state.players.length,
  }
  if (nextOne.trick.length < nextOne.players.length) return say(nextOne, played)

  const winner = trickWinner(nextOne.trick, nextOne.options.inverse)
  const winnerIndex = nextOne.players.findIndex((j) => j.id === winner.playerId)
  const won: GameEvent = { type: "trickWon", playerId: winner.playerId, cards: nextOne.trick.map((p) => p.card) }
  nextOne = {
    ...nextOne,
    players: nextOne.players.map((j, i) => (i === winnerIndex ? addPoint(j) : j)),
    lastTrick: { cards: nextOne.trick, winnerId: winner.playerId },
    trick: [],
    activePlayer: winnerIndex,
  }
  if (nextOne.players.some((j) => j.hand.length > 0)) return say(nextOne, played, won)

  nextOne = scoreBids(nextOne)
  if (nextOne.round >= nextOne.options.rounds) return say({ ...nextOne, phase: "over" }, played, won)
  const round = nextOne.round + 1
  return say(deal({ ...nextOne, round, roundLeader: (nextOne.roundLeader + 1) % nextOne.players.length }), played, won, { type: "newRound", round })
}

export function results(state: State): Results {
  const totals = state.players.map((j) => ({ playerId: j.id, total: j.pointsPerRound.reduce((a, b) => a + b, 0), j }))
  const best = Math.max(...totals.map((t) => t.total))
  return {
    players: totals
      .map((t) => ({
        playerId: t.playerId,
        total: t.total,
        rank: 1 + totals.filter((o) => o.total > t.total).length,
        // One line per round: its words (`score.round`, "Round {n}") are written in the game's Sanity, the engine gives the key and the number
        detail: t.j.pointsPerRound.map((points, m) => ({ key: "round", values: { n: m + 1 }, points })),
      }))
      .sort((a, b) => a.rank - b.rank),
    winners: totals.filter((t) => t.total === best).map((t) => t.playerId),
  }
}

/** Public: who the game waits for. Never drop a player from it when that would reveal something hidden. */
function waiting(state: State): string[] {
  if (state.phase === "bidding") return pendingSubmissions(state.bids, seats(state))
  if (state.phase === "playing") return [state.players[state.activePlayer]!.id]
  return []
}

function autoMove(state: State): DemoStep {
  const player = state.players[state.activePlayer]!
  return playCard(state, { type: "playCard", playerId: player.id, cardId: player.hand[0]!.id })
}

/** Completes the current step of one waiting player, and says what it did. Deterministic: no random draw, so that a replay stays exact. */
function autoPlayStep(state: State, playerId: string): DemoStep {
  if (!waiting(state).includes(playerId)) throw new EngineError("NOT_WAITING")
  if (state.phase !== "bidding") return autoMove(state)
  // the average number of tricks per player
  const hand = state.players.find((j) => j.id === playerId)!.hand
  return say(bid(state, { type: "bid", playerId, amount: Math.floor(hand.length / state.players.length) }))
}

function autoBids(state: State): State {
  let e = state
  while (e.phase === "bidding") e = autoPlayStep(e, waiting(e)[0]!).state
  return e
}

/** A new game, and what happened while it was set up: the first round is dealt. */
function setupStep({ players, options, seed = Math.floor(Math.random() * 2 ** 31) }: SetupArgs): DemoStep {
  assertPlayers(players, { min: 2, max: 6 })
  const opts = normalizeOptions(DEMO_OPTIONS, options) as DemoOptions
  const state = deal({
    seed,
    options: opts,
    players: players.map((j) => ({ id: j.id, hand: [], pointsPerRound: [] })),
    round: 1,
    roundLeader: Math.floor(createRng(seed)() * players.length),
    activePlayer: 0,
    trick: [],
    lastTrick: null,
    phase: "playing",
    bids: {},
  })
  return say(state, { type: "newRound", round: 1 })
}

/** Plays an action, and says what it did: the moves that matter to a player's history are the events of the log. */
function step(state: State, action: Action): DemoStep {
  if (action.type === "playCard") return playCard(state, action)
  if (action.type === "bid") return say(bid(state, action))
  throw new EngineError("INVALID_ACTION")
}

export const demo: GameDefinition<State, Action, PlayerView, undefined, GameEvent> = {
  id: "demo",
  name: "La Plus Haute",
  minPlayers: 2,
  maxPlayers: 6,
  options: DEMO_OPTIONS,
  scoreLines: ["round"],
  clientActions: ["bid", "playCard"],
  waitingFor: waiting,
  autoPlayFor: (state, playerId) => autoPlayStep(state, playerId).state,
  autoPlayStep,
  setup: (args) => setupStep(args).state,
  setupStep,
  apply: (state, action) => step(state, action).state,
  step,
  view: (state, playerId): PlayerView => {
    const me = state.players.find((j) => j.id === playerId)
    const hasBid = submittedFlags(state.bids)
    return {
      phase: state.phase,
      options: state.options,
      round: state.round,
      // my own bid is mine to see, the others' stay hidden until the step is over
      me: me ? { id: me.id, hand: me.hand, bid: state.bids[me.id] ?? null } : null,
      players: state.players.map((j) => ({
        id: j.id,
        cardCount: j.hand.length,
        points: j.pointsPerRound.reduce((a, b) => a + b, 0),
        pointsPerRound: j.pointsPerRound,
        hasBid: hasBid[j.id] ?? false,
        bid: state.phase === "bidding" ? null : (state.bids[j.id] ?? null),
      })),
      activePlayerId: state.phase === "playing" ? (state.players[state.activePlayer]?.id ?? null) : null,
      trick: state.trick,
      lastTrick: state.lastTrick,
      standings: state.players.map((j) => ({ playerId: j.id, score: j.pointsPerRound.reduce((a, b) => a + b, 0) })),
      results: state.phase === "over" ? results(state) : null,
    }
  },
  isOver: (state) => state.phase === "over",
  debug: {
    // Plays on until a trick is won
    turn: (state) => {
      let e = autoBids(state)
      while (e.phase === "playing") {
        const played = autoMove(e)
        e = played.state
        if (played.events.some(({ event }) => event.type === "trickWon")) break
      }
      return e
    },
    over: (state) => {
      let e = state
      while (e.phase !== "over") e = e.phase === "bidding" ? autoBids(e) : autoMove(e).state
      return e
    },
  },
}
