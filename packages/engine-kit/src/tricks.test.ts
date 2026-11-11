import { describe, expect, it } from "vitest"
import { ledSuit, outranks, playableCards, playOrder, type TrickPlay, trickWinner } from "./tricks"

// A small catalogue: "H7" is the seven of hearts, "J" a jester (no suit), "W" a wizard (no suit, beats everything the first time)
const suitOf = (card: string) => (card === "J" || card === "W" ? null : card.slice(0, 1))
const rankOf = (card: string) => (card === "J" || card === "W" ? 0 : Number(card.slice(1)))
const cards = { suitOf, rankOf }
const play = (playerId: string, card: string): TrickPlay<string> => ({ playerId, card })

describe("ledSuit", () => {
  it("is the suit of the first card played", () => {
    expect(ledSuit([play("a", "H7"), play("b", "S9")], suitOf)).toBe("H")
  })

  it("is left to the first card that has a suit when a jester leads", () => {
    expect(ledSuit([play("a", "J"), play("b", "S9"), play("c", "H2")], suitOf)).toBe("S")
  })

  it("is null while no card played has a suit, and before anything is played", () => {
    expect(ledSuit([play("a", "J"), play("b", "W")], suitOf)).toBeNull()
    expect(ledSuit([], suitOf)).toBeNull()
  })
})

describe("playableCards", () => {
  const hand = ["H2", "S9", "H11", "C4", "W"]

  it("is the cards of the led suit when the hand holds any", () => {
    expect(playableCards(hand, "H", { suitOf })).toEqual(["H2", "H11"])
  })

  it("is the whole hand when it holds none of the suit, or when nothing was led", () => {
    expect(playableCards(hand, "D", { suitOf })).toEqual(hand)
    expect(playableCards(hand, null, { suitOf })).toEqual(hand)
  })

  it("lets the cards that are free be played beside the suit, once", () => {
    expect(playableCards(hand, "H", { suitOf, free: (card) => card === "W" || card === "H2" })).toEqual(["H2", "H11", "W"])
  })

  it("keeps the order of the hand, and leaves the hand alone", () => {
    const before = [...hand]
    expect(playableCards(hand, "S", { suitOf })).toEqual(["S9"])
    expect(hand).toEqual(before)
  })

  it("is empty for an empty hand", () => {
    expect(playableCards([], "H", { suitOf })).toEqual([])
  })
})

describe("outranks", () => {
  it("takes the trick with a higher card of the same suit, and not with a lower one or an equal one", () => {
    expect(outranks("H9", "H7", cards)).toBe(true)
    expect(outranks("H5", "H7", cards)).toBe(false)
    expect(outranks("H7", "H7", cards)).toBe(false)
  })

  it("never takes it with a card of another suit", () => {
    expect(outranks("S13", "H2", cards)).toBe(false)
  })

  it("gives a trump the trick against a card that is not one, whatever its rank", () => {
    expect(outranks("S2", "H13", { ...cards, trump: "S" })).toBe(true)
    expect(outranks("H13", "S2", { ...cards, trump: "S" })).toBe(false)
  })

  it("tells two trumps by their rank", () => {
    expect(outranks("S9", "S4", { ...cards, trump: "S" })).toBe(true)
    expect(outranks("S4", "S9", { ...cards, trump: "S" })).toBe(false)
  })

  it("lets a card with a suit take the trick from one with none, and a card with none take nothing", () => {
    expect(outranks("H2", "J", cards)).toBe(true)
    expect(outranks("J", "H2", cards)).toBe(false)
    expect(outranks("J", "J", cards)).toBe(false)
  })
})

