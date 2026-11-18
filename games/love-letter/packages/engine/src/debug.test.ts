import { describe, expect, it } from "vitest"
import { CATALOGUE } from "./catalogue"
import { debugCommands } from "./debug"
import { GAME } from "./game"
import { tokensToWin } from "./options"
import { areaNames, deckNames, handNames, kinds, layout, names, newState, playCard, problems, seedOf, tokens, viewOf, waiting } from "./test-utils"
import type { State } from "./types"

// The debug panel: development only. Each command is a function of a state, and leaves a state the rules could have reached.

const run = (command: string, state: State) => debugCommands[command]!(state)

/** Every card of the box is in exactly one place, whatever the rig did. */
const sound = (state: State) => {
  expect(problems(state)).toEqual([])
  const placed = [...state.deck, ...(state.aside === null ? [] : [state.aside]), ...state.faceUp, ...state.hands.flat(), ...state.areas.flat()]
  expect(names(state, placed).sort()).toEqual([...CATALOGUE].sort())
}

describe("the commands that play", () => {
  it("`turn` plays the current turn out, as an absent player would: the next player is waited for", () => {
    const state = newState(4, seedOf(2))
    const [before] = waiting(state)
    const after = run("turn", state)
    expect(waiting(after)).not.toEqual([before])
    sound(after)
  })

  it("`turn` deals the next round between two rounds", () => {
    const ended = layout({ stage: "between", between: { revealed: true, winners: ["bob"] }, turn: "bob", won: { bob: 1 } })
    const after = run("turn", ended)
    expect(after.round).toBe(2)
    expect(after.stage).toEqual({ kind: "play" })
  })

  it("`round` plays the round out to its count: the favor tokens are written", () => {
    const state = newState(3, seedOf(3))
    const after = run("round", state)
    expect(after.stage.kind).toBe("between")
    expect(tokens(after).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    sound(after)
  })

  it("`round` from a round that is counted deals the next one and plays it out too", () => {
    // three players need five tokens: one round never ends the game
    const first = run("round", newState(3, seedOf(4)))
    expect(GAME.isOver(first)).toBe(false)
    const second = run("round", first)
    expect(second.round).toBe(first.round + 1)
    expect(second.stage.kind).toBe("between")
  })

  it("`over` plays the game to the end: somebody holds the tokens that win and there are results", () => {
    for (let n = 2; n <= 6; n++) {
      const after = run("over", newState(n, seedOf(n)))
      expect(GAME.isOver(after), `${n} players`).toBe(true)
      expect(GAME.view(after, null).results, `${n} players`).not.toBeNull()
    }
  })

  it("`over` leaves a game that is over as it is", () => {
    const over = run("over", newState(3, seedOf(5)))
    expect(run("over", over)).toEqual(over)
    expect(run("turn", over)).toEqual(over)
    expect(run("round", over)).toEqual(over)
  })
})

describe("the commands that rig a hand", () => {
  const table = () => newState(4, seedOf(6))

  it("`countessAndKing` gives the player whose turn it is the Countess and the King: she must be played (p. 9)", () => {
    for (let i = 0; i < 6; i++) {
      const after = run("countessAndKing", newState(4, seedOf(10 + i)))
      expect(handNames(after, after.seats[after.turn]!).sort(), `seed ${i}`).toEqual(["countess", "king"])
      expect(viewOf(after, after.seats[after.turn]!).me!.playable, `seed ${i}`).toHaveLength(1)
      sound(after)
    }
  })

  it("`princessInHand` gives the player whose turn it is the Princess", () => {
    const after = run("princessInHand", table())
    expect(handNames(after, after.seats[after.turn]!)).toContain("princess")
    sound(after)
  })

  it("`chancellorInHand` gives the player whose turn it is a Chancellor", () => {
    const after = run("chancellorInHand", table())
    expect(handNames(after, after.seats[after.turn]!)).toContain("chancellor")
    sound(after)
  })

  it("takes the card from the deck, else from another hand, else from the card set aside, and moves it: nothing is made up", () => {
    // the Princess is set aside, and the player holds no Princess
    const state = layout({ players: 3, hands: { ana: ["guard", "spy"], bob: ["priest"], cleo: ["baron"] }, deck: ["handmaid"], aside: "princess", rest: "away" })
    const after = run("princessInHand", state)
    expect(handNames(after, "ana")).toContain("princess")
    expect(after.aside).not.toBeNull()
    expect(names(after, [after.aside!])).not.toEqual(["princess"])
    // another hand holds the King, the deck and the card set aside do not
    const elsewhere = layout({ players: 3, hands: { ana: ["guard", "spy"], bob: ["king"], cleo: ["baron"] }, deck: ["handmaid"], aside: "priest", rest: "away" })
    expect(handNames(run("countessAndKing", elsewhere), "ana")).not.toContain("countess")
    expect(handNames(run("princessInHand", elsewhere), "ana")).not.toContain("princess")
  })

  it("changes nothing when the character is out of reach: it was played, or it is nowhere to be taken from", () => {
    const state = layout({ players: 3, hands: { ana: ["guard", "spy"], bob: ["priest"], cleo: ["baron"] }, areas: { bob: ["princess"] }, deck: ["handmaid"], rest: "away" })
    expect(run("princessInHand", state)).toEqual(state)
  })

  it("acts only for the player whose turn it is, when they have a card to play", () => {
    const ended = layout({ stage: "between", between: { winners: ["ana"] } })
    for (const command of ["countessAndKing", "princessInHand", "chancellorInHand", "twoCardsLeft", "oneCardLeft", "allProtected"]) {
      expect(run(command, ended), command).toEqual(ended)
    }
    const keeping = playCard(layout({ players: 3, hands: { ana: ["chancellor", "spy"] }, deck: ["priest", "king", "baron"] }), "ana", "chancellor")
    for (const command of ["countessAndKing", "princessInHand", "chancellorInHand", "twoCardsLeft", "oneCardLeft", "allProtected"]) {
      expect(run(command, keeping), command).toEqual(keeping)
    }
  })
})

describe("the commands that rig the deck", () => {
  it("`twoCardsLeft` cuts the deck down to two cards: the others lie face up in front of the players, one after the other", () => {
    const after = run("twoCardsLeft", newState(3, seedOf(7)))
    expect(after.deck).toHaveLength(2)
    expect(after.areas.flat().length).toBeGreaterThan(0)
    sound(after)
  })

  it("`oneCardLeft` cuts the deck down to one card", () => {
    const after = run("oneCardLeft", newState(5, seedOf(8)))
    expect(after.deck).toHaveLength(1)
    sound(after)
  })

  it("puts a Chancellor in the situation of the booklet's last cases: with one card left it draws it and returns one (p. 10)", () => {
    const state = run("oneCardLeft", run("chancellorInHand", newState(3, seedOf(9))))
    const mover = state.seats[state.turn]!
    const after = playCard(state, mover, "chancellor")
    expect(after.stage).toEqual({ kind: "keep" })
    expect(handNames(after, mover)).toHaveLength(2)
    expect(deckNames(after)).toEqual([])
  })

  it("leaves a deck that is already short as it is", () => {
    const state = run("oneCardLeft", newState(4, seedOf(11)))
    expect(run("twoCardsLeft", state)).toEqual(state)
    expect(run("oneCardLeft", state)).toEqual(state)
  })
})

describe("the other rigs", () => {
  it("`allProtected` protects every other player in the round: the cards that pick another player are played with no effect (p. 11)", () => {
    const state = run("allProtected", layout({ players: 3, hands: { ana: ["guard", "spy"], bob: ["priest"], cleo: ["baron"] }, deck: ["handmaid"] }))
    expect(state.shielded).toEqual([false, true, true])
    expect(viewOf(state, "ana").phase).toEqual({ kind: "turn", player: "ana", targets: [] })
    expect(kinds({ events: GAME.step!(state, { type: "play", playerId: "ana", card: state.hands[0]![0]! }).events })).toEqual(["play", "fizzled", "draw"])
  })

  it("`allProtected` leaves out the players who are out of the round", () => {
    const state = run("allProtected", layout({ players: 4, hands: { ana: ["guard", "spy"], bob: ["priest"], dan: ["baron"] }, out: ["cleo"] }))
    expect(state.shielded).toEqual([false, true, false, true])
    expect(problems(state)).toEqual([])
  })

  it("`nearTarget` leaves the first seat one favor token short of the number that wins (p. 7)", () => {
    for (let n = 2; n <= 6; n++) {
      const after = run("nearTarget", newState(n, seedOf(n)))
      expect(tokens(after)[0], `${n} players`).toBe(tokensToWin(n) - 1)
      expect(GAME.isOver(after)).toBe(false)
      expect(problems(after)).toEqual([])
    }
  })

  it("`nearTarget` counts the Spy's tokens of the first seat, and leaves a game that is over as it is", () => {
    const state = layout({ players: 3, spies: { ana: 2 }, won: { ana: 1 } })
    expect(tokens(run("nearTarget", state))[0]).toBe(tokensToWin(3) - 1)
    const over = run("over", newState(3, seedOf(12)))
    expect(run("nearTarget", over)).toEqual(over)
  })

  it("`nearTarget` makes the next round that the first seat wins the last of the game", () => {
    // ana holds the Princess and the others a Guard at the end of the deck: she wins the round, and with the token she needs the game
    const state = run("nearTarget", layout({ players: 3, turn: "ana", hands: { ana: ["countess", "princess"] }, deck: [], rest: "away" }))
    const after = playCard(state, "ana", "countess")
    expect(GAME.isOver(after)).toBe(true)
  })
})

describe("every command", () => {
  it("is a function of the state alone: it writes nothing to the state it is given, and gives the same state twice", () => {
    const state = newState(4, seedOf(13))
    const snapshot = structuredClone(state)
    for (const [name, command] of Object.entries(debugCommands)) {
      const frozen = structuredClone(state)
      expect(command(frozen), name).toEqual(command(structuredClone(state)))
      expect(frozen, name).toEqual(snapshot)
    }
  })

  it("is listed in the definition for the platform", () => {
    expect(Object.keys(GAME.debug!).sort()).toEqual(["allProtected", "chancellorInHand", "countessAndKing", "nearTarget", "oneCardLeft", "over", "princessInHand", "round", "turn", "twoCardsLeft"])
  })

  it("never uses a clock or a dice of the machine: the same seed rigs the same table", () => {
    const real = Math.random
    Math.random = () => {
      throw new Error("Math.random was called")
    }
    try {
      for (const command of Object.values(debugCommands)) expect(() => command(newState(5, seedOf(14)))).not.toThrow()
    } finally {
      Math.random = real
    }
  })

  it("keeps the areas, whatever is rigged: a card played stays in front of its player", () => {
    const state = playCard(layout({ players: 3, hands: { ana: ["countess", "guard"] }, deck: ["priest", "king", "spy"] }), "ana", "countess")
    const after = run("twoCardsLeft", state)
    expect(areaNames(after, "ana")[0]).toBe("countess")
  })
})
