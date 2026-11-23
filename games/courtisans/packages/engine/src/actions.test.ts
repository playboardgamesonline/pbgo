import { deepFreeze } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { activePlayerId, isOver, phaseOf, waitingFor } from "./machine"
import { card, domainOfPlayer, handOfPlayer, kinds, layout, newState, PLAYER_IDS } from "./test-utils"
import type { Action, State, Target } from "./types"
import { playerView } from "./view"

const apply = (state: State, action: Action): State => step(state, action).state

/** The code a refusal carries, and nothing else: a refusal without one is a bug of the engine. */
function refusal(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string") return code
    throw error
  }
  throw new Error("The action was accepted")
}

const read = (state: State, playerId: string): State => apply(state, { type: "readMissions", playerId })

const play = (state: State, playerId: string, cardId: number, target: Target, victimId?: number): State =>
  apply(state, { type: "playCard", playerId, cardId, target, ...(victimId === undefined ? {} : { victimId }) })

const table = (level: "up" | "down"): Target => ({ zone: "table", level })
const domain = (playerId: string): Target => ({ zone: "domain", playerId })

describe("readMissions", () => {
  it("starts in the missions phase: nobody is up yet, but the first player is known", () => {
    const state = newState(3)
    expect(phaseOf(state)).toBe("missions")
    expect(state.read.every((flag) => !flag)).toBe(true)
    expect(activePlayerId(state)).toBeNull()
    const view = playerView(state, "ana")
    expect(view.activePlayerId).toBeNull()
    expect(view.firstPlayerId).toBe(state.seats[state.active])
  })

  it.each([2, 3, 4, 5])("starts the banquet only once the %i players have read their missions, whatever the order", (n) => {
    let state = newState(n)
    const order = state.seats.slice().reverse()
    order.forEach((id, i) => {
      state = read(state, id)
      expect(state.read.filter(Boolean)).toHaveLength(i + 1)
      expect(phaseOf(state)).toBe(i === n - 1 ? "playing" : "missions")
    })
    expect(activePlayerId(state)).toBe(state.seats[state.active])
  })

  it("counts each player once: reading twice does not start the banquet", () => {
    let state = newState(3)
    state = read(state, "ana")
    state = read(state, "ana")
    state = read(state, "bob")
    expect(phaseOf(state)).toBe("missions")
    expect(playerView(state, "cleo").players.map((player) => player.missionsRead)).toEqual([true, true, false])
  })

  it("changes nothing when the missions are read again once the banquet has started", () => {
    const state = layout({ hands: { ana: [card("hare")], bob: [card("stag")], cleo: [card("carp")] } })
    expect(read(state, "ana")).toEqual(state)
  })

  it("does not let anyone play before the banquet starts, not even when only one player is missing", () => {
    let state = newState(3)
    const first = state.seats[state.active]!
    const hand = handOfPlayer(state, first)
    expect(refusal(() => play(state, first, hand[0]!, table("up")))).toBe("INVALID_PHASE")
    state = read(read(state, "ana"), "bob")
    expect(refusal(() => play(state, first, hand[0]!, table("up")))).toBe("INVALID_PHASE")
    state = read(state, "cleo")
    expect(play(state, first, hand[0]!, table("up")).table).toHaveLength(1)
  })

  it("refuses an unknown player and leaves the state it was given untouched", () => {
    const state = deepFreeze(newState(3))
    expect(refusal(() => read(state, "ghost"))).toBe("UNKNOWN_PLAYER")
    expect(state.read.every((flag) => !flag)).toBe(true)
  })
})

describe("waitingFor", () => {
  it("waits for every player to read their missions, in seat order", () => {
    expect(waitingFor(newState(4))).toEqual(["ana", "bob", "cleo", "dan"])
  })

  it("stops waiting for a player once their missions are read, whatever the order of the readings", () => {
    const state = read(read(newState(4), "cleo"), "ana")
    expect(waitingFor(state)).toEqual(["bob", "dan"])
    expect(waitingFor(read(state, "dan"))).toEqual(["bob"])
  })

  it("waits for the player of the turn alone once the last missions are read", () => {
    const started = PLAYER_IDS.slice(0, 3).reduce(read, newState(3))
    expect(phaseOf(started)).toBe("playing")
    expect(waitingFor(started)).toEqual([started.seats[started.active]])
  })

  it("waits for nobody once the game is over", () => {
    expect(waitingFor(layout({ hands: {} }))).toEqual([])
  })
})

