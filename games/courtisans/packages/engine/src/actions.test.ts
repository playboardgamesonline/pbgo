import { describe, expect, it } from "vitest"
import { activePlayerId, applyAction } from "./actions"
import { createRng } from "./rng"
import { setupGame } from "./setup"
import { card, makeState, player, testMissions, place } from "./test-utils"
import type { GameState } from "./types"
import { playerView } from "./view"

describe("readMissions", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` }))
  const newGame = (n = 2) => setupGame({ players: ids(n), missions: testMissions(), rng: createRng(3) })
  const read = (state: GameState, playerId: string) => applyAction(state, { type: "readMissions", playerId })

  it("starts in the missions phase: nobody is up yet, but the first player is known", () => {
    const state = newGame()
    expect(state.phase).toBe("missions")
    expect(state.players.every((j) => !j.missionsRead)).toBe(true)
    expect(activePlayerId(state)).toBeNull()
    const view = playerView(state, "p0")
    expect(view.activePlayerId).toBeNull()
    expect(view.firstPlayerId).toBe(state.players[state.activePlayer]!.id)
  })

  it.each([2, 3, 4, 5])("starts the banquet only once the %i players have read their missions", (n) => {
    let state = newGame(n)
    const order = state.players.map((j) => j.id).reverse()
    order.forEach((id, i) => {
      state = read(state, id)
      expect(state.players.filter((j) => j.missionsRead)).toHaveLength(i + 1)
      expect(state.phase).toBe(i === n - 1 ? "playing" : "missions")
    })
    expect(activePlayerId(state)).toBe(state.players[state.activePlayer]!.id)
  })

  it("counts each player once: reading twice does not start the banquet", () => {
    let state = newGame(3)
    state = read(state, "p0")
    state = read(state, "p0")
    state = read(state, "p1")
    expect(state.phase).toBe("missions")
    expect(playerView(state, "p2").players.map((j) => j.missionsRead)).toEqual([true, true, false])
  })

  it("does not let anyone play before the banquet starts, not even when only one player is missing", () => {
    let state = newGame(3)
    const first = state.players[state.activePlayer]!
    const play = (s: GameState) =>
      applyAction(s, { type: "playCard", playerId: first.id, cardId: first.hand[0]!.id, target: { zone: "table", level: "up" } })
    expect(() => play(state)).toThrow("INVALID_PHASE")
    state = read(read(state, "p0"), "p1")
    expect(() => play(state)).toThrow("INVALID_PHASE")
    state = read(state, "p2")
    expect(play(state).table).toHaveLength(1)
  })

  it("refuses an unknown player and leaves the previous state untouched", () => {
    const state = newGame()
    expect(() => read(state, "ghost")).toThrow("UNKNOWN_PLAYER")
    expect(state.players.every((j) => !j.missionsRead)).toBe(true)
  })

  it("refuses to read once the game is over", () => {
    expect(() => read(makeState({ phase: "over", players: [player("a"), player("b")] }), "a")).toThrow("INVALID_PHASE")
  })

  it("keeps a game saved before this rule running: a late reader only sets their flag", () => {
    const state = makeState({ phase: "playing", players: [player("a"), player("b", { missionsRead: false })] })
    const next = read(state, "b")
    expect(next.phase).toBe("playing")
    expect(next.players[1]!.missionsRead).toBe(true)
  })
})

function simpleGame(): GameState {
  const hand = [card("hare", "guard"), card("stag"), card("carp", "noble")]
  return makeState({
    players: [player("a", { hand }), player("b", { hand: [card("butterfly"), card("butterfly"), card("butterfly")] })],
    deck: [card("toad"), card("toad"), card("toad")],
  })
}

describe("playCard", () => {
  it("plays one card per zone then draws and passes the turn", () => {
    let state = simpleGame()
    const [c1, c2, c3] = state.players[0]!.hand
    state = applyAction(state, { type: "playCard", playerId: "a", cardId: c1!.id, target: { zone: "table", level: "up" } })
    state = applyAction(state, { type: "playCard", playerId: "a", cardId: c2!.id, target: { zone: "domain", playerId: "a" } })
    expect(state.playedZones).toEqual(["table", "domain"])
    state = applyAction(state, { type: "playCard", playerId: "a", cardId: c3!.id, target: { zone: "domain", playerId: "b" } })

    expect(state.table).toHaveLength(1)
    expect(state.players[0]!.domain).toHaveLength(1)
    expect(state.players[1]!.domain).toHaveLength(1)
    expect(state.players[0]!.hand).toHaveLength(3)
    expect(state.deck).toHaveLength(0)
    expect(state.activePlayer).toBe(1)
    expect(state.playedZones).toEqual([])
    expect(state.log.map((e) => e.type)).toEqual(["cardPlayed", "cardPlayed", "cardPlayed", "draw"])
  })

  it("refuses a second card in the same zone", () => {
    let state = simpleGame()
    const [c1, c2] = state.players[0]!.hand
    state = applyAction(state, { type: "playCard", playerId: "a", cardId: c1!.id, target: { zone: "table", level: "up" } })
    expect(() =>
      applyAction(state, { type: "playCard", playerId: "a", cardId: c2!.id, target: { zone: "table", level: "down" } }),
    ).toThrow("ZONE_ALREADY_PLAYED")
  })

  it("refuses to play out of turn or an unknown card", () => {
    const state = simpleGame()
    const cb = state.players[1]!.hand[0]!
    expect(() => applyAction(state, { type: "playCard", playerId: "b", cardId: cb.id, target: { zone: "table", level: "up" } })).toThrow(
      "NOT_YOUR_TURN",
    )
    expect(() => applyAction(state, { type: "playCard", playerId: "a", cardId: "nope", target: { zone: "table", level: "up" } })).toThrow(
      "UNKNOWN_CARD",
    )
  })

  it("does not mutate the previous state", () => {
    const state = simpleGame()
    const c = state.players[0]!.hand[0]!
    applyAction(state, { type: "playCard", playerId: "a", cardId: c.id, target: { zone: "table", level: "up" } })
    expect(state.players[0]!.hand).toHaveLength(3)
    expect(state.table).toHaveLength(0)
  })
})

describe("assassin", () => {
  it("eliminates any card at the table, spies included", () => {
    const assassin = card("nightingale", "assassin")
    const spy = card("hare", "spy")
    const state = makeState({
      players: [player("a", { hand: [assassin, card("stag"), card("stag")] }), player("b")],
      table: [place(spy, "up")],
    })
    const next = applyAction(state, {
      type: "playCard",
      playerId: "a",
      cardId: assassin.id,
      target: { zone: "table", level: "down" },
      victimId: spy.id,
    })
    expect(next.table.map((p) => p.card.id)).toEqual([assassin.id])
    expect(next.eliminated.map((c) => c.id)).toEqual([spy.id])
    expect(next.log.at(-1)).toMatchObject({ type: "cardEliminated", target: { zone: "table", level: "up" } })
  })

  it("only targets cards in the same domaine", () => {
    const assassin = card("nightingale", "assassin")
    const victim = card("stag", "noble")
    const state = makeState({
      players: [player("a", { hand: [assassin, card("stag"), card("stag")], domain: [victim] }), player("b")],
    })
    expect(() =>
      applyAction(state, { type: "playCard", playerId: "a", cardId: assassin.id, target: { zone: "domain", playerId: "b" }, victimId: victim.id }),
    ).toThrow("INVALID_ASSASSINATION")
    const next = applyAction(state, {
      type: "playCard",
      playerId: "a",
      cardId: assassin.id,
      target: { zone: "domain", playerId: "a" },
      victimId: victim.id,
    })
    expect(next.players[0]!.domain.map((c) => c.id)).toEqual([assassin.id])
  })

  it("cannot eliminate a garde nor act for a non-assassin", () => {
    const assassin = card("nightingale", "assassin")
    const guard = card("stag", "guard")
    const simple = card("carp")
    const state = makeState({
      players: [player("a", { hand: [assassin, simple, card("stag")] }), player("b")],
      table: [place(guard, "up")],
    })
    expect(() =>
      applyAction(state, { type: "playCard", playerId: "a", cardId: assassin.id, target: { zone: "table", level: "up" }, victimId: guard.id }),
    ).toThrow("INVALID_ASSASSINATION")
    expect(() =>
      applyAction(state, { type: "playCard", playerId: "a", cardId: simple.id, target: { zone: "table", level: "up" }, victimId: guard.id }),
    ).toThrow("INVALID_ASSASSINATION")
  })

  it("is optional", () => {
    const assassin = card("nightingale", "assassin")
    const state = makeState({ players: [player("a", { hand: [assassin, card("stag"), card("stag")] }), player("b")], table: [place(card("stag"), "up")] })
    const next = applyAction(state, { type: "playCard", playerId: "a", cardId: assassin.id, target: { zone: "table", level: "up" } })
    expect(next.table).toHaveLength(2)
  })
})

describe("game over", () => {
  it("ends when the pioche is empty and every main is empty", () => {
    const a = [card("stag"), card("stag"), card("stag")]
    const b = [card("carp"), card("carp"), card("carp")]
    let state = makeState({ players: [player("a", { hand: a }), player("b", { hand: b })] })
    const targets = (me: string, other: string) => [
      { zone: "table" as const, level: "up" as const },
      { zone: "domain" as const, playerId: me },
      { zone: "domain" as const, playerId: other },
    ]
    a.forEach((c, i) => (state = applyAction(state, { type: "playCard", playerId: "a", cardId: c.id, target: targets("a", "b")[i]! })))
    expect(state.phase).toBe("playing")
    expect(state.activePlayer).toBe(1)
    b.forEach((c, i) => (state = applyAction(state, { type: "playCard", playerId: "b", cardId: c.id, target: targets("b", "a")[i]! })))
    expect(state.phase).toBe("over")
    expect(state.log.at(-1)).toEqual({ type: "gameOver" })
  })
})
