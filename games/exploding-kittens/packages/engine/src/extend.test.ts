import { type Rng, createRng, normalizeOptions, playFor, playOn } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { buildCatalogue } from "./catalogue"
import { GAME, createGame } from "./game"
import { type Effect, currentId, emit, facesOf, hasCards, livingIds, seatOf, startTurn } from "./machine"
import { ORIGINAL_RULES, type Rules } from "./rules"
import { setupGame } from "./setup"
import { CATS, type Move, chainOf, codeOf, draw, eventOf, kinds, oneOf, pass, players, seedOf } from "./test-utils"
import type { Action, EkLogEntry, State, Step } from "./types"
import { playerView } from "./view"
import { resolveWindow } from "./window"

/**
 * Another deck, plugged in from the outside. The engine claims that a new deck is data (cards, a deck, an option that selects it)
 * plus one effect for each new kind of action card, and that nothing else changes. This file builds one with the exports of the
 * engine alone and plays it end to end: the setup, the Nope window, the views, the combos, the takeover, whole games, the kit.
 *
 * The cards are inventions of the test. Glimpse shows its player the top card of the draw pile (no target). Ambush gives the next
 * turn, twice, to the player it names (a target). The option `bonus` shuffles three of each into the pile and deals 5 cards
 * instead of 7. The helpers of `test-utils` are bound to the Original Edition, so the few this file needs are written again here.
 */

// --- The deck

/** The player looks at the top card of the draw pile. It adds to what they know of the top and never takes anything away. */
const GLIMPSE: Effect = {
  resolve(ctx, { by }) {
    const { s } = ctx
    const seen = s.deck.slice(0, 1)
    if (seen.length > 0) s.known[by] = Math.max(s.known[by] ?? 0, 1)
    emit(ctx, { kind: "see", by, count: seen.length, cards: facesOf(ctx, seen) }, [by], { kind: "see", by, count: seen.length })
  },
}

/** The player it names takes the next turn, twice. Like an Attack: the turn of its author ends without a draw, and it stacks. */
const AMBUSH: Effect = {
  targeted: true,
  resolve(ctx, { by, target }) {
    const { s } = ctx
    const owed = s.attacked ? s.owed + 2 : 2
    s.stats[s.turn]!.turns += 1
    emit(ctx, { kind: "attack", by, next: target!, owed })
    startTurn(ctx, seatOf(s, target!), owed, true)
  },
}

const EXTENDED: Rules = {
  ...ORIGINAL_RULES,
  cards: { ...ORIGINAL_RULES.cards, glimpse: { kind: "action", effect: "glimpse" }, ambush: { kind: "action", effect: "ambush" } },
  decks: { ...ORIGINAL_RULES.decks, bonus: [{ type: "glimpse", copies: 3 }, { type: "ambush", copies: 3 }] },
  selectDecks: (options) => (options.bonus === true ? ["original", "bonus"] : ["original"]),
  effects: { ...ORIGINAL_RULES.effects, glimpse: GLIMPSE, ambush: AMBUSH },
  options: { ...ORIGINAL_RULES.options, bonus: { type: "boolean", defaultValue: false, label: "Cartes bonus", group: "extension" } },
  plan: (options, count) => ({ ...ORIGINAL_RULES.plan(options, count), hand: options.bonus === true ? 5 : 7 }),
}

// --- Reading and rigging a table of the extended rules

const catalogue = (state: State): string[] => buildCatalogue(EXTENDED, state.options)

function titleOf(state: State, id: number): string {
  const title = catalogue(state)[state.ids.indexOf(id)]
  if (title === undefined) throw new Error(`No card holds the id ${id}`)
  return title
}

const titlesOf = (state: State, ids: readonly number[]): string[] => ids.map((id) => titleOf(state, id))

/** The titles in the hand of a player, sorted. */
const holding = (state: State, playerId: string): string[] => titlesOf(state, state.hands[seatOf(state, playerId)]!).sort()

function idsOf(state: State, playerId: string, title: string): number[] {
  return state.hands[seatOf(state, playerId)]!.filter((id) => titleOf(state, id) === title)
}