/** Ana holds a guard, a plain stag and a noble carp; Bob three butterflies; three toads wait in the deck. */
function simpleGame(): State {
  return layout({
    players: 2,
    hands: { ana: [card("hare", "guard"), card("stag"), card("carp", "noble")], bob: [card("butterfly"), card("butterfly"), card("butterfly")] },
    deck: [card("toad"), card("toad"), card("toad")],
  })
}

describe("playCard", () => {
  it("plays one card per zone then draws and passes the turn", () => {
    let state = simpleGame()
    const [c1, c2, c3] = handOfPlayer(state, "ana")
    const first = step(state, { type: "playCard", playerId: "ana", cardId: c1!, target: table("up") })
    state = first.state
    state = play(state, "ana", c2!, domain("ana"))
    expect(state.zones).toEqual(["table", "domain"])
    const last = step(state, { type: "playCard", playerId: "ana", cardId: c3!, target: domain("bob") })
    state = last.state

    expect(state.table).toHaveLength(1)
    expect(domainOfPlayer(state, "ana")).toHaveLength(1)
    expect(domainOfPlayer(state, "bob")).toHaveLength(1)
    expect(handOfPlayer(state, "ana")).toHaveLength(3)
    expect(kinds(state, handOfPlayer(state, "ana"))).toEqual(["base-toad", "base-toad", "base-toad"])
    expect(state.deck).toHaveLength(0)
    expect(state.active).toBe(1)
    expect(state.zones).toEqual([])
    // what happened is said by the step, never kept in the state: the last card of the turn plays, then the player draws
    expect(first.events.map(({ event }) => event.type)).toEqual(["cardPlayed"])
    expect(last.events.map(({ event }) => event.type)).toEqual(["cardPlayed", "draw"])
    expect(last.events.at(-1)?.event).toEqual({ type: "draw", playerId: "ana", count: 3 })
  })

  it("draws only what the deck holds, and says nothing when it holds nothing", () => {
    let state = layout({ players: 2, hands: { ana: [card("hare"), card("stag"), card("carp")], bob: [card("butterfly")] }, deck: [card("toad"), card("toad")] })
    const [c1, c2, c3] = handOfPlayer(state, "ana")
    state = play(play(state, "ana", c1!, table("up")), "ana", c2!, domain("ana"))
    const last = step(state, { type: "playCard", playerId: "ana", cardId: c3!, target: domain("bob") })
    expect(handOfPlayer(last.state, "ana")).toHaveLength(2)
    expect(last.events.at(-1)?.event).toEqual({ type: "draw", playerId: "ana", count: 2 })
    // the deck is empty now: the next turn draws nothing and its entries have no draw
    const [b1] = handOfPlayer(last.state, "bob")
    const next = step(last.state, { type: "playCard", playerId: "bob", cardId: b1!, target: table("down") })
    expect(next.events.map(({ event }) => event.type)).toEqual(["cardPlayed"])
  })

  it("refuses a second card in the same zone", () => {
    let state = simpleGame()
    const [c1, c2] = handOfPlayer(state, "ana")
    state = play(state, "ana", c1!, table("up"))
    expect(refusal(() => play(state, "ana", c2!, table("down")))).toBe("ZONE_ALREADY_PLAYED")
  })

  it("counts a domain that is not the player's own as one zone, whoever's it is", () => {
    const state = layout({ players: 3, hands: { ana: [card("hare"), card("stag"), card("carp")], bob: [card("toad")], cleo: [card("toad")] }, deck: [] })
    const [c1, c2] = handOfPlayer(state, "ana")
    const after = play(state, "ana", c1!, domain("bob"))
    expect(refusal(() => play(after, "ana", c2!, domain("cleo")))).toBe("ZONE_ALREADY_PLAYED")
    expect(domainOfPlayer(play(after, "ana", c2!, domain("ana")), "ana")).toHaveLength(1)
  })

  it("refuses to play out of turn, a card that is not in the hand, or a domain that is nobody's", () => {
    const state = simpleGame()
    const [theirs] = handOfPlayer(state, "bob")
    const [mine] = handOfPlayer(state, "ana")
    expect(refusal(() => play(state, "bob", theirs!, table("up")))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => play(state, "ana", 123456, table("up")))).toBe("UNKNOWN_CARD")
    expect(refusal(() => play(state, "ana", theirs!, table("up")))).toBe("UNKNOWN_CARD")
    expect(refusal(() => play(state, "ana", mine!, domain("ghost")))).toBe("INVALID_TARGET")
    expect(refusal(() => play(state, "ghost", mine!, table("up")))).toBe("UNKNOWN_PLAYER")
  })

  it("refuses what is not an action of the game, and what is not well formed, with INVALID_ACTION", () => {
    const state = simpleGame()
    const [mine] = handOfPlayer(state, "ana")
    const refused = (action: unknown) => refusal(() => step(state, action as Action))
    expect(refused({})).toBe("INVALID_ACTION")
    expect(refused({ type: "dance", playerId: "ana" })).toBe("INVALID_ACTION")
    expect(refused({ type: "readMissions" })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", target: table("up") })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", cardId: "nope", target: table("up") })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", cardId: 1.5, target: table("up") })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", cardId: mine })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", cardId: mine, target: null })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", cardId: mine, target: { zone: "table", level: "sideways" } })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", cardId: mine, target: { zone: "domain" } })).toBe("INVALID_ACTION")
    expect(refused({ type: "playCard", playerId: "ana", cardId: mine, target: table("up"), victimId: "nope" })).toBe("INVALID_ACTION")
  })

  it("does not mutate the state it was given", () => {
    const state = deepFreeze(simpleGame())
    const [mine] = handOfPlayer(state, "ana")
    const after = play(state, "ana", mine!, table("up"))
    expect(handOfPlayer(state, "ana")).toHaveLength(3)
    expect(state.table).toHaveLength(0)
    expect(after.table).toHaveLength(1)
  })

  it("leaves the state as it was when a move is refused after part of it was done", () => {
    const state = deepFreeze(layout({ players: 2, hands: { ana: [card("hare", "assassin"), card("stag"), card("carp")], bob: [card("butterfly")] }, table: [[card("toad", "guard"), "up"]] }))
    const [assassin] = handOfPlayer(state, "ana")
    const guard = state.table[0]!.card
    expect(refusal(() => play(state, "ana", assassin!, table("down"), guard))).toBe("INVALID_ASSASSINATION")
    expect(handOfPlayer(state, "ana")).toHaveLength(3)
  })
})

