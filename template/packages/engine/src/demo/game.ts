import {
  type GameDefinition,
  type OptionDefinitions,
  type Results,
  EngineError,
  allSubmitted,
  createRng,
  normalizeOptions,
  openSubmissions,
  pendingSubmissions,
  shuffle,
  submit,
  submittedFlags,
} from "@pbgo/engine-kit"
import { type Action, type Card, CARD_COLORS, type State, type DemoOptions, MAX_VALUE, type PlayerState, type PlayerView } from "./types"

type PlayCard = Extract<Action, { type: "playCard" }>
type Bid = Extract<Action, { type: "bid" }>

export const DEMO_OPTIONS: OptionDefinitions = {
  rounds: { type: "number", label: "Nombre de manches", defaultValue: 3, min: 1, max: 5 },
  handSize: { type: "number", label: "Cartes par joueur", help: "Réduit automatiquement si le paquet ne suffit pas", defaultValue: 5, min: 3, max: 8 },
  inverse: { type: "boolean", label: "La plus basse l'emporte", defaultValue: false },
  bids: { type: "boolean", label: "Annonces secrètes", help: "Chacun annonce ses plis en secret ; +1 point si l'annonce est exacte", defaultValue: true },
}

const DECK: Card[] = CARD_COLORS.flatMap((color) => Array.from({ length: MAX_VALUE }, (_, i) => ({ id: `${color}-${i + 1}`, color, value: i + 1 })))

/** Ids of the players in seat order: the order of every list of players the engine builds (an object's keys do not keep it in the stored state) */
const seats = (state: State) => state.players.map((j) => j.id)

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

function playCard(state: State, action: PlayCard): State {
  if (state.phase !== "playing") throw new EngineError("INVALID_PHASE")
  const index = state.players.findIndex((j) => j.id === action.playerId)
  if (index < 0) throw new EngineError("UNKNOWN_PLAYER")
  if (index !== state.activePlayer) throw new EngineError("NOT_YOUR_TURN")
  const player = state.players[index]!
  const card = player.hand.find((c) => c.id === action.cardId)
  if (!card) throw new EngineError("UNKNOWN_CARD")

  let nextOne: State = {
    ...state,
    players: state.players.map((j, i) => (i === index ? { ...j, hand: j.hand.filter((c) => c.id !== card.id) } : j)),
    trick: [...state.trick, { playerId: player.id, card }],
    activePlayer: (index + 1) % state.players.length,
    log: [...state.log, { type: "cardPlayed", playerId: player.id, card }],
  }
  if (nextOne.trick.length < nextOne.players.length) return nextOne

  const winner = trickWinner(nextOne.trick, nextOne.options.inverse)
  const winnerIndex = nextOne.players.findIndex((j) => j.id === winner.playerId)
  nextOne = {
    ...nextOne,
    players: nextOne.players.map((j, i) => (i === winnerIndex ? addPoint(j) : j)),
    lastTrick: { cards: nextOne.trick, winnerId: winner.playerId },
    trick: [],
    activePlayer: winnerIndex,
    log: [...nextOne.log, { type: "trickWon", playerId: winner.playerId, cards: nextOne.trick.map((p) => p.card) }],
  }
  if (nextOne.players.some((j) => j.hand.length > 0)) return nextOne

  nextOne = scoreBids(nextOne)
  if (nextOne.round >= nextOne.options.rounds) return { ...nextOne, phase: "over" }
  const round = nextOne.round + 1
  return deal({
    ...nextOne,
    round,
    roundLeader: (nextOne.roundLeader + 1) % nextOne.players.length,
    log: [...nextOne.log, { type: "newRound", round }],
  })
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
        detail: t.j.pointsPerRound.map((points, m) => ({ key: `round-${m + 1}`, label: `Manche ${m + 1}`, points })),
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

function autoMove(state: State): State {
  const player = state.players[state.activePlayer]!
  return playCard(state, { type: "playCard", playerId: player.id, cardId: player.hand[0]!.id })
}

/** Completes the current step of one waiting player. Deterministic: no random draw, so that a replay stays exact. */
function autoPlayFor(state: State, playerId: string): State {
  if (!waiting(state).includes(playerId)) throw new EngineError("NOT_WAITING")
  if (state.phase !== "bidding") return autoMove(state)
  // the average number of tricks per player
  const hand = state.players.find((j) => j.id === playerId)!.hand
  return bid(state, { type: "bid", playerId, amount: Math.floor(hand.length / state.players.length) })
}

function autoBids(state: State): State {
  let e = state
  while (e.phase === "bidding") e = autoPlayFor(e, waiting(e)[0]!)
  return e
}

export const demo: GameDefinition<State, Action, PlayerView> = {
  id: "demo",
  name: "La Plus Haute",
  minPlayers: 2,
  maxPlayers: 6,
  options: DEMO_OPTIONS,
  clientActions: ["bid", "playCard"],
  waitingFor: waiting,
  autoPlayFor,
  setup: ({ players, options, seed = Math.floor(Math.random() * 2 ** 31) }) => {
    if (players.length < 2 || players.length > 6) throw new EngineError("INVALID_PLAYERS")
    const opts = normalizeOptions(DEMO_OPTIONS, options) as DemoOptions
    return deal({
      seed,
      options: opts,
      players: players.map((j) => ({ id: j.id, nickname: j.nickname, hand: [], pointsPerRound: [] })),
      round: 1,
      roundLeader: Math.floor(createRng(seed)() * players.length),
      activePlayer: 0,
      trick: [],
      lastTrick: null,
      phase: "playing",
      bids: {},
      log: [],
    })
  },
  apply: (state, action) => {
    if (action.type === "playCard") return playCard(state, action)
    if (action.type === "bid") return bid(state, action)
    throw new EngineError("INVALID_ACTION")
  },
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
        nickname: j.nickname,
        cardCount: j.hand.length,
        points: j.pointsPerRound.reduce((a, b) => a + b, 0),
        pointsPerRound: j.pointsPerRound,
        hasBid: hasBid[j.id] ?? false,
        bid: state.phase === "bidding" ? null : (state.bids[j.id] ?? null),
      })),
      activePlayerId: state.phase === "playing" ? (state.players[state.activePlayer]?.id ?? null) : null,
      trick: state.trick,
      lastTrick: state.lastTrick,
      log: state.log.slice(-40),
      results: state.phase === "over" ? results(state) : null,
    }
  },
  isOver: (state) => state.phase === "over",
  debug: {
    turn: (state) => {
      let e = autoBids(state)
      const prevFold = state.log.filter((ev) => ev.type === "trickWon").length
      while (e.phase === "playing" && e.log.filter((ev) => ev.type === "trickWon").length === prevFold) e = autoMove(e)
      return e
    },
    over: (state) => {
      let e = state
      while (e.phase !== "over") e = e.phase === "bidding" ? autoBids(e) : autoMove(e)
      return e
    },
  },
}