describe("trickWinner", () => {
  it("is the highest card of the led suit", () => {
    const plays = [play("a", "H7"), play("b", "H11"), play("c", "S13"), play("d", "H3")]
    expect(trickWinner(plays, cards)).toBe(plays[1])
  })

  it("is the lead when everybody else played another suit", () => {
    const plays = [play("a", "H2"), play("b", "S13"), play("c", "C12")]
    expect(trickWinner(plays, cards)).toBe(plays[0])
  })

  it("is the highest trump when there is one, even a low one", () => {
    const plays = [play("a", "H13"), play("b", "S2"), play("c", "S6"), play("d", "H12")]
    expect(trickWinner(plays, { ...cards, trump: "S" })).toBe(plays[2])
  })

  it("is the first card suited when jesters come first, and the first jester when nothing is suited", () => {
    const behind = [play("a", "J"), play("b", "H4"), play("c", "H9")]
    expect(trickWinner(behind, cards)).toBe(behind[2])
    const none = [play("a", "J"), play("b", "J")]
    expect(trickWinner(none, cards)).toBe(none[0])
  })

  it("is the only card of a trick of one", () => {
    const plays = [play("a", "H2")]
    expect(trickWinner(plays, cards)).toBe(plays[0])
  })

  it("throws for a trick with nothing played to it", () => {
    expect(() => trickWinner([], cards)).toThrow(RangeError)
  })

  describe("with the special cards of a game", () => {
    // A wizard takes the trick when it is the first one played, and a later wizard takes it from nothing
    const beats = (card: string, winning: string) => (winning === "W" ? false : card === "W" ? true : undefined)

    it("lets the game's own rule overrule the usual ones, the first wizard keeping the trick", () => {
      const plays = [play("a", "H7"), play("b", "W"), play("c", "H13"), play("d", "W")]
      expect(trickWinner(plays, { ...cards, beats })).toBe(plays[1])
    })

    it("leaves the cards the rule has no word for to the usual rules", () => {
      const plays = [play("a", "H7"), play("b", "H11")]
      expect(trickWinner(plays, { ...cards, beats })).toBe(plays[1])
    })

    // Skull King: pirate beats mermaid, skull king beats pirate, mermaid beats skull king, and a mermaid takes a trick that holds both skull king and a pirate
    const special = (card: string) => (["P", "M", "K"].includes(card) ? card : null)
    const decide = (plays: readonly TrickPlay<string>[]) => {
      const kind = new Set(plays.map((p) => special(p.card)))
      return kind.has("K") && kind.has("M") ? plays.find((p) => p.card === "M") : undefined
    }

    it("lets the game decide the whole trick when no comparison of two cards gives it", () => {
      const plays = [play("a", "M"), play("b", "P"), play("c", "K")]
      // The cards met in turn would give the Skull King the trick; the mermaid takes it
      expect(trickWinner(plays, { ...cards, beats: (card, winning) => (card === "K" ? true : winning === "K" ? false : undefined), decide })).toBe(plays[0])
    })

    it("falls back to the other rules when the game has no word for the trick", () => {
      const plays = [play("a", "H3"), play("b", "H9")]
      expect(trickWinner(plays, { ...cards, decide })).toBe(plays[1])
    })

    it("tells the game the suit that was led and the trump of the round", () => {
      const seen: unknown[] = []
      trickWinner([play("a", "J"), play("b", "S4")], { ...cards, trump: "H", beats: (_card, _winning, context) => (seen.push(context), undefined) })
      expect(seen).toEqual([{ led: "S", trump: "H" }])
    })
  })
})

describe("playOrder", () => {
  const players = ["a", "b", "c", "d"]

  it("starts with the leader and goes round the table", () => {
    expect(playOrder(players, "c")).toEqual(["c", "d", "a", "b"])
    expect(playOrder(players, "a")).toEqual(["a", "b", "c", "d"])
  })

  it("throws for a leader who is not at the table", () => {
    expect(() => playOrder(players, "z")).toThrow(RangeError)
  })

  it("leaves the list of players alone", () => {
    const before = [...players]
    playOrder(players, "b")
    expect(players).toEqual(before)
  })
})