describe("assassin", () => {
  it("eliminates any card at the table, spies included, and says where it lay", () => {
    const spy = card("hare", "spy")
    const state = layout({
      players: 2,
      hands: { ana: [card("nightingale", "assassin"), card("stag"), card("stag")], bob: [card("carp")] },
      table: [[spy, "up"]],
    })
    const [assassin] = handOfPlayer(state, "ana")
    const victim = state.table[0]!.card
    const next = step(state, { type: "playCard", playerId: "ana", cardId: assassin!, target: table("down"), victimId: victim })
    expect(next.state.table.map((placement) => placement.card)).toEqual([assassin])
    expect(next.state.eliminated).toEqual([victim])
    const eliminated = next.events.map(({ event }) => event).find((event) => event.type === "cardEliminated")
    // the eliminated spy keeps its family hidden in what is said, and the entry says the side of the mat it lay on, not the one the assassin went to
    expect(eliminated).toEqual({ type: "cardEliminated", playerId: "ana", card: { id: victim, family: null, role: "spy" }, target: table("up") })
  })

  it("only targets cards in the same domain", () => {
    const victim = card("stag", "noble")
    const state = layout({
      players: 2,
      hands: { ana: [card("nightingale", "assassin"), card("stag"), card("stag")], bob: [card("carp")] },
      domains: { ana: [victim] },
    })
    const [assassin] = handOfPlayer(state, "ana")
    const [target] = domainOfPlayer(state, "ana")
    expect(refusal(() => play(state, "ana", assassin!, domain("bob"), target))).toBe("INVALID_ASSASSINATION")
    const next = play(state, "ana", assassin!, domain("ana"), target)
    expect(domainOfPlayer(next, "ana")).toEqual([assassin])
    expect(next.eliminated).toEqual([target])
  })

  it("cannot eliminate a guard, itself or a card that is not there, nor act for a card that is not an assassin", () => {
    const state = layout({
      players: 2,
      hands: { ana: [card("nightingale", "assassin"), card("carp"), card("stag")], bob: [card("butterfly")] },
      table: [[card("stag", "guard"), "up"]],
    })
    const [assassin, simple] = handOfPlayer(state, "ana")
    const guard = state.table[0]!.card
    expect(refusal(() => play(state, "ana", assassin!, table("up"), guard))).toBe("INVALID_ASSASSINATION")
    expect(refusal(() => play(state, "ana", simple!, table("up"), guard))).toBe("INVALID_ASSASSINATION")
    expect(refusal(() => play(state, "ana", assassin!, table("up"), assassin))).toBe("INVALID_ASSASSINATION")
    expect(refusal(() => play(state, "ana", assassin!, table("up"), 987654))).toBe("INVALID_ASSASSINATION")
  })

  it("is optional", () => {
    const state = layout({
      players: 2,
      hands: { ana: [card("nightingale", "assassin"), card("stag"), card("stag")], bob: [card("butterfly")] },
      table: [[card("stag"), "up"]],
    })
    const [assassin] = handOfPlayer(state, "ana")
    const next = play(state, "ana", assassin!, table("up"))
    expect(next.table).toHaveLength(2)
    expect(next.eliminated).toEqual([])
  })
})

