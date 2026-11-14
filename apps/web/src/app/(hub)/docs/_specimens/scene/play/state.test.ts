import { describe, expect, it } from "vitest"
import { PLAY_DECK, PLAY_LIMITS, PLAY_LOG_MAX, type PlayState } from "../defaults"
import { cellAt, cellCentres, planOf } from "./geometry"
import { presetState } from "./presets"
import { addPoints, addThing, deal, dealRound, discardOne, endRound, flip, freeSlot, giveTo, HELD_MOST, leader, movePiece, newCard, nextTurn, passCards, playFromHand, reshapeBoard, rollDice, say, sendCard, showParts, stay, hit, take } from "./state"

const card = () => presetState("card")
const countCards = (s: PlayState) => s.things.filter((t) => t.kind === "card").length + s.hand.cards.length + s.held.length + s.piles.discard.length

describe("deal and giveTo", () => {
  it("deal to the hand when it is on, with the pile's size as where the card flies in from", () => {
    const s = deal(card())
    expect(s.hand.cards).toHaveLength(6)
    expect(s.hand.cards.at(-1)?.from).toBe(PLAY_DECK.size - 14)
    expect(s.piles.drawn).toBe(15)
    expect(s.log[0]).toMatch(/Dealt/)
  })

  it("deal to the table when the hand is off, and stop when the deck is out", () => {
    const base = presetState("empty")
    expect(deal(base).things).toHaveLength(1)
    const out = { ...base, piles: { drawn: PLAY_DECK.size, discard: [] } }
    expect(deal(out)).toBe(out)
  })

  it("giveTo sends the viewer's card to the hand and another seat's face down, up to the most it holds", () => {
    let s = giveTo(card(), 2)
    expect(s.held.filter((h) => h.seat === 2)).toHaveLength(4)
    for (let i = 0; i < 10; i++) s = giveTo(s, 2)
    expect(s.held.filter((h) => h.seat === 2)).toHaveLength(HELD_MOST)
    expect(giveTo(card(), 6)).toEqual(card())
  })

  it("dealRound gives one card to each player and says so once", () => {
    const s = dealRound(card())
    expect(countCards(s)).toBe(countCards(card()) + 4)
    expect(s.log[0]).toMatch(/^Dealt a round/)
    expect(s.log.length).toBe(card().log.length + 1)
    expect(s.log.filter((l) => l.startsWith("Gave"))).toHaveLength(0)
  })
})

