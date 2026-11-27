import type { CharacterKey, Face, PlayerView, PublicPhase } from "@love-letter/engine"
import { describe, expect, it } from "vitest"
import { MISSING_CATALOG } from "../../lib/catalog"
import { type Choice, keepAction, lensIds, NO_CHOICE, playAction, pressable, pressCard, pickGuess, pickPlayer, pressName, pressPlayer, promptOf, type Step, stepOf, validChoice } from "./turn"

const face = (id: number, type: CharacterKey): Face => ({ id, type })

/** A view of a table of `others` opponents as the viewer `ada` reads it, with what a test changes */
function viewOf({ hand, playable, phase, targets = ["ben", "cleo"] }: { hand: Face[]; playable?: number[]; phase?: PublicPhase; targets?: string[] }): PlayerView {
  return {
    options: {},
    me: { id: "ada", hand, playable: playable ?? hand.map((card) => card.id) },
    players: [],
    standings: [],
    deck: { size: 10 },
    aside: 1,
    faceUp: [],
    round: 1,
    target: 4,
    phase: phase ?? { kind: "turn", player: "ada", targets },
    results: null,
  }
}

const turn = (hand: Face[], extra: { playable?: number[]; targets?: string[] } = {}) => viewOf({ hand, ...extra })

/** What pressing a card holds, and sends: the choice it makes, or the action it sends */
const chosen = (press: ReturnType<typeof pressCard>) => (press?.kind === "choose" ? press.choice : undefined)
const sent = (press: ReturnType<typeof pressCard>) => (press?.kind === "send" ? press.action : undefined)

describe("what the board offers on the viewer's turn", () => {
  it("asks for a card first, and says when only the Countess can be played", () => {
    expect(stepOf(turn([face(1, "guard"), face(2, "priest")]), NO_CHOICE)).toEqual({ kind: "pick", forced: false })
    expect(stepOf(turn([face(1, "countess"), face(2, "king")], { playable: [1] }), NO_CHOICE)).toEqual({ kind: "pick", forced: true })
  })

  it("lights the players that can be picked for a Priest, a Baron or a King, never the viewer", () => {
    for (const type of ["priest", "baron", "king"] as const) {
      const hand = [face(1, type), face(2, "spy")]
      const choice = chosen(pressCard(turn(hand), NO_CHOICE, hand[0]!))!
      expect(stepOf(turn(hand), choice), type).toEqual({ kind: "target", card: hand[0], targets: ["ben", "cleo"], self: false })
    }
  })

  it("lights the viewer as well for a Prince, who can pick any player, and only the viewer when the others are out or protected", () => {
    const hand = [face(1, "prince"), face(2, "spy")]
    expect(stepOf(turn(hand), { card: 1 })).toEqual({ kind: "target", card: hand[0], targets: ["ada", "ben", "cleo"], self: true })
    expect(stepOf(turn(hand, { targets: [] }), { card: 1 })).toEqual({ kind: "target", card: hand[0], targets: ["ada"], self: true })
  })

  it("asks a Guard's player on the table and the character it names in the row, the only player that can be picked chosen already", () => {
    const hand = [face(1, "guard"), face(2, "spy")]
    const picked: Choice = { card: 1 }
    expect(stepOf(turn(hand), picked)).toEqual({ kind: "name", card: hand[0], targets: ["ben", "cleo"], target: null, guess: null })
    expect(stepOf(turn(hand, { targets: ["cleo"] }), picked)).toEqual({ kind: "name", card: hand[0], targets: ["cleo"], target: "cleo", guess: null })
    expect(stepOf(turn(hand), { card: 1, target: "ben", guess: "baron" })).toEqual({ kind: "name", card: hand[0], targets: ["ben", "cleo"], target: "ben", guess: "baron" })
  })

  it("forgets a Guard's player who can no longer be picked, and never names the Guard", () => {
    const hand = [face(1, "guard"), face(2, "spy")]
    expect(stepOf(turn(hand), { card: 1, target: "dan", guess: "guard" })).toMatchObject({ kind: "name", target: null, guess: null })
  })

  it("never offers a card the Countess rule forbids, even when it is the one that was picked", () => {
    const hand = [face(1, "countess"), face(2, "king")]
    const view = turn(hand, { playable: [1] })
    expect(stepOf(view, { card: 2 })).toEqual({ kind: "pick", forced: true })
    expect(pressable(view, hand[0]!)).toBe(true)
    expect(pressable(view, hand[1]!)).toBe(false)
    expect(pressCard(view, NO_CHOICE, hand[1]!)).toBeNull()
  })

  it("offers nothing to a spectator, to another player's turn, or to the viewer once the game is over", () => {
    const hand = [face(1, "guard"), face(2, "spy")]
    expect(stepOf({ ...turn(hand), me: null }, NO_CHOICE)).toEqual({ kind: "none" })
    expect(stepOf(viewOf({ hand, phase: { kind: "turn", player: "ben", targets: ["ada", "cleo"] } }), NO_CHOICE)).toEqual({ kind: "none" })
    expect(stepOf(viewOf({ hand, phase: { kind: "over" } }), NO_CHOICE)).toEqual({ kind: "none" })
    expect(pressable(viewOf({ hand, phase: { kind: "turn", player: "ben", targets: [] } }), hand[0]!)).toBe(false)
  })
})

