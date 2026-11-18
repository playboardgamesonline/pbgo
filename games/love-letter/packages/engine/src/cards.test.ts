import { viewLog } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { areaNames, handNames, kinds, layout, playCard, playStep, refusal, viewOf, waiting } from "./test-utils"
import type { LoveLetterLogEntry } from "./types"

// Rulebook, pp. 8-13: what each character does when it is played. One section for each, with its page. The log is read the way a player reads it (`viewLog`):
// a private entry shows its card to the players it is for and the fact to everybody else.

/** What a viewer reads of the log of a move. */
const read = (events: readonly LoveLetterLogEntry[], viewer: string | null) => viewLog(events, viewer)

describe("the Guard (p. 12)", () => {
  // ana holds a Guard and a Spy, bob a Priest: bob is not the next to play after the move when there are three players, so the draw does not move his hand
  const table = () => layout({ players: 3, hands: { ana: ["guard", "spy"], bob: ["priest"], cleo: ["baron"] }, deck: ["handmaid", "guard"] })

  it("knocks out the chosen player when they hold the character named: their hand lies face up in front of them (pp. 5, 12)", () => {
    const after = playCard(table(), "ana", "guard", { target: "bob", guess: "priest" })
    expect(after.out).toEqual([false, true, false])
    expect(handNames(after, "bob")).toEqual([])
    expect(areaNames(after, "bob")).toEqual(["priest"])
  })

  it("does nothing when the character named is not the card they hold", () => {
    const after = playCard(table(), "ana", "guard", { target: "cleo", guess: "king" })
    expect(after.out).toEqual([false, false, false])
    expect(handNames(after, "cleo")).toEqual(["baron"])
    expect(areaNames(after, "cleo")).toEqual([])
  })

  it("can name any of the nine characters but the Guard, the Spy included (p. 12)", () => {
    for (const guess of ["spy", "priest", "baron", "handmaid", "prince", "chancellor", "king", "countess", "princess"] as const) {
      expect(() => playCard(table(), "ana", "guard", { target: "bob", guess }), guess).not.toThrow()
    }
  })

  it("cannot name the Guard, nor a character that does not exist, nor nothing (INVALID_CHOICE)", () => {
    for (const guess of ["guard", "dragon", "", undefined, 3, null]) {
      expect(refusal(() => playCard(table(), "ana", "guard", { target: "bob", guess } as never)), String(guess)).toBe("INVALID_CHOICE")
    }
  })

  it("is refused for a player who cannot be picked before the character it names is looked at (INVALID_TARGET)", () => {
    expect(refusal(() => playCard(table(), "ana", "guard", { target: "ana", guess: "guard" }))).toBe("INVALID_TARGET")
  })

  it("tells everybody the guess and whether it was right, and nothing else (p. 12)", () => {
    const hit = playStep(table(), "ana", "guard", { target: "bob", guess: "priest" })
    const miss = playStep(table(), "ana", "guard", { target: "bob", guess: "king" })
    for (const viewer of ["ana", "bob", "cleo", "stranger", null]) {
      expect(read(hit.events, viewer).filter((event) => event.kind === "guess"), String(viewer)).toEqual([{ kind: "guess", by: "ana", target: "bob", guess: "priest", hit: true }])
      expect(read(miss.events, viewer).filter((event) => event.kind === "guess"), String(viewer)).toEqual([{ kind: "guess", by: "ana", target: "bob", guess: "king", hit: false }])
    }
  })

  it("lays the hand of a player who is knocked out face up for everybody (pp. 5, 12)", () => {
    const hit = playStep(table(), "ana", "guard", { target: "bob", guess: "priest" })
    expect(kinds(hit)).toEqual(["play", "guess", "out", "draw"])
    const out = hit.events[2]!.event
    expect(out).toMatchObject({ kind: "out", player: "bob", cause: "guard", cards: [{ type: "priest" }] })
    expect(hit.events[2]!.to).toBeUndefined()
  })

  it("ends the round at once when it leaves one player (p. 6)", () => {
    const state = layout({ players: 2, hands: { ana: ["guard", "spy"], bob: ["priest"] }, deck: ["handmaid"] })
    const { state: after, events } = playStep(state, "ana", "guard", { target: "bob", guess: "priest" })
    expect(after.stage).toMatchObject({ kind: "between", revealed: false, winners: [0] })
    expect(kinds({ events })).toEqual(["play", "guess", "out", "end"])
  })
})