describe("transitions", () => {
  it("flip turns the picked card, else the first one, else lays a card face down", () => {
    const s = presetState("trick")
    expect(s.things[0]).toMatchObject({ face: "up" })
    const first = flip(s)
    expect(first.things[0]).toMatchObject({ face: "down" })
    const picked = flip({ ...s, selected: 3 })
    expect(picked.things[2]).toMatchObject({ face: "down" })
    expect(picked.things[0]).toMatchObject({ face: "up" })
    const none = flip(presetState("empty"))
    expect(none.things).toHaveLength(1)
    expect(none.things[0]).toMatchObject({ kind: "card", face: "down" })
  })

  it("movePiece walks a piece of the board to a free cell next to it, a different one each time", () => {
    const start = presetState("board")
    const plan = planOf(start.board)
    const centres = cellCentres(plan)
    const cellOf = (s: PlayState, i: number) => cellAt(centres, s.things[i]!, 0.1)
    let s = start
    const seen = new Set<number>()
    for (let i = 0; i < 6; i++) {
      const before = cellOf(s, 0)
      s = movePiece({ ...s, selected: s.things[0]!.id })
      const after = cellOf(s, 0)
      expect(after).toBeGreaterThanOrEqual(0)
      expect(Math.abs((after % 6) - (before % 6)) + Math.abs(Math.floor(after / 6) - Math.floor(before / 6))).toBe(1)
      seen.add(after)
    }
    expect(seen.size).toBeGreaterThan(1)
    expect(s.board.hops).toBe(6)
  })

  it("movePiece puts a piece that is off the board on a free cell first, and does nothing with no piece", () => {
    const s = { ...presetState("board"), things: [{ id: 9, kind: "piece" as const, shape: "pawn" as const, paint: 0, x: 30, z: 30, fromBag: false }] }
    const moved = movePiece(s)
    expect(cellAt(cellCentres(planOf(s.board)), moved.things[0]!, 0.1)).toBeGreaterThanOrEqual(0)
    const bare = presetState("empty")
    expect(movePiece(bare)).toBe(bare)
  })

  it("discard and play take the last card of the hand, and do nothing with an empty hand", () => {
    const s = card()
    const last = s.hand.cards.at(-1)!
    expect(discardOne(s).piles.discard.at(-1)?.id).toBe(last.id)
    expect(discardOne(s).hand.cards).toHaveLength(4)
    const played = playFromHand(s)
    expect(played.things.at(-1)).toMatchObject({ id: last.id, kind: "card" })
    const empty = { ...s, hand: { ...s.hand, cards: [] } }
    expect(discardOne(empty)).toBe(empty)
    expect(playFromHand(empty)).toBe(empty)
  })

  it("passCards moves one card from each seat to the next, none lost or made", () => {
    const s = card()
    const passed = passCards(s)
    expect(countCards(passed)).toBe(countCards(s))
    expect(passed.hand.cards).toHaveLength(5)
    const ids = [...passed.hand.cards.map((c) => c.id), ...passed.held.map((c) => c.id)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(passed.held.filter((h) => h.seat === 1)).toHaveLength(4)
    expect(passed.held.find((h) => h.id === s.hand.cards.at(-1)!.id)?.seat).toBe(1)
    expect(passed.hand.cards.at(-1)?.id).toBe(s.held.filter((h) => h.seat === 3).at(-1)!.id)
  })

  it("sendCard moves a card between the table, the hand and the discard pile, and refuses a full hand", () => {
    let s = sendCard(card(), 7, "discard")
    expect(s.piles.discard.some((c) => c.id === 7)).toBe(true)
    s = sendCard(s, 7, "table", { x: 1, z: 2 })
    expect(s.things.find((t) => t.id === 7)).toMatchObject({ x: 1, z: 2 })
    expect(s.piles.discard.some((c) => c.id === 7)).toBe(false)
    const full = { ...card(), hand: { ...card().hand, cards: Array.from({ length: PLAY_DECK.hand }, (_, i) => ({ id: 200 + i, card: i })) } }
    const withCard = addThing(full, newCard)
    expect(sendCard(withCard, withCard.things.at(-1)!.id, "hand")).toBe(withCard)
  })

  it("take stops when the stack is empty", () => {
    const s = presetState("everything")
    expect(take({ ...s, stack: 0 })).toEqual({ ...s, stack: 0 })
    expect(take(s).stack).toBe(s.stack - 1)
  })
})

describe("scoring", () => {
  it("addPoints counts in the round, never under zero, and logs it", () => {
    let s = addPoints(card(), 1, 5)
    expect(s.score.points[1]).toBe(5)
    expect(s.log[0]).toMatch(/Basile \+5/)
    s = addPoints(s, 1, -9)
    expect(s.score.points[1]).toBe(0)
    expect(addPoints(card(), 99, 1)).toEqual(card())
  })

  it("endRound banks the round into the totals, starts the next and says who leads", () => {
    const s = endRound(card())
    expect(s.score.total.slice(0, 4)).toEqual([15, 5, 30, 8])
    expect(s.score.points.every((p) => p === 0)).toBe(true)
    expect(s.score.round).toBe(4)
    expect(s.log[0]).toMatch(/Camille leads with 30/)
  })

  it("nextTurn goes round the players it has, and leader ignores seats that are not playing", () => {
    expect(nextTurn({ ...card(), turn: 3 }).turn).toBe(0)
    expect(leader(card())).toBe(2)
    expect(leader({ players: 2, score: { round: 1, points: [0, 0, 0, 0, 0, 0, 0, 0], total: [0, 0, 50, 0, 0, 0, 0, 0] } })).toBeNull()
  })
})

describe("the table", () => {
  it("adds things until it is full and puts each in a free place", () => {
    let s = presetState("empty")
    for (let i = 0; i < PLAY_LIMITS.things + 5; i++) s = addThing(s, newCard)
    expect(s.things).toHaveLength(PLAY_LIMITS.things)
    const places = new Set(s.things.map((t) => `${t.x},${t.z}`))
    expect(places.size).toBeGreaterThan(10)
  })

  it("keeps new things off the piles in the middle", () => {
    const s = card()
    const at = freeSlot(s)
    expect(Math.hypot(at.x - -3.1, at.z - -0.6)).toBeGreaterThan(2)
  })

  it("showParts backs the camera off and brings the piles with the floor buttons", () => {
    const s = showParts({ ...presetState("empty"), zoom: 14 }, ["floor"], true)
    expect(s.parts.floor && s.parts.piles).toBe(true)
    expect(s.layout.piles).toBe("middle")
    expect(s.zoom).toBeGreaterThanOrEqual(20)
    expect(showParts(s, ["floor"], false).parts.floor).toBe(false)
  })

  it("reshapeBoard re-seats the pieces on cells, never two on one, whichever way the shape goes", () => {
    let s = presetState("board")
    for (const shape of ["hex", "loop", "grid", "loop"] as const) {
      s = reshapeBoard(s, { shape })
      const centres = cellCentres(planOf(s.board))
      const cells = s.things.map((t) => cellAt(centres, t, 0.1))
      expect(cells.every((cell) => cell >= 0), shape).toBe(true)
      expect(new Set(cells).size, shape).toBe(cells.length)
    }
  })

  it("stay banks the points of the seat whose turn it is and passes the turn; hit gives it a card and a point", () => {
    const s = stay(card())
    expect(s.score.total[0]).toBe(15)
    expect(s.score.points[0]).toBe(0)
    expect(s.turn).toBe(1)
    const hit1 = hit(card())
    expect(hit1.score.points[0]).toBe(4)
    expect(hit1.hand.cards).toHaveLength(6)
  })

  it("rollDice rolls the tray and switches it on", () => {
    const s = rollDice(presetState("empty"))
    expect(s.parts.dice).toBe(true)
    expect(s.dice.rolls).toBe(1)
  })

  it("say keeps the newest lines first and no more than the limit", () => {
    let s = presetState("empty")
    for (let i = 0; i < PLAY_LOG_MAX + 5; i++) s = say(s, `line ${i}`)
    expect(s.log).toHaveLength(PLAY_LOG_MAX)
    expect(s.log[0]).toBe(`line ${PLAY_LOG_MAX + 4}`)
  })
})