describe("pressing a card of the hand on the viewer's turn", () => {
  it("plays at once a card that picks nobody, whoever could be picked", () => {
    for (const type of ["spy", "handmaid", "countess", "princess", "chancellor"] as const) {
      const hand = [face(1, type), face(2, "guard")]
      expect(sent(pressCard(turn(hand), NO_CHOICE, hand[0]!)), type).toEqual({ type: "play", card: 1 })
    }
  })

  it("plays at once a card that picks another player when nobody can be picked: it has no effect and no player may be named", () => {
    for (const type of ["guard", "priest", "baron", "king"] as const) {
      const hand = [face(1, type), face(2, "spy")]
      expect(sent(pressCard(turn(hand, { targets: [] }), NO_CHOICE, hand[0]!)), type).toEqual({ type: "play", card: 1 })
    }
  })

  it("holds a card that picks a player until that player is chosen (pressed on the table, or in a Guard's window), and a Prince's own player is always there to be pressed", () => {
    for (const type of ["guard", "priest", "baron", "king", "prince"] as const) {
      const hand = [face(1, type), face(2, "spy")]
      expect(chosen(pressCard(turn(hand), NO_CHOICE, hand[0]!)), type).toEqual({ card: 1 })
    }
    const prince = [face(1, "prince"), face(2, "spy")]
    expect(chosen(pressCard(turn(prince, { targets: [] }), NO_CHOICE, prince[0]!))).toEqual({ card: 1 })
  })

  it("puts the card held back when it is pressed again, and holds another when another is pressed", () => {
    const hand = [face(1, "guard"), face(2, "king")]
    const held: Choice = { card: 1 }
    expect(chosen(pressCard(turn(hand), held, hand[0]!))).toEqual(NO_CHOICE)
    expect(chosen(pressCard(turn(hand), held, hand[1]!))).toEqual({ card: 2 })
  })

  it("plays the card held on the player pressed on the table", () => {
    const priest = stepOf(turn([face(1, "priest"), face(2, "spy")]), { card: 1 }) as Extract<Step, { kind: "target" }>
    expect(pressPlayer(priest, "ben")).toEqual({ kind: "send", action: { type: "play", card: 1, target: "ben" } })
  })

  it("plays the Guard by its button only once its player and its character are chosen, each picked and put back by a press", () => {
    const view = turn([face(1, "guard"), face(2, "spy")])
    const at = (choice: Choice) => stepOf(view, choice) as Extract<Step, { kind: "name" }>
    expect(pressName(at({ card: 1 }))).toBeNull()
    expect(pickPlayer(at({ card: 1 }), "ben")).toEqual({ kind: "choose", choice: { card: 1, target: "ben", guess: null } })
    expect(pickGuess(at({ card: 1, target: "ben" }), "baron")).toEqual({ kind: "choose", choice: { card: 1, target: "ben", guess: "baron" } })
    expect(pressName(at({ card: 1, guess: "baron" }))).toBeNull()
    expect(pressName(at({ card: 1, target: "ben", guess: "baron" }))).toEqual({ kind: "send", action: { type: "play", card: 1, target: "ben", guess: "baron" } })
    // pressed again, the character and the player are put back
    expect(pickGuess(at({ card: 1, target: "ben", guess: "baron" }), "baron")).toEqual({ kind: "choose", choice: { card: 1, target: "ben", guess: null } })
    expect(pickPlayer(at({ card: 1, target: "ben", guess: "baron" }), "ben")).toEqual({ kind: "choose", choice: { card: 1, target: null, guess: "baron" } })
  })
})