describe("the Priest (p. 12)", () => {
  const table = () => layout({ players: 3, hands: { ana: ["priest", "spy"], bob: ["baron"], cleo: ["king"] }, deck: ["handmaid", "guard"] })

  it("shows the chosen player's card to the player of the Priest alone, who sees nothing else of the others", () => {
    const { events } = playStep(table(), "ana", "priest", { target: "cleo" })
    expect(read(events, "ana").filter((event) => event.kind === "look")).toEqual([{ kind: "look", by: "ana", target: "cleo", card: "king" }])
    for (const viewer of ["bob", "cleo", "stranger", null]) {
      expect(read(events, viewer).filter((event) => event.kind === "look"), String(viewer)).toEqual([{ kind: "look", by: "ana", target: "cleo" }])
    }
  })

  it("changes nothing in the hands: the chosen player keeps their card, and nobody is out", () => {
    const after = playCard(table(), "ana", "priest", { target: "cleo" })
    expect(handNames(after, "cleo")).toEqual(["king"])
    expect(handNames(after, "ana")).toEqual(["spy"])
    expect(after.out).toEqual([false, false, false])
  })

  it("never puts the id of the card it shows in anybody's log: a card that stays in a hand is named by its key", () => {
    const state = table()
    const { events } = playStep(state, "ana", "priest", { target: "cleo" })
    const secret = state.hands[2]![0]!
    for (const viewer of ["ana", "bob", "cleo", "stranger", null]) expect(JSON.stringify(read(events, viewer)), String(viewer)).not.toContain(String(secret))
  })

  it("marks its entry for its player alone: `to` names them and `masked` holds the fact", () => {
    const { events } = playStep(table(), "ana", "priest", { target: "cleo" })
    const look = events.find((entry) => entry.event.kind === "look")!
    expect(look.to).toEqual(["ana"])
    expect(look.masked).toEqual({ kind: "look", by: "ana", target: "cleo" })
  })
})