describe("the end of the game", () => {
  it("ends when the deck is empty and every hand is empty, and says so", () => {
    let state = layout({
      players: 2,
      hands: { ana: [card("stag"), card("stag"), card("stag")], bob: [card("carp"), card("carp"), card("carp")] },
    })
    const targets = (me: string, other: string): Target[] => [table("up"), domain(me), domain(other)]
    handOfPlayer(state, "ana").forEach((id, i) => (state = play(state, "ana", id, targets("ana", "bob")[i]!)))
    expect(phaseOf(state)).toBe("playing")
    expect(state.active).toBe(1)
    const ids = handOfPlayer(state, "bob")
    ids.slice(0, 2).forEach((id, i) => (state = play(state, "bob", id, targets("bob", "ana")[i]!)))
    const last = step(state, { type: "playCard", playerId: "bob", cardId: ids[2]!, target: targets("bob", "ana")[2]! })
    expect(isOver(last.state)).toBe(true)
    expect(phaseOf(last.state)).toBe("over")
    expect(last.events.at(-1)?.event).toEqual({ type: "gameOver" })
    expect(waitingFor(last.state)).toEqual([])
    expect(refusal(() => read(last.state, "ana"))).toBe("GAME_OVER")
    expect(refusal(() => play(last.state, "ana", 1, table("up")))).toBe("GAME_OVER")
  })

  it("skips a player who holds no card, and ends the turn of one whose hand runs out", () => {
    let state = layout({ players: 3, hands: { ana: [card("stag")], bob: [], cleo: [card("carp"), card("carp"), card("carp")] }, deck: [] })
    // Ana's only card ends her turn at once, Bob has nothing to play: it is Cleo's turn
    state = play(state, "ana", handOfPlayer(state, "ana")[0]!, table("up"))
    expect(state.active).toBe(2)
    expect(waitingFor(state)).toEqual(["cleo"])
    // Cleo is the only one left: the turn comes back to her after each of her three cards
    const ids = handOfPlayer(state, "cleo")
    state = play(play(state, "cleo", ids[0]!, table("down")), "cleo", ids[1]!, domain("cleo"))
    expect(state.active).toBe(2)
    state = play(state, "cleo", ids[2]!, domain("ana"))
    expect(isOver(state)).toBe(true)
  })
})