function idOf(state: State, playerId: string, title: string): number {
  const id = idsOf(state, playerId, title)[0]
  if (id === undefined) throw new Error(`${playerId} does not hold a ${title}`)
  return id
}

const viewOf = (state: State, viewer: string | null) => playerView(EXTENDED, state, viewer)

type Layout = {
  /** The titles each player holds. A player who is not named holds nothing. */
  hands?: Record<string, readonly string[]>
  /** The draw pile, top first. */
  deck?: readonly string[]
  /** The discard, top first. */
  discard?: readonly string[]
  /** Who plays: the first seat when missing. */
  turn?: string
  owed?: number
  attacked?: boolean
  /** The players who are out. They hold nothing. */
  out?: readonly string[]
}

/**
 * A table of `n` players where the cards are where the test puts them, in phase `turn`. It starts from a real setup of the extended
 * rules (the streams are the game's own) and gives every card of the layout a real card, with its own id.
 */
function table(n: number, layout: Layout = {}, options: Record<string, unknown> = { bonus: true }): State {
  const base = setupGame(EXTENDED, { players: players(n), options, seed: seedOf(0) })
  const free = new Map<string, number[]>()
  catalogue(base).forEach((title, index) => free.set(title, [...(free.get(title) ?? []), base.ids[index]!]))
  const take = (title: string): number => {
    const id = free.get(title)?.shift()
    if (id === undefined) throw new Error(`The rig runs out of ${title}`)
    return id
  }
  return {
    ...base,
    hands: base.seats.map((id) => (layout.hands?.[id] ?? []).map(take)),
    discard: (layout.discard ?? []).map(take),
    deck: (layout.deck ?? ["rainbow-ralphing-cat", "beard-cat", "hairy-potato-cat"]).map(take),
    out: [...(layout.out ?? [])],
    turn: layout.turn === undefined ? 0 : seatOf(base, layout.turn),
    owed: layout.owed ?? 1,
    attacked: layout.attacked ?? false,
    known: {},
    phase: { kind: "turn" },
  }
}

// --- Moves, by title

/** A move worked out from the state it is played on: the cards are named by their titles, their ids are found there. */
type Later = (state: State) => Action

const play =
  (playerId: string, title: string, target?: string): Later =>
  (state) => ({ type: "play", playerId, card: idOf(state, playerId, title), ...(target === undefined ? {} : { target }) })

const nope =
  (playerId: string): Later =>
  (state) => ({ type: "nope", playerId, card: idOf(state, playerId, "nope"), chain: chainOf(state) })

const combo =
  (playerId: string, wanted: readonly string[], target?: string, named?: string): Later =>
  (state) => {
    const taken = new Set<number>()
    const cards = wanted.map((title) => {
      const id = idsOf(state, playerId, title).find((candidate) => !taken.has(candidate))
      if (id === undefined) throw new Error(`${playerId} does not hold enough ${title}`)
      taken.add(id)
      return id
    })
    return { type: "combo", playerId, cards, ...(target === undefined ? {} : { target }), ...(named === undefined ? {} : { named }) }
  }