describe("the Baron (p. 12)", () => {
  // three players, so that the player who draws after ana (bob) can be the one who is not compared
  const table = (anaKeeps: "guard" | "king" | "priest", cleoHolds: "priest" | "king" | "baron" = "priest") =>
    layout({ players: 3, hands: { ana: ["baron", anaKeeps], bob: ["handmaid"], cleo: [cleoHolds] }, deck: ["spy", "guard"] })

  it("knocks out the player with the lower value: the other player (p. 12)", () => {
    const after = playCard(table("king"), "ana", "baron", { target: "cleo" })
    expect(after.out).toEqual([false, false, true])
    expect(areaNames(after, "cleo")).toEqual(["priest"])
    expect(handNames(after, "ana")).toEqual(["king"])
  })

  it("knocks out the player of the Baron when their card is the lower one (p. 12)", () => {
    const after = playCard(table("guard"), "ana", "baron", { target: "cleo" })
    expect(after.out).toEqual([true, false, false])
    // their hand lies face up in front of them, after the Baron
    expect(areaNames(after, "ana")).toEqual(["baron", "guard"])
    expect(handNames(after, "ana")).toEqual([])
  })

  it("spares both players when the values are equal (p. 12)", () => {
    const after = playCard(table("priest"), "ana", "baron", { target: "cleo" })
    expect(after.out).toEqual([false, false, false])
    expect(handNames(after, "ana")).toEqual(["priest"])
    expect(handNames(after, "cleo")).toEqual(["priest"])
  })

  it("shows both cards to the two players alone, and to everybody else that the comparison happened (p. 12)", () => {
    const { events } = playStep(table("king"), "ana", "baron", { target: "cleo" })
    const full = { kind: "compare", by: "ana", target: "cleo", cards: { by: "king", target: "priest" } }
    expect(read(events, "ana").filter((event) => event.kind === "compare")).toEqual([full])
    expect(read(events, "cleo").filter((event) => event.kind === "compare")).toEqual([full])
    for (const viewer of ["bob", "stranger", null]) {
      expect(read(events, viewer).filter((event) => event.kind === "compare"), String(viewer)).toEqual([{ kind: "compare", by: "ana", target: "cleo" }])
    }
  })

  it("lays the hand of the player who loses face up for everybody, and shows a tie to nobody but the two (p. 12)", () => {
    const lost = playStep(table("king"), "ana", "baron", { target: "cleo" })
    for (const viewer of ["bob", null]) {
      expect(read(lost.events, viewer).filter((event) => event.kind === "out"), String(viewer)).toMatchObject([{ kind: "out", player: "cleo", cause: "baron", cards: [{ type: "priest" }] }])
    }
    const tie = playStep(table("priest"), "ana", "baron", { target: "cleo" })
    for (const viewer of ["bob", null]) expect(read(tie.events, viewer).map((event) => event.kind), String(viewer)).toEqual(["play", "compare", "draw"])
  })

  it("never puts the id of a card that stays in a hand in anybody's log", () => {
    const state = table("priest")
    const { events } = playStep(state, "ana", "baron", { target: "cleo" })
    const secrets = [state.hands[0]!.find((id) => id !== state.hands[0]![0])!, state.hands[2]![0]!]
    for (const viewer of ["ana", "bob", "cleo", "stranger", null]) for (const secret of secrets) expect(JSON.stringify(read(events, viewer)), `${viewer} ${secret}`).not.toContain(String(secret))
  })
})

describe("the King (p. 9)", () => {
  const table = () => layout({ players: 3, hands: { ana: ["king", "guard"], bob: ["handmaid"], cleo: ["priest"] }, deck: ["spy", "guard"] })

  it("trades hands with the chosen player: each holds the other's former card", () => {
    const after = playCard(table(), "ana", "king", { target: "cleo" })
    expect(handNames(after, "ana")).toEqual(["priest"])
    expect(handNames(after, "cleo")).toEqual(["guard"])
  })

  it("leaves the cards of the other players where they are, and the King in front of its player", () => {
    const after = playCard(table(), "ana", "king", { target: "cleo" })
    expect(handNames(after, "bob")).toEqual(["handmaid", "spy"])
    expect(areaNames(after, "ana")).toEqual(["king"])
  })

  it("shows the two players both cards after the trade, and everybody else that it happened (p. 9)", () => {
    const { events } = playStep(table(), "ana", "king", { target: "cleo" })
    const full = { kind: "swap", by: "ana", target: "cleo", cards: { by: "guard", target: "priest" } }
    expect(read(events, "ana").filter((event) => event.kind === "swap")).toEqual([full])
    expect(read(events, "cleo").filter((event) => event.kind === "swap")).toEqual([full])
    for (const viewer of ["bob", "stranger", null]) expect(read(events, viewer).filter((event) => event.kind === "swap"), String(viewer)).toEqual([{ kind: "swap", by: "ana", target: "cleo" }])
  })

  it("shows each player their new card in their own view, and nobody else's", () => {
    const after = playCard(table(), "ana", "king", { target: "cleo" })
    expect(viewOf(after, "ana").me!.hand.map((face) => face.type)).toEqual(["priest"])
    expect(viewOf(after, "cleo").me!.hand.map((face) => face.type)).toEqual(["guard"])
  })

  it("never puts the id of a card that stays in a hand in anybody's log", () => {
    const state = table()
    const { events } = playStep(state, "ana", "king", { target: "cleo" })
    const secrets = [state.hands[0]!.find((id) => id !== state.hands[0]![0])!, state.hands[2]![0]!]
    for (const viewer of ["ana", "bob", "cleo", "stranger", null]) for (const secret of secrets) expect(JSON.stringify(read(events, viewer)), `${viewer} ${secret}`).not.toContain(String(secret))
  })
})