describe("a Chancellor's keep", () => {
  const hand = [face(1, "guard"), face(2, "chancellor"), face(3, "king")]
  const keep = viewOf({ hand, phase: { kind: "keep", player: "ada" } })

  it("asks for the card to keep first, and every card of the hand can be pressed", () => {
    expect(stepOf(keep, NO_CHOICE)).toEqual({ kind: "keep" })
    for (const card of hand) expect(pressable(keep, card)).toBe(true)
  })

  it("holds the card pressed as the one kept, then sends the card pressed next as the one that goes under the deck first and the other last", () => {
    const kept = chosen(pressCard(keep, NO_CHOICE, hand[1]!))!
    expect(kept).toEqual({ card: 2 })
    const step = stepOf(keep, kept) as Extract<Step, { kind: "order" }>
    expect(step.kind).toBe("order")
    expect(step.kept).toEqual(hand[1])
    expect(step.others.map((card) => card.id)).toEqual([1, 3])
    expect(sent(pressCard(keep, kept, hand[2]!))).toEqual({ type: "keep", card: 2, bottom: [3, 1] })
    expect(sent(pressCard(keep, kept, hand[0]!))).toEqual({ type: "keep", card: 2, bottom: [1, 3] })
  })

  it("puts the card kept back when it is pressed again", () => {
    expect(chosen(pressCard(keep, { card: 2 }, hand[1]!))).toEqual(NO_CHOICE)
  })

  it("sends the move at once for a hand of two: the card pressed is kept and the other goes under the deck, with nothing to order", () => {
    const two = viewOf({ hand: [face(1, "guard"), face(2, "chancellor")], phase: { kind: "keep", player: "ada" } })
    expect(sent(pressCard(two, NO_CHOICE, two.me!.hand[0]!))).toEqual({ type: "keep", card: 1, bottom: [2] })
    expect(keepAction(two.me!.hand[1]!, [two.me!.hand[0]!])).toEqual({ type: "keep", card: 2, bottom: [1] })
  })

  it("is not offered to the other players", () => {
    expect(stepOf(viewOf({ hand, phase: { kind: "keep", player: "ben" } }), NO_CHOICE)).toEqual({ kind: "none" })
    expect(pressCard(viewOf({ hand, phase: { kind: "keep", player: "ben" } }), NO_CHOICE, hand[0]!)).toBeNull()
  })
})

describe("dealing the next round", () => {
  it("offers the Deal button to the player who takes the first turn, and nothing to the others", () => {
    const between = (next: string): PublicPhase => ({ kind: "between", next, winners: ["ben"], spy: null, revealed: true })
    expect(stepOf(viewOf({ hand: [], phase: between("ada") }), NO_CHOICE)).toEqual({ kind: "deal" })
    expect(stepOf(viewOf({ hand: [], phase: between("ben") }), NO_CHOICE)).toEqual({ kind: "none" })
  })
})

