import { type Rng, createRng } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { CATALOGUE, FAMILIES, weight } from "./catalogue"
import { activePlayerId, domainOf, handOf, isOver, typeOf } from "./machine"
import { newState, problems, seedOf } from "./test-utils"
import { type Action, COURTISANS_ERROR_CODES, type State, type Target } from "./types"
import { playerView } from "./view"

/** A random legal move, picked through the public view only (a card of the hand, a free zone, a level or an opponent, a victim that is not a guard). */
function randomMove(state: State, rng: Rng): Action {
  const active = activePlayerId(state)!
  const view = playerView(state, active)
  const hand = view.me!.hand
  const picked = hand[Math.floor(rng() * hand.length)]!
  const zone = view.availableZones[Math.floor(rng() * view.availableZones.length)]!
  const opponents = view.players.filter((player) => player.id !== active)
  const target: Target =
    zone === "table"
      ? { zone: "table", level: rng() < 0.5 ? "up" : "down" }
      : { zone: "domain", playerId: zone === "domain" ? active : opponents[Math.floor(rng() * opponents.length)]!.id }
  let victimId: number | undefined
  if (picked.role === "assassin" && rng() < 0.8) {
    const cards = target.zone === "table" ? view.table.map((placement) => placement.card) : view.players.find((player) => player.id === target.playerId)!.domain
    const victims = cards.filter((visible) => visible.role !== "guard")
    victimId = victims[Math.floor(rng() * victims.length)]?.id
  }
  return { type: "playCard", playerId: active, cardId: picked.id, target, ...(victimId === undefined ? {} : { victimId }) }
}

/** The points of a domain written again from the names of the cards, to be compared with the engine's. */
function domainPointsAgain(state: State, seat: number): number {
  const standing = (family: string) => {
    const side = (level: "up" | "down") =>
      state.table.filter((placed) => placed.level === level && typeOf(state, placed.card).family === family).reduce((sum, placed) => sum + weight(typeOf(state, placed.card).role), 0)
    return Math.sign(side("up") - side("down"))
  }
  return domainOf(state, seat).reduce((sum, id) => sum + weight(typeOf(state, id).role) * standing(typeOf(state, id).family), 0)
}

describe("simulation", () => {
  it.each([2, 3, 4, 5])("plays full random games with %i players, sound at every move", (n) => {
    for (let i = 0; i < 20; i++) {
      const rng = createRng(seedOf(i) + n)
      let state = newState(n, seedOf(i * 7 + n))
      for (const id of state.seats) state = step(state, { type: "readMissions", playerId: id }).state

      let moves = 0
      while (!isOver(state)) {
        state = step(state, randomMove(state, rng)).state
        expect(problems(state), `after move ${moves}`).toEqual([])
        expect(++moves).toBeLessThan(200)
      }

      // every card of the box is somewhere, and every card in play was played
      const places = [state.deck, state.setAside, state.eliminated, ...state.hands, ...state.domains, state.table.map((placed) => placed.card)].flat()
      expect(places).toHaveLength(CATALOGUE.length)
      expect(state.hands.every((hand) => hand.length === 0)).toBe(true)
      expect(state.deck).toHaveLength(0)
      expect(moves).toBe(CATALOGUE.length - state.setAside.length)

      const results = playerView(state, null).results!
      expect(results.winners.length).toBeGreaterThan(0)
      // the points of each domain, written again here from the names of the cards
      for (const player of results.players) expect(player.domainPoints).toBe(domainPointsAgain(state, state.seats.indexOf(player.playerId)))
      for (const family of FAMILIES) expect(results.statuses[family].up + results.statuses[family].down).toBe(state.table.filter((placed) => typeOf(state, placed.card).family === family).reduce((sum, placed) => sum + weight(typeOf(state, placed.card).role), 0))
    }
  })

  it("refuses only with the codes of its list", () => {
    const rng = createRng(11)
    let state = newState(3, seedOf(5))
    for (const id of state.seats) state = step(state, { type: "readMissions", playerId: id }).state
    const known = new Set<string>(COURTISANS_ERROR_CODES)
    for (let i = 0; i < 300 && !isOver(state); i++) {
      // a move that is wrong on purpose, then a right one
      const active = activePlayerId(state)!
      const hand = handOf(state, state.seats.indexOf(active))
      const wrong: Action[] = [
        { type: "playCard", playerId: active, cardId: hand[0]!, target: { zone: "domain", playerId: "nobody" } },
        { type: "playCard", playerId: state.seats.find((id) => id !== active)!, cardId: hand[0]!, target: { zone: "table", level: "up" } },
        { type: "playCard", playerId: active, cardId: -5, target: { zone: "table", level: "up" } },
      ]
      for (const action of wrong) {
        try {
          step(state, action)
          throw new Error("accepted")
        } catch (error) {
          expect(known.has((error as { code?: string }).code ?? "")).toBe(true)
        }
      }
      state = step(state, randomMove(state, rng)).state
    }
  })
})