describe("the Prince (p. 10)", () => {
  const table = () => layout({ players: 3, hands: { ana: ["prince", "guard"], bob: ["handmaid"], cleo: ["king"] }, deck: ["spy", "priest", "baron"] })

  it("makes the chosen player discard their hand face up, without resolving its effect, and draw a new card", () => {
    const { state, events } = playStep(table(), "ana", "prince", { target: "cleo" })
    // a King is discarded: it trades nothing
    expect(areaNames(state, "cleo")).toEqual(["king"])
    expect(handNames(state, "cleo")).toEqual(["spy"])
    expect(handNames(state, "ana")).toEqual(["guard"])
    expect(kinds({ events })).toEqual(["play", "discard", "draw", "draw"])
    expect(events[1]!.event).toMatchObject({ kind: "discard", by: "ana", player: "cleo", card: { type: "king" } })
  })

  it("lets the player pick themselves: their other card is discarded and they draw a new one", () => {
    const { state } = playStep(table(), "ana", "prince", { target: "ana" })
    expect(areaNames(state, "ana")).toEqual(["prince", "guard"])
    expect(handNames(state, "ana")).toEqual(["spy"])
  })

  it("draws the top card of the deck, which only its player sees (p. 10)", () => {
    const { events } = playStep(table(), "ana", "prince", { target: "cleo" })
    const drawn = events.filter((entry) => entry.event.kind === "draw")[0]!
    expect(drawn.to).toEqual(["cleo"])
    expect(read(events, "cleo").find((event) => event.kind === "draw")).toMatchObject({ kind: "draw", by: "cleo", card: { type: "spy" } })
    for (const viewer of ["ana", "bob", "stranger", null]) expect(read(events, viewer).find((event) => event.kind === "draw"), String(viewer)).toEqual({ kind: "draw", by: "cleo" })
  })

  it("draws the card set aside face down when the deck is empty (p. 10)", () => {
    const state = layout({ players: 3, hands: { ana: ["prince", "guard"], bob: ["handmaid"], cleo: ["king"] }, deck: [], aside: "baron", rest: "away" })
    const { state: after, events } = playStep(state, "ana", "prince", { target: "cleo" })
    expect(handNames(after, "cleo")).toEqual(["baron"])
    expect(after.aside).toBeNull()
    expect(read(events, "cleo").find((event) => event.kind === "draw")).toMatchObject({ card: { type: "baron" } })
    // the deck is empty after the turn: the round is counted (p. 6)
    expect(after.stage).toMatchObject({ kind: "between", revealed: true })
  })

  it("knocks out a player who discards the Princess, who draws nothing (pp. 8, 10)", () => {
    const state = layout({ players: 3, hands: { ana: ["prince", "guard"], bob: ["handmaid"], cleo: ["princess"] }, deck: ["spy", "priest"] })
    const { state: after, events } = playStep(state, "ana", "prince", { target: "cleo" })
    expect(after.out).toEqual([false, false, true])
    expect(handNames(after, "cleo")).toEqual([])
    expect(areaNames(after, "cleo")).toEqual(["princess"])
    expect(kinds({ events })).toEqual(["play", "discard", "out", "draw"])
    expect(events[2]!.event).toEqual({ kind: "out", player: "cleo", cards: [], cause: "princess" })
    // the next player draws as usual: the one who was knocked out took no card from the deck
    expect(handNames(after, "bob")).toEqual(["handmaid", "spy"])
  })

  it("knocks out the player who picks themselves while holding the Princess (p. 8)", () => {
    const state = layout({ players: 3, hands: { ana: ["prince", "princess"], bob: ["handmaid"], cleo: ["king"] }, deck: ["spy"] })
    const after = playCard(state, "ana", "prince", { target: "ana" })
    expect(after.out).toEqual([true, false, false])
    expect(areaNames(after, "ana")).toEqual(["prince", "princess"])
  })

  it("counts a Spy that a player is made to discard, which lies in front of them like one that was played (pp. 10, 13)", () => {
    const state = layout({ players: 3, hands: { ana: ["prince", "guard"], bob: ["handmaid"], cleo: ["spy"] }, deck: ["priest", "guard"] })
    const after = playCard(state, "ana", "prince", { target: "cleo" })
    expect(areaNames(after, "cleo")).toEqual(["spy"])
  })

  it("ends the round after the turn when it takes the last card of the deck: the round is counted (p. 6)", () => {
    const state = layout({ players: 2, hands: { ana: ["prince", "guard"], bob: ["king"] }, deck: ["spy"], aside: "baron", rest: "away" })
    const after = playCard(state, "ana", "prince", { target: "bob" })
    expect(handNames(after, "bob")).toEqual(["spy"])
    expect(after.stage).toMatchObject({ kind: "between", revealed: true, winners: [0] })
  })
})