describe("what was picked", () => {
  it("ends when it no longer fits the view: the card left the hand, the turn passed, the rule forbids the card or nobody is left to pick", () => {
    const hand = [face(1, "guard"), face(2, "spy")]
    const picked: Choice = { card: 1 }
    expect(validChoice(turn(hand), picked)).toBe(picked)
    expect(validChoice(turn([face(5, "king"), face(2, "spy")]), picked)).toEqual(NO_CHOICE)
    expect(validChoice(viewOf({ hand, phase: { kind: "turn", player: "ben", targets: ["ada"] } }), picked)).toEqual(NO_CHOICE)
    expect(validChoice(turn(hand, { targets: ["cleo"] }), picked)).toEqual({ card: 1 })
    expect(validChoice(turn(hand, { playable: [2] }), picked)).toEqual(NO_CHOICE)
    expect(validChoice(turn(hand, { targets: [] }), picked)).toEqual(NO_CHOICE)
    expect(validChoice({ ...turn(hand), me: null }, picked)).toEqual(NO_CHOICE)
    expect(validChoice(turn(hand), NO_CHOICE)).toBe(NO_CHOICE)
  })

  it("holds the card kept after a Chancellor while the keep goes on, and ends with it", () => {
    const hand = [face(1, "guard"), face(2, "chancellor"), face(3, "king")]
    const picked: Choice = { card: 2 }
    expect(validChoice(viewOf({ hand, phase: { kind: "keep", player: "ada" } }), picked)).toBe(picked)
    expect(validChoice(viewOf({ hand: [face(1, "guard")], phase: { kind: "keep", player: "ada" } }), picked)).toEqual(NO_CHOICE)
    expect(validChoice(viewOf({ hand, phase: { kind: "turn", player: "ada", targets: [] } }), picked)).toEqual(NO_CHOICE)
  })
})

describe("what is sent", () => {
  it("names the card, and the player and the character only when it has them", () => {
    expect(playAction(face(4, "handmaid"))).toEqual({ type: "play", card: 4 })
    expect(playAction(face(4, "priest"), "ben")).toEqual({ type: "play", card: 4, target: "ben" })
    expect(playAction(face(4, "guard"), "ben", "baron")).toEqual({ type: "play", card: 4, target: "ben", guess: "baron" })
  })
})

describe("what the ticker is told to say", () => {
  const words = Object.fromEntries(Object.keys(MISSING_CATALOG.words).map((key) => [key, `<${key}>`])) as typeof MISSING_CATALOG.words

  it("names what to do for each step, in the game's words, and nothing for the steps that need none", () => {
    expect(promptOf({ kind: "pick", forced: false }, words)).toBe("<pickCard>")
    expect(promptOf({ kind: "pick", forced: true }, words)).toBe("<mustPlayCountess>")
    expect(promptOf({ kind: "target", card: face(1, "priest"), targets: ["ben"], self: false }, words)).toBe("<chooseOther>")
    expect(promptOf({ kind: "target", card: face(1, "prince"), targets: ["ada", "ben"], self: true }, words)).toBe("<chooseAny>")
    expect(promptOf({ kind: "name", card: face(1, "guard"), targets: ["ben", "cleo"], target: null, guess: null }, words)).toBe("<chooseOther>")
    expect(promptOf({ kind: "name", card: face(1, "guard"), targets: ["ben"], target: "ben", guess: null }, words)).toBe("<nameCharacter>")
    expect(promptOf({ kind: "keep" }, words)).toBe("<keepOne>")
    expect(promptOf({ kind: "order", kept: face(2, "chancellor"), others: [face(1, "guard"), face(3, "king")] }, words)).toBe("<putBack>")
    // the Deal button says what it does by its label
    expect(promptOf({ kind: "deal" }, words)).toBeNull()
    expect(promptOf({ kind: "none" }, words)).toBeNull()
  })
})

describe("the cards the lens may hold", () => {
  it("are the faces on the table: the hand, the play areas, the hands laid down and the cards set aside, with the two faces of a reveal when they are there", () => {
    const view = { ...viewOf({ hand: [face(1, "guard"), face(2, "spy")] }), faceUp: [face(7, "priest")], players: [{ id: "ben", cards: 1, hand: [face(8, "king")], area: [face(9, "baron")], out: false, shielded: false, tokens: 0 }] }
    expect([...lensIds(view, false)].sort()).toEqual([1, 2, 7, 8, 9])
    expect([...lensIds(view, true)].filter((id) => id < 0)).toEqual([-100, -101])
  })
})
