import { playFor, playOn, waitingPlayers } from "@pbgo/engine-kit"
import { deepFreeze } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import { activePlayerId } from "./machine"
import { card, handOfPlayer, layout, newState, players, problems, seedOf } from "./test-utils"

const refused = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return (error as { code?: string }).code ?? error
  }
  return null
}

describe("GAME.autoPlayFor (an absent player)", () => {
  it("reads the missions of one player while the opening lasts: the others are still waited for", () => {
    const next = playFor(GAME, newState(3), "bob")
    expect(next.read).toEqual([false, true, false])
    expect(waitingPlayers(GAME, next)).toEqual(["ana", "cleo"])
  })

  it("starts the banquet when the last missions are read", () => {
    let state = newState(3)
    state = playFor(GAME, state, "ana")
    state = playFor(GAME, state, "cleo")
    expect(activePlayerId(state)).toBeNull()
    state = playFor(GAME, state, "bob")
    expect(waitingPlayers(GAME, state)).toEqual([state.seats[state.active]])
  })

  it("plays the whole turn of the player of the turn, whichever zones that takes", () => {
    const state = GAME.debug!.missions!(newState(3))
    const [active] = waitingPlayers(GAME, state)
    const next = playFor(GAME, state, active!)
    expect(waitingPlayers(GAME, next)).not.toContain(active)
    expect(next.zones).toEqual([])
    // three cards went from the hand to the table or a domain, and three came back from the deck
    expect(next.table.length + next.domains.flat().length + next.eliminated.length).toBe(3)
    expect(handOfPlayer(next, active!)).toHaveLength(3)
    expect(problems(next)).toEqual([])
  })

  it("plays a turn of fewer cards when the hand runs out, and ends the game when nobody holds a card", () => {
    const state = layout({ players: 2, hands: { ana: [card("hare")], bob: [card("stag")] } })
    const afterAna = playFor(GAME, state, "ana")
    expect(afterAna.table.length + afterAna.domains.flat().length).toBe(1)
    expect(GAME.isOver(playFor(GAME, afterAna, "bob"))).toBe(true)
  })

  it("refuses a player the game is not waiting for", () => {
    const opening = newState(3)
    const read = GAME.apply(opening, { type: "readMissions", playerId: "ana" })
    expect(refused(() => GAME.autoPlayFor!(read, "ana"))).toBe("NOT_WAITING")
    expect(refused(() => playFor(GAME, read, "ana"))).toBe("NOT_WAITING")
    expect(refused(() => GAME.autoPlayFor!(opening, "ghost"))).toBe("NOT_WAITING")

    const banquet = GAME.debug!.missions!(opening)
    const waiting = waitingPlayers(GAME, banquet)[0]!
    const other = players(3).find((player) => player.id !== waiting)!.id
    expect(refused(() => GAME.autoPlayFor!(banquet, other))).toBe("NOT_WAITING")
    expect(refused(() => GAME.autoPlayFor!(GAME.debug!.over!(banquet), waiting))).toBe("NOT_WAITING")
  })

  it("leaves the state it was given untouched", () => {
    const state = deepFreeze(newState(3))
    playFor(GAME, state, "cleo")
    expect(state.read).toEqual([false, false, false])
    const banquet = deepFreeze(GAME.debug!.missions!(newState(3)))
    expect(() => playFor(GAME, banquet, waitingPlayers(GAME, banquet)[0]!)).not.toThrow()
  })

  it("says what it did, as `autoPlayStep`, and the state is the same", () => {
    const state = GAME.debug!.missions!(newState(3, seedOf(4)))
    const [active] = waitingPlayers(GAME, state)
    const played = GAME.autoPlayStep!(state, active!)
    expect(played.state).toEqual(GAME.autoPlayFor!(state, active!))
    const types = played.events.map(({ event }) => event.type)
    expect(types.filter((type) => type === "cardPlayed")).toHaveLength(3)
    expect(types.at(-1)).toBe("draw")
  })

  it("can play a whole table of absent players to the end, opening included, at every size", () => {
    for (const n of [2, 3, 4, 5]) {
      const over = playOn(GAME, newState(n, seedOf(n)))
      expect(GAME.isOver(over)).toBe(true)
      expect(over.read.every(Boolean)).toBe(true)
      expect(problems(over)).toEqual([])
    }
  })
})

describe("GAME.debug", () => {
  it("`missions` says that every player has read: the banquet starts", () => {
    const state = newState(4)
    const started = GAME.debug!.missions!(state)
    expect(started.read.every(Boolean)).toBe(true)
    expect(waitingPlayers(GAME, started)).toEqual([started.seats[started.active]])
    // a second time changes nothing
    expect(GAME.debug!.missions!(started)).toEqual(started)
  })

  it("`turn` plays the turn that is going on, the missions being read first when they were not", () => {
    const next = GAME.debug!.turn!(newState(3))
    expect(next.read.every(Boolean)).toBe(true)
    expect(next.zones).toEqual([])
    expect(next.table.length + next.domains.flat().length + next.eliminated.length).toBe(3)
  })

  it("`over` plays the game to the end and leaves a game that is over as it is", () => {
    const over = GAME.debug!.over!(newState(3))
    expect(GAME.isOver(over)).toBe(true)
    expect(GAME.debug!.over!(over)).toEqual(over)
    expect(GAME.debug!.turn!(over)).toEqual(over)
  })
})