describe("the Handmaid (p. 11)", () => {
  const table = () => layout({ players: 3, hands: { ana: ["handmaid", "spy"], bob: ["guard"], cleo: ["priest"] }, deck: ["king", "guard", "baron"] })

  it("protects its player: until the start of their next turn, the other players cannot pick them", () => {
    const after = playCard(table(), "ana", "handmaid")
    expect(after.shielded).toEqual([true, false, false])
    // bob is next: his Guard cannot pick ana, only cleo
    expect(refusal(() => playCard(after, "bob", "guard", { target: "ana", guess: "priest" }))).toBe("INVALID_TARGET")
    expect(() => playCard(after, "bob", "guard", { target: "cleo", guess: "priest" })).not.toThrow()
    expect(viewOf(after, "bob").phase).toMatchObject({ kind: "turn", player: "bob", targets: ["cleo"] })
  })

  it("lasts through the turns of the others and ends when the turn comes back to the player (p. 11)", () => {
    let state = playCard(table(), "ana", "handmaid")
    state = playCard(state, "bob", "guard", { target: "cleo", guess: "king" })
    expect(state.shielded).toEqual([true, false, false])
    expect(waiting(state)).toEqual(["cleo"])
    state = playCard(state, "cleo", "priest", { target: "bob" })
    // the turn comes back to ana: she draws, and her protection is over
    expect(waiting(state)).toEqual(["ana"])
    expect(state.shielded).toEqual([false, false, false])
    expect(viewOf(state, "bob").players[0]!.shielded).toBe(false)
  })

  it("protects only once played: a Handmaid in a hand picks nobody away (p. 11)", () => {
    const state = layout({ players: 3, hands: { ana: ["guard", "spy"], bob: ["handmaid"], cleo: ["priest"] }, deck: ["king"] })
    expect(() => playCard(state, "ana", "guard", { target: "bob", guess: "handmaid" })).not.toThrow()
  })

  it("does not keep its player out of the turns: they play when it comes round to them", () => {
    const state = playCard(table(), "ana", "handmaid")
    expect(state.out).toEqual([false, false, false])
    expect(areaNames(state, "ana")).toEqual(["handmaid"])
  })

  it("shows everybody who is protected (p. 11: the Handmaid is played face up), and says that it was played", () => {
    const { state, events } = playStep(table(), "ana", "handmaid")
    for (const viewer of ["ana", "bob", "cleo", "stranger", null]) {
      expect(viewOf(state, viewer).players.map((player) => player.shielded), String(viewer)).toEqual([true, false, false])
      expect(read(events, viewer).filter((event) => event.kind === "protect"), String(viewer)).toEqual([{ kind: "protect", by: "ana" }])
    }
  })

  it("is ended by a new round: nobody is protected when it is dealt (the reading validated for p. 11)", () => {
    const state = layout({ players: 2, hands: { ana: ["handmaid", "princess"], bob: ["guard"] }, deck: [], rest: "away" })
    const after = playCard(state, "ana", "handmaid")
    expect(after.stage).toMatchObject({ kind: "between" })
    expect(after.shielded[0]).toBe(true)
  })
})