function trace(state: State, ...moves: Move[]): Step {
  let current = state
  const events: EkLogEntry[] = []
  for (const move of moves) {
    const result = step(EXTENDED, current, typeof move === "function" ? move(current) : move)
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

const run = (state: State, ...moves: Move[]): State => trace(state, ...moves).state

/** Everybody the open window waits for passes, one after the other, until it closes. */
function settle(state: State): Step {
  let current = state
  const events: EkLogEntry[] = []
  while (current.phase.kind === "reaction") {
    const { passed } = current.phase
    const next = current.seats.find((id) => passed[id] === null)
    if (next === undefined) throw new Error("The window is open and nobody is left to pass")
    const result = trace(current, pass(next))
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

/** The card is played and nobody answers: it resolves. */
const playThrough = (state: State, playerId: string, title: string, target?: string): Step => {
  const played = trace(state, play(playerId, title, target))
  const settled = settle(played.state)
  return { state: settled.state, events: [...played.events, ...settled.events] }
}

// --- Invariants

/** What must hold of every state of the extended game: the Original's `problems`, restated for the catalogue of this table. */
function expectConsistent(state: State): void {
  const types = catalogue(state)
  const placed = [...state.hands.flat(), ...state.deck, ...state.discard, ...(state.phase.kind === "defuse" ? [state.phase.kitten] : [])]
  expect(state.ids, "one id per card of the catalogue").toHaveLength(types.length)
  expect(new Set(state.ids).size, "two cards hold the same id").toBe(state.ids.length)
  expect(new Set(placed).size, "a card is in two places").toBe(placed.length)
  expect(
    placed.every((id) => state.ids.includes(id)),
    "a placed card is not a card of the game",
  ).toBe(true)
  expect(
    state.hands.flat().some((id) => types[state.ids.indexOf(id)] === "exploding-kitten"),
    "a Kitten is in a hand",
  ).toBe(false)
  expect(
    state.out.every((id) => state.hands[seatOf(state, id)]!.length === 0),
    "a player who is out holds cards",
  ).toBe(true)
  for (const [id, n] of Object.entries(state.known)) {
    expect(Number.isInteger(n) && n >= 1 && n <= state.deck.length, `${id} knows ${n} cards of a pile of ${state.deck.length}`).toBe(true)
    expect(state.out.includes(id), `${id} is out and still knows the pile`).toBe(false)
  }
  expect(JSON.parse(JSON.stringify(state)), "the state does not survive its storage as JSON").toStrictEqual(state)
}

// --- A player who plays at random, by the rules

function isTargeted(type: string): boolean {
  const effect = EXTENDED.cards[type]?.effect
  return effect !== undefined && EXTENDED.effects[effect]?.targeted === true
}

/** A move that the rules allow, picked at random: the game must never refuse it. */
function randomMove(state: State, rng: Rng): Action {
  const { phase } = state
  const hand = (playerId: string): number[] => state.hands[seatOf(state, playerId)]!
  switch (phase.kind) {
    case "reaction": {
      const by = oneOf(
        Object.keys(phase.passed).filter((id) => phase.passed[id] === null),
        rng,
      )
      const card = hand(by).find((id) => EXTENDED.cards[titleOf(state, id)]?.kind === "nope")
      const chain = phase.nopes.length
      return card !== undefined && rng() < 0.3 ? { type: "nope", playerId: by, card, chain } : { type: "pass", playerId: by, chain }
    }
    case "defuse":
      return { type: "defuse", playerId: currentId(state), position: Math.floor(rng() * (state.deck.length + 1)) }
    case "give":
      return { type: "give", playerId: phase.from, card: oneOf(hand(phase.from), rng) }
    case "turn": {
      const by = currentId(state)
      const mine = hand(by)
      const opponents = livingIds(state).filter((id) => id !== by && hasCards(state, id))
      const playable = mine.filter((id) => {
        const title = titleOf(state, id)
        return EXTENDED.cards[title]?.kind === "action" && (opponents.length > 0 || !isTargeted(title))
      })
      if (playable.length > 0 && rng() < 0.6) {
        const card = oneOf(playable, rng)
        return isTargeted(titleOf(state, card))
          ? { type: "play", playerId: by, card, target: oneOf(opponents, rng) }
          : { type: "play", playerId: by, card }
      }
      const alike = new Map<string, number[]>()
      for (const id of mine) alike.set(titleOf(state, id), [...(alike.get(titleOf(state, id)) ?? []), id])
      const pairs = [...alike.values()].filter((ids) => ids.length >= 2)
      if (pairs.length > 0 && opponents.length > 0 && rng() < 0.2) {
        return { type: "combo", playerId: by, cards: oneOf(pairs, rng).slice(0, 2), target: oneOf(opponents, rng) }
      }
      return { type: "draw", playerId: by }
    }
    default:
      throw new Error(`Nothing to play in the phase "${phase.kind}"`)
  }
}

/** What the games played at random did, in all. */
type Tally = { played: Record<string, number>; resolved: Record<string, number>; moves: number }

function count(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1
}

/**
 * A whole game, move by move through `step`. Every move is one the rules allow, so the game refuses none; the state is checked
 * after each of them, and each new card that resolves is checked against what it promises. Without the option, a twin game on
 * the Original rules plays the same moves and must stay the same game.
 */
function playRandomly(n: number, seed: number, bonus: boolean, tally: Tally): State {
  const rng = createRng(seed)
  let state = setupGame(EXTENDED, { players: players(n), options: { bonus }, seed })
  let twin = setupGame(ORIGINAL_RULES, { players: players(n), seed })
  for (let moves = 1; state.phase.kind !== "over"; moves++) {
    if (moves > 5000) throw new Error(`The game is not over after ${moves} moves`)
    const before = state
    const action = randomMove(before, rng)
    const result = step(EXTENDED, before, action)
    state = result.state
    tally.moves += 1
    expectConsistent(state)
    if (!bonus) {
      twin = step(ORIGINAL_RULES, twin, action).state
      expect({ ...state, options: twin.options }, "the twin game on the Original rules").toStrictEqual(twin)
    }
    for (const { event } of result.events) if (event.kind === "play") count(tally.played, event.card.type)
    const { phase } = before
    if (phase.kind === "reaction" && phase.pending.kind === "card" && result.events.some(({ event }) => event.kind === "resolved")) {
      const { by, card, target } = phase.pending
      const type = titleOf(before, card)
      count(tally.resolved, type)
      if (type === "glimpse") expect(state.known[by] ?? 0, "the player who glimpsed knows the top card").toBeGreaterThanOrEqual(1)
      if (type === "ambush") {
        expect(state.seats[state.turn], "the turn is with the player the Ambush names").toBe(target)
        expect(state.owed, "that player owes two turns or more").toBeGreaterThanOrEqual(2)
        expect(state.attacked).toBe(true)
      }
    }
  }
  expect(state.out, "all the players but one are out").toHaveLength(n - 1)
  return state
}

// --- The tests

describe("a deck plugged in from the outside", () => {
  describe("the option", () => {
    it("is an extension of the table: a boolean that is off unless it is asked for, next to the options of the Original rules", () => {
      const { bonus, ...others } = createGame(EXTENDED).options
      expect(bonus).toMatchObject({ type: "boolean", defaultValue: false, group: "extension" })
      expect(others).toStrictEqual(GAME.options)
    })

    it("is read like any other option", () => {
      const read = (entry: unknown) => normalizeOptions(EXTENDED.options, entry, { playerCount: 3 })
      const original = { fiveDifferent: true, fasterGame: false, classicDeal: false }
      expect(read({ bonus: true })).toStrictEqual({ ...original, bonus: true })
      expect(read({})).toStrictEqual({ ...original, bonus: false })
      expect(read({ bonus: "yes" })).toStrictEqual({ ...original, bonus: false })
      expect(read(undefined)).toStrictEqual({ ...original, bonus: false })
      // The Original rules do not know it
      expect(normalizeOptions(ORIGINAL_RULES.options, { bonus: true }, { playerCount: 3 })).toStrictEqual(original)
    })
  })

  describe("the catalogue and the deal", () => {
    it("is the Original Edition alone when the option is off, and the new deck after it when the option is on", () => {
      const off = buildCatalogue(EXTENDED, { bonus: false })
      expect(off).toHaveLength(56)
      expect(off).toStrictEqual(buildCatalogue(ORIGINAL_RULES, {}))
      const on = buildCatalogue(EXTENDED, { bonus: true })
      expect(on).toHaveLength(62)
      expect(on.slice(0, 56)).toStrictEqual(off)
      expect(on.slice(56)).toStrictEqual(["glimpse", "glimpse", "glimpse", "ambush", "ambush", "ambush"])
    })

    it("deals the new cards with the others and by the plan the rules bring: a Defuse and 5 cards each, not 7", () => {
      for (const n of [2, 3, 4, 5]) {
        const state = setupGame(EXTENDED, { players: players(n), options: { bonus: true }, seed: seedOf(n) })
        const types = catalogue(state)
        expect(state.ids, `${n} players`).toHaveLength(62)
        for (const hand of state.hands) {
          // The Defuse of the plan comes first; a spare one that went back into the pool may come on top of it
          expect(hand, `${n} players`).toHaveLength(6)
          expect(types[state.ids.indexOf(hand[0]!)], `${n} players`).toBe("defuse")
        }
        // The setup only takes Kittens and spare Defuses out: every new card is in a hand or in the draw pile
        const placed = [...state.hands.flat(), ...state.deck].map((id) => types[state.ids.indexOf(id)])
        expect(placed.filter((type) => type === "glimpse")).toHaveLength(3)
        expect(placed.filter((type) => type === "ambush")).toHaveLength(3)
        expectConsistent(state)
        const plain = setupGame(EXTENDED, { players: players(n), seed: seedOf(n) })
        for (const hand of plain.hands) expect(hand, `${n} players, option off`).toHaveLength(8)
      }
    })

    it("is the Original game to the letter when the option is off: the same deal, and the same game up to its end", () => {
      const extended = createGame(EXTENDED)
      for (const n of [2, 3, 4, 5]) {
        for (const seed of [seedOf(0), seedOf(1), seedOf(2)]) {
          const a = extended.setup({ players: players(n), options: {}, seed })
          const b = GAME.setup({ players: players(n), options: {}, seed })
          expect(a.options).toStrictEqual({ ...b.options, bonus: false })
          expect({ ...a, options: b.options }, `${n} players, seed ${seed}: the deal`).toStrictEqual(b)
          const endA = playOn(extended, a)
          const endB = playOn(GAME, b)
          expect(endB.phase.kind).toBe("over")
          expect({ ...endA, options: endB.options }, `${n} players, seed ${seed}: the game`).toStrictEqual(endB)
        }
      }
    })
  })

  describe("a card without a target (Glimpse: the top card of the draw pile)", () => {
    const start = (): State =>
      table(3, {
        hands: { ana: ["glimpse", "skip"], bob: ["nope", "tacocat"], cleo: ["defuse", "nope"] },
        deck: ["tacocat", "beard-cat", "cattermelon", "exploding-kitten"],
      })

    it("goes through the Nope window like every action card", () => {
      const played = trace(start(), play("ana", "glimpse"))
      expect(kinds(played.events)).toStrictEqual(["play"])
      expect(eventOf(played.events, "play")).toMatchObject({ by: "ana", card: { type: "glimpse" } })
      expect(titlesOf(played.state, played.state.discard)).toStrictEqual(["glimpse"])
      expect(viewOf(played.state, "bob").phase).toMatchObject({
        kind: "reaction",
        pending: { kind: "card", by: "ana", card: { type: "glimpse" } },
        chain: 0,
      })
      expect(Object.keys((played.state.phase as { passed: object }).passed)).toStrictEqual(["bob", "cleo"])
    })

    it("shows its player the top card once it resolves, and nobody else", () => {
      const state = start()
      const top = state.deck[0]!
      const done = playThrough(state, "ana", "glimpse")
      expect(kinds(done.events)).toStrictEqual(["play", "resolved", "see"])
      const seen = done.events.find(({ event }) => event.kind === "see")!
      expect(seen.to).toStrictEqual(["ana"])
      expect(seen.event).toStrictEqual({ kind: "see", by: "ana", count: 1, cards: [{ id: top, type: "tacocat" }] })
      expect(seen.masked).toStrictEqual({ kind: "see", by: "ana", count: 1 })
      expect(done.state.known).toStrictEqual({ ana: 1 })
      expect(viewOf(done.state, "ana").me?.top).toStrictEqual([{ id: top, type: "tacocat" }])
      expect(viewOf(done.state, "bob").me?.top).toStrictEqual([])
      expect(viewOf(done.state, null).me).toBeNull()
      // The card stays on the discard and its player keeps the turn
      expect(titlesOf(done.state, done.state.discard)).toStrictEqual(["glimpse"])
      expect(done.state).toMatchObject({ turn: 0, owed: 1, phase: { kind: "turn" } })
      expectConsistent(done.state)
    })

    it("is part of what the player knows of the pile: the draw takes the card they saw, and with it what they knew", () => {
      const done = playThrough(start(), "ana", "glimpse")
      const top = done.state.deck[0]!
      const drawn = run(done.state, draw("ana"))
      expect(drawn.hands[0]).toContain(top)
      expect(drawn.known).toStrictEqual({})
      expect(viewOf(drawn, "ana").me?.top).toStrictEqual([])
      expect(drawn.seats[drawn.turn]).toBe("bob")
      expectConsistent(drawn)
    })

    it("does nothing when it is Noped: the card is lost and nobody has seen anything", () => {
      const noped = settle(run(start(), play("ana", "glimpse"), nope("bob")))
      expect(kinds(noped.events)).toStrictEqual(["cancelled"])
      expect(noped.state.known).toStrictEqual({})
      expect(titlesOf(noped.state, noped.state.discard)).toStrictEqual(["nope", "glimpse"])
      expect(noped.state).toMatchObject({ turn: 0, phase: { kind: "turn" } })
    })

    it("goes through when the Nope is Noped", () => {
      const settled = settle(run(start(), play("ana", "glimpse"), nope("bob"), nope("cleo")))
      expect(kinds(settled.events)).toStrictEqual(["resolved", "see"])
      expect(settled.state.known).toStrictEqual({ ana: 1 })
    })

    it("resolves when the window is closed for the players, by a takeover or by a timer, with the effects of the table", () => {
      const open = run(start(), play("ana", "glimpse"))
      const takeover = playFor(createGame(EXTENDED), open, "bob")
      const timer = resolveWindow(EXTENDED, open)
      expect(takeover.known).toStrictEqual({ ana: 1 })
      expect(kinds(timer.events)).toStrictEqual(["resolved", "see"])
      expect(timer.state).toStrictEqual(takeover)
    })
  })

  describe("a card that names a player (Ambush: that player takes the next turn, twice)", () => {
    const start = (layout: Layout = {}): State =>
      table(4, {
        hands: { ana: ["ambush", "skip"], bob: ["tacocat"], cleo: ["tacocat", "nope"], dan: ["tacocat", "nope"] },
        deck: [...CATS],
        ...layout,
      })

    it("must name another player who is in the game and holds a card, like a Favor", () => {
      const state = start({ hands: { ana: ["ambush"], bob: ["tacocat"] }, out: ["dan"] })
      const aimed = (target: unknown): Action => ({ type: "play", playerId: "ana", card: idOf(state, "ana", "ambush"), target }) as Action
      // No one, themself, a player with no card, a player who is out, a stranger, something that is no player
      for (const target of [undefined, "ana", "cleo", "dan", "zoe", 42]) {
        const before = structuredClone(state)
        expect(codeOf(() => step(EXTENDED, state, aimed(target))), `aimed at ${String(target)}`).toBe("INVALID_TARGET")
        expect(state).toStrictEqual(before)
      }
      const played = trace(state, play("ana", "ambush", "bob"))
      expect(eventOf(played.events, "play")).toMatchObject({ by: "ana", target: "bob", card: { type: "ambush" } })
      expect(viewOf(played.state, "cleo").phase).toMatchObject({ kind: "reaction", pending: { kind: "card", target: "bob" } })
    })

    it("sends the turn to the player it names, who takes two turns, and the turns go on from there", () => {
      const state = start()
      const done = playThrough(state, "ana", "ambush", "cleo")
      expect(kinds(done.events)).toStrictEqual(["play", "resolved", "attack", "turn"])
      expect(eventOf(done.events, "attack")).toStrictEqual({ kind: "attack", by: "ana", next: "cleo", owed: 2 })
      expect(done.state).toMatchObject({ turn: 2, owed: 2, attacked: true, phase: { kind: "turn" } })
      // Their turn counts for the player who ambushed, who draws nothing and keeps their other cards
      expect(done.state.stats[0]!.turns).toBe(1)
      expect(holding(done.state, "ana")).toStrictEqual(["skip"])
      // bob is skipped over: cleo plays twice, then it is dan's turn (the seat after cleo)
      const once = run(done.state, draw("cleo"))
      expect(once).toMatchObject({ turn: 2, owed: 1, attacked: true })
      const twice = run(once, draw("cleo"))
      expect(twice).toMatchObject({ turn: 3, owed: 1, attacked: false })
      expect(twice.stats[2]!.turns).toBe(2)
      expectConsistent(twice)
    })

    it("stacks on the turns the player owes already, like an Attack", () => {
      const plain = playThrough(start(), "ana", "ambush", "dan").state
      expect(plain).toMatchObject({ turn: 3, owed: 2, attacked: true })
      const stacked = playThrough(start({ owed: 2, attacked: true }), "ana", "ambush", "dan").state
      expect(stacked).toMatchObject({ turn: 3, owed: 4, attacked: true })
      // Turns owed without an Attack do not count: this is not stacking
      const unattacked = playThrough(start({ owed: 2, attacked: false }), "ana", "ambush", "dan").state
      expect(unattacked).toMatchObject({ turn: 3, owed: 2, attacked: true })
    })

    it("does nothing when it is Noped: the turn stays with its player, who loses the card", () => {
      const noped = settle(run(start(), play("ana", "ambush", "bob"), nope("cleo")))
      expect(kinds(noped.events)).toStrictEqual(["cancelled"])
      expect(noped.state).toMatchObject({ turn: 0, owed: 1, attacked: false, phase: { kind: "turn" } })
      expect(holding(noped.state, "ana")).toStrictEqual(["skip"])
    })

    it("goes on, aimed at the same player, when the Nope is Noped", () => {
      const settled = settle(run(start(), play("ana", "ambush", "bob"), nope("cleo"), nope("dan")))
      expect(kinds(settled.events)).toStrictEqual(["resolved", "attack", "turn"])
      expect(settled.state).toMatchObject({ turn: 1, owed: 2, attacked: true })
    })

    it("can be aimed at a player who plays their last card behind the window: the effect decides what that changes", () => {
      // A Favor fizzles then, because it takes a card; an Ambush takes none
      const state = start({ hands: { ana: ["ambush"], bob: ["nope"], cleo: ["nope"] } })
      const settled = settle(run(state, play("ana", "ambush", "bob"), nope("bob"), nope("cleo")))
      expect(settled.state.hands[1]).toHaveLength(0)
      expect(settled.state).toMatchObject({ turn: 1, owed: 2, attacked: true })
    })
  })

  describe("the combos, which are the same for every deck", () => {
    it("steal with a pair of new cards, as with a pair of any title", () => {
      const state = table(3, { hands: { ana: ["glimpse", "glimpse"], bob: ["tacocat"], cleo: ["nope"] } })
      const done = settle(run(state, combo("ana", ["glimpse", "glimpse"], "bob")))
      expect(eventOf(done.events, "steal")).toMatchObject({ by: "ana", from: "bob", card: { type: "tacocat" } })
      expect(holding(done.state, "ana")).toStrictEqual(["tacocat"])
      expect(holding(done.state, "bob")).toStrictEqual([])
      expect(titlesOf(done.state, done.state.discard)).toStrictEqual(["glimpse", "glimpse"])
    })

    it("let a triple name a new card, but only when the table plays with them", () => {
      const hands = { ana: ["tacocat", "tacocat", "tacocat"], bob: ["nope"], cleo: ["nope"] }
      const naming = combo("ana", ["tacocat", "tacocat", "tacocat"], "bob", "ambush")

      const on = table(3, { hands: { ...hands, bob: ["ambush", "nope"] } })
      const hit = settle(run(on, naming))
      expect(eventOf(hit.events, "named")).toMatchObject({ by: "ana", from: "bob", title: "ambush", hit: true, card: { type: "ambush" } })
      expect(holding(hit.state, "ana")).toStrictEqual(["ambush"])

      // Without the deck, the title is not a card of the game
      const off = table(3, { hands }, { bonus: false })
      expect(codeOf(() => step(EXTENDED, off, naming(off) as Action))).toBe("INVALID_TITLE")
      // A card that is in a deck of the rules but not in the one of this table
      expect(codeOf(() => step(EXTENDED, off, { ...(naming(off) as Action), named: "glimpse" } as Action))).toBe("INVALID_TITLE")
    })
  })

  describe("the platform's side", () => {
    it("shows the new cards under their own titles to the players who may see them", () => {
      const state = table(3, { hands: { ana: ["glimpse", "ambush", "tacocat"], bob: ["nope"] }, discard: ["ambush"] })
      const game = createGame(EXTENDED)
      expect(game.view(state, "ana").me?.hand.map(({ type }) => type)).toStrictEqual(["glimpse", "ambush", "tacocat"])
      expect(game.view(state, "bob").discard.map(({ type }) => type)).toStrictEqual(["ambush"])
      expect(game.view(state, "bob").players.map(({ cards }) => cards)).toStrictEqual([3, 1, 0])
    })

    it("is played for until a winner by the kit's own helpers, on every table size", () => {
      const game = createGame(EXTENDED)
      for (const n of [2, 3, 4, 5]) {
        const start = game.setup({ players: players(n), options: { bonus: true }, seed: seedOf(n) })
        const end = playOn(game, start)
        expect(game.isOver(end), `${n} players`).toBe(true)
        expect(game.view(end, "ana").results, `${n} players`).not.toBeNull()
        expectConsistent(end)
      }
    })

    it("plays whole games with the new cards, whatever the size of the table and the seed", () => {
      const tally: Tally = { played: {}, resolved: {}, moves: 0 }
      for (const n of [2, 3, 4, 5]) {
        for (let i = 0; i < 6; i++) playRandomly(n, seedOf(100 + n * 10 + i), true, tally)
      }
      expect(tally.moves).toBeGreaterThan(1000)
      // The games did play the new cards, and they resolved: nothing above was checked for nothing
      expect(tally.resolved["glimpse"]).toBeGreaterThanOrEqual(10)
      expect(tally.resolved["ambush"]).toBeGreaterThanOrEqual(10)
      expect(tally.played["glimpse"]).toBeGreaterThanOrEqual(tally.resolved["glimpse"]!)
      expect(tally.played["ambush"]).toBeGreaterThanOrEqual(tally.resolved["ambush"]!)
    }, 60_000)

    it("plays whole games without the new cards that are the Original games, move by move", () => {
      const tally: Tally = { played: {}, resolved: {}, moves: 0 }
      for (const n of [2, 3, 4, 5]) {
        for (let i = 0; i < 3; i++) playRandomly(n, seedOf(200 + n * 10 + i), false, tally)
      }
      expect(tally.moves).toBeGreaterThan(500)
      expect(tally.played).not.toHaveProperty("glimpse")
      expect(tally.played).not.toHaveProperty("ambush")
      expect(tally.played["attack"]).toBeGreaterThan(0)
    }, 60_000)
  })

  describe("the rules of the data", () => {
    it("takes a card whose effect is missing from the rules for a mistake in the data, not for a refusal", () => {
      const broken: Rules = { ...EXTENDED, effects: ORIGINAL_RULES.effects }
      const state = table(3, { hands: { ana: ["glimpse"], bob: ["tacocat"] } })
      const move = play("ana", "glimpse") as (on: State) => Action
      expect(() => step(broken, state, move(state))).toThrow(RangeError)
      expect(() => step(broken, state, move(state))).toThrow("has no effect")
    })

    it("leaves the Original Edition as it was: its cards, its decks, its effects and its options", () => {
      expect(ORIGINAL_RULES.cards).not.toHaveProperty("glimpse")
      expect(ORIGINAL_RULES.decks).not.toHaveProperty("bonus")
      expect(ORIGINAL_RULES.effects).not.toHaveProperty("ambush")
      expect(GAME.options).not.toHaveProperty("bonus")
      expect(buildCatalogue(ORIGINAL_RULES, { bonus: true })).toHaveLength(56)
    })
  })
})
