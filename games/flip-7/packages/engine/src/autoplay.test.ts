import { createRng, playFor, playOn, waitingPlayers } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { autoPlayFor } from "./autoplay"
import { GAME } from "./game"
import { deal, deckTitles, decisionOf, hit, layout, lineTitles, newState, problems, refusal, seedOf, statusOf, stay, waiting } from "./test-utils"

// An absent player is played for, one step at a time, by `autoPlayFor` (engine contract v2). It is a fallback to keep the table moving,
// not an AI: legal, complete, and always the same for the same state.

describe("playing for an absent player", () => {
  it("makes them stay on their turn, which banks what they hold", () => {
    const state = autoPlayFor(layout({ lines: { ana: ["number-9", "plus-2"] }, deck: ["number-1"] }), "ana")
    expect(statusOf(state, "ana")).toBe("stayed")
    expect(deckTitles(state)[0]).toBe("number-1")
    expect(waiting(state)).toBe("bob")
  })

  it("makes them hit when they have nothing in front of them: they cannot stay", () => {
    const state = autoPlayFor(layout({ deck: ["number-5"] }), "ana")
    expect(lineTitles(state, "ana")).toEqual(["number-5"])
    expect(statusOf(state, "ana")).toBe("active")
  })

  it("freezes the player themselves when they hold a Freeze: they bank, and stop holding the table up", () => {
    const drawn = hit(layout({ lines: { ana: ["number-9"] }, deck: ["freeze"] }), "ana")
    const state = autoPlayFor(drawn, "ana")
    expect(statusOf(state, "ana")).toBe("frozen")
    expect(waiting(state)).toBe("bob")
  })

  it("gives a Flip Three to the next player clockwise who can get it, never to themselves when somebody else can", () => {
    const drawn = hit(layout({ deck: ["flip-three", "number-1", "number-2", "number-3"] }), "ana")
    const state = autoPlayFor(drawn, "ana")
    expect(lineTitles(state, "bob")).toEqual(["flip-three", "number-1", "number-2", "number-3"])
    expect(lineTitles(state, "ana")).toEqual([])
    // the next one clockwise is the next one still in: bob stayed, so it is cleo
    const skipped = hit(layout({ lines: { bob: ["number-5"] }, status: { bob: "stayed" }, deck: ["flip-three", "number-1", "number-2", "number-3"] }), "ana")
    expect(lineTitles(autoPlayFor(skipped, "ana"), "cleo")).toEqual(["flip-three", "number-1", "number-2", "number-3"])
  })

  it("gives a Second Chance to the next player clockwise who can get it", () => {
    const drawn = hit(layout({ lines: { ana: ["second-chance"], bob: ["second-chance"] }, deck: ["second-chance"] }), "ana")
    // only cleo can get it: nothing to decide, the card is already hers
    expect(lineTitles(drawn, "cleo")).toEqual(["second-chance"])
    const open = hit(layout({ lines: { ana: ["second-chance"] }, deck: ["second-chance"] }), "ana")
    expect(decisionOf(open).targets).toEqual(["bob", "cleo"])
    expect(lineTitles(autoPlayFor(open, "ana"), "bob")).toEqual(["second-chance"])
  })

  it("deals the next round when the dealer is absent", () => {
    const over = stay(stay(stay(layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] }, deck: ["number-1", "number-2", "number-3"] }), "ana"), "bob"), "cleo")
    const state = autoPlayFor(over, "ana")
    expect(lineTitles(state, "bob")).toEqual(["number-1"])
    expect(problems(state)).toEqual([])
  })

  it("completes the step: the player is no longer waited for it", () => {
    const states = [
      layout({ lines: { ana: ["number-9"] } }),
      layout({ deck: ["number-5"] }),
      hit(layout({ deck: ["freeze"] }), "ana"),
      hit(layout({ deck: ["flip-three", "number-1", "number-2", "number-3"] }), "ana"),
      stay(stay(stay(layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] } }), "ana"), "bob"), "cleo"),
    ]
    for (const state of states) {
      const who = waiting(state)!
      const next = autoPlayFor(state, who)
      expect(next, who).not.toEqual(state)
      expect(problems(next)).toEqual([])
      expect(GAME.waitingFor!(next).length).toBeLessThanOrEqual(1)
    }
  })

  it("refuses with NOT_WAITING a player the game does not wait for, a stranger, and anybody once the game is over", () => {
    const state = layout({ lines: { ana: ["number-9"] } })
    expect(refusal(() => autoPlayFor(state, "bob"))).toBe("NOT_WAITING")
    expect(refusal(() => autoPlayFor(state, "stranger"))).toBe("NOT_WAITING")
    const over = stay(stay(stay(layout({ lines: { ana: ["number-12"], bob: ["number-4"], cleo: ["number-3"] }, rounds: [[190, 150, 100]] }), "ana"), "bob"), "cleo")
    expect(refusal(() => autoPlayFor(over, "ana"))).toBe("NOT_WAITING")
  })

  it("is always the same for the same state: no random number, no clock", () => {
    const state = hit(layout({ lines: { ana: ["number-9"] }, deck: ["flip-three", "number-1", "number-2", "number-3"] }), "ana")
    expect(autoPlayFor(state, "ana")).toEqual(autoPlayFor(structuredClone(state), "ana"))
  })

  it("is what the platform calls: playFor and waitingPlayers of the kit", () => {
    const state = layout({ lines: { ana: ["number-9"] } })
    expect(waitingPlayers(GAME, state)).toEqual(["ana"])
    expect(playFor(GAME, state, "ana")).toEqual(autoPlayFor(state, "ana"))
    expect(refusal(() => playFor(GAME, state, "bob"))).toBe("NOT_WAITING")
  })

  it("plays a whole game alone, for every player, to the end", () => {
    for (const [n, seed] of [
      [3, 1],
      [5, 2],
      [10, 3],
      [18, 4],
    ] as const) {
      const state = playOn(GAME, newState(n, seedOf(seed)), 20_000)
      expect(GAME.isOver(state), `${n} players`).toBe(true)
      expect(problems(state), `${n} players`).toEqual([])
    }
  })

  it("plays a game where only some players are absent, whatever the others do", () => {
    const rng = createRng(seedOf(11))
    let state = newState(4, seedOf(11))
    for (let i = 0; i < 20_000 && !GAME.isOver(state); i++) {
      const [who] = waitingPlayers(GAME, state)
      state = who !== undefined && (who === "ana" || rng() < 0.3) ? playFor(GAME, state, who) : hitOrStay(state, rng)
    }
    expect(GAME.isOver(state)).toBe(true)
  })
})

/** A present player: stays about half the time, and picks a random target. */
function hitOrStay(state: ReturnType<typeof newState>, rng: () => number) {
  const [who] = waitingPlayers(GAME, state)
  if (who === undefined) return state
  const top = state.stack.at(-1)
  if (top === undefined) return deal(state, who)
  if (top.kind === "turn") return state.lines[top.seat]!.length > 0 && rng() < 0.5 ? stay(state, who) : hit(state, who)
  const { targets } = decisionOf(state)
  return GAME.apply(state, { type: "target", playerId: who, target: targets[Math.floor(rng() * targets.length)]! })
}