describe("the Countess (p. 9)", () => {
  const holding = (other: "king" | "prince" | "guard" | "princess" | "chancellor" | "handmaid") =>
    layout({ players: 3, hands: { ana: ["countess", other], bob: ["priest"], cleo: ["baron"] }, deck: ["spy", "guard"] })

  it("has no effect when played: she lies in front of her player and nothing else changes", () => {
    const { state, events } = playStep(holding("guard"), "ana", "countess")
    expect(areaNames(state, "ana")).toEqual(["countess"])
    expect(handNames(state, "ana")).toEqual(["guard"])
    expect(kinds({ events })).toEqual(["play", "draw"])
    expect(state.out).toEqual([false, false, false])
  })

  it("must be played when the other card is the King (INVALID: MUST_PLAY_COUNTESS for the other card)", () => {
    const state = holding("king")
    expect(refusal(() => playCard(state, "ana", "king", { target: "bob" }))).toBe("MUST_PLAY_COUNTESS")
    expect(() => playCard(state, "ana", "countess")).not.toThrow()
  })

  it("must be played when the other card is a Prince", () => {
    const state = holding("prince")
    expect(refusal(() => playCard(state, "ana", "prince", { target: "bob" }))).toBe("MUST_PLAY_COUNTESS")
    expect(() => playCard(state, "ana", "countess")).not.toThrow()
  })

  it("is checked before the player picked and the character named: the refusal is the Countess's (MUST_PLAY_COUNTESS)", () => {
    expect(refusal(() => playCard(holding("king"), "ana", "king"))).toBe("MUST_PLAY_COUNTESS")
    expect(refusal(() => playCard(holding("king"), "ana", "king", { target: "zed" }))).toBe("MUST_PLAY_COUNTESS")
  })

  it("can still be played by choice with any other card: the Guard, the Princess, the Chancellor, the Handmaid", () => {
    for (const other of ["guard", "princess", "chancellor", "handmaid"] as const) {
      expect(() => playCard(holding(other), "ana", "countess"), other).not.toThrow()
      expect(() => playCard(holding(other), "ana", other, other === "guard" ? { target: "bob", guess: "baron" } : {}), other).not.toThrow()
    }
  })

  it("does not force the King or the Prince when they are the two cards of the hand without her (p. 9)", () => {
    const state = layout({ players: 3, hands: { ana: ["king", "prince"], bob: ["priest"], cleo: ["baron"] }, deck: ["spy", "guard"] })
    expect(() => playCard(state, "ana", "king", { target: "bob" })).not.toThrow()
    expect(() => playCard(state, "ana", "prince", { target: "bob" })).not.toThrow()
  })

  it("is the only card a player is offered when it is forced, which only they know: `playable` is for them alone", () => {
    const state = holding("king")
    const countess = state.hands[0]![0]!
    expect(viewOf(state, "ana").me!.playable).toEqual([countess])
    expect(viewOf(state, "ana").me!.hand.map((face) => face.type)).toEqual(["countess", "king"])
    expect(viewOf(state, "bob").me!.playable).toEqual([])
    expect(viewOf(holding("guard"), "ana").me!.playable).toHaveLength(2)
  })

  it("does not show the other card, so nobody can tell whether the play was forced (p. 9)", () => {
    const forced = playStep(holding("king"), "ana", "countess")
    const chosen = playStep(holding("guard"), "ana", "countess")
    for (const viewer of ["bob", "cleo", "stranger", null]) {
      const [a, b] = [read(forced.events, viewer), read(chosen.events, viewer)]
      expect(a.map((event) => event.kind), String(viewer)).toEqual(b.map((event) => event.kind))
      expect(JSON.stringify(a), String(viewer)).not.toContain("king")
      expect(viewOf(forced.state, viewer).phase.kind, String(viewer)).toBe(viewOf(chosen.state, viewer).phase.kind)
    }
    expect(JSON.stringify(read(forced.events, "bob"))).not.toContain('"king"')
  })

  it("is not forced when the player has only one card to play, nor after a trade of hands (the rule is about the two cards of a turn)", () => {
    const state = layout({ players: 3, hands: { ana: ["king", "guard"], bob: ["priest"], cleo: ["countess"] }, deck: ["spy", "guard"] })
    // ana trades with cleo: she holds the Countess alone, and cleo the Guard; the next player has two cards, no King or Prince among them
    const after = playCard(state, "ana", "king", { target: "cleo" })
    expect(handNames(after, "ana")).toEqual(["countess"])
    expect(viewOf(after, "bob").me!.playable).toHaveLength(2)
  })
})

describe("the Princess (p. 8)", () => {
  const table = () => layout({ players: 3, hands: { ana: ["princess", "guard"], bob: ["priest"], cleo: ["baron"] }, deck: ["spy", "guard"] })

  it("knocks out the player who plays her, their other card laid face up in front of them (pp. 5, 8)", () => {
    const { state, events } = playStep(table(), "ana", "princess")
    expect(state.out).toEqual([true, false, false])
    expect(areaNames(state, "ana")).toEqual(["princess", "guard"])
    expect(handNames(state, "ana")).toEqual([])
    expect(kinds({ events })).toEqual(["play", "out", "draw"])
    expect(events[1]!.event).toMatchObject({ kind: "out", player: "ana", cause: "princess", cards: [{ type: "guard" }] })
  })

  it("is a card a player may play when it is the lowest they can: it is legal, and it costs them the round", () => {
    const state = layout({ players: 3, hands: { ana: ["princess", "spy"], bob: ["priest"], cleo: ["baron"] }, deck: ["guard"] })
    expect(() => playCard(state, "ana", "princess")).not.toThrow()
  })

  it("passes the turn to the next player and skips the one who is out from then on (p. 5)", () => {
    const after = playCard(table(), "ana", "princess")
    expect(waiting(after)).toEqual(["bob"])
    const later = playCard(playCard(after, "bob", "spy"), "cleo", "guard", { target: "bob", guess: "king" })
    // the turn goes round to bob again: ana, who is out, is skipped
    expect(waiting(later)).toEqual(["bob"])
  })

  it("ends the round at once when it leaves one player, who wins it (p. 6)", () => {
    const state = layout({ players: 2, hands: { ana: ["princess", "guard"], bob: ["priest"] }, deck: ["spy"] })
    const { state: after, events } = playStep(state, "ana", "princess")
    expect(after.stage).toMatchObject({ kind: "between", revealed: false, winners: [1] })
    expect(kinds({ events })).toEqual(["play", "out", "end"])
    expect(after.won).toEqual([0, 1])
  })

  it("does not earn the Spy's token to a player who is out, whatever they played or discarded before (the reading validated for p. 13)", () => {
    const state = layout({ players: 2, hands: { ana: ["princess", "spy"], bob: ["priest"] }, areas: { ana: ["spy"] }, deck: ["guard"] })
    const after = playCard(state, "ana", "princess")
    expect(after.spies).toEqual([0, 0])
    expect(after.won).toEqual([0, 1])
  })
})

describe("the Spy (p. 13)", () => {
  it("has no effect when played: it lies in front of its player and nothing else changes", () => {
    const state = layout({ players: 3, hands: { ana: ["spy", "guard"], bob: ["priest"], cleo: ["baron"] }, deck: ["handmaid", "guard"] })
    const { state: after, events } = playStep(state, "ana", "spy")
    expect(areaNames(after, "ana")).toEqual(["spy"])
    expect(kinds({ events })).toEqual(["play", "draw"])
    expect(after.out).toEqual([false, false, false])
    expect(after.shielded).toEqual([false, false, false])
  })
})
