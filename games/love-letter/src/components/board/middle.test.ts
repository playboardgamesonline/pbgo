import { CARDS, type CharacterKey, type Face, type PlayerView, type PublicSeat } from "@love-letter/engine"
import { describe, expect, it } from "vitest"
import { columnCounts, tableCards } from "./middle"

const face = (id: number, type: CharacterKey): Face => ({ id, type })

/** A player of the view with what a test changes: the cards they played, whether they are out, whether a Handmaid protects them */
const seat = (id: string, area: Face[], extra: Partial<PublicSeat> = {}): PublicSeat => ({ id, cards: 1, hand: null, area, out: false, shielded: false, tokens: 0, ...extra })

/** A table as `ada` reads it, with the seats a test gives */
function viewOf(players: PublicSeat[], extra: Partial<PlayerView> = {}): PlayerView {
  return {
    options: {},
    me: { id: "ada", hand: [], playable: [] },
    players,
    standings: [],
    deck: { size: 8 },
    aside: 1,
    faceUp: [],
    round: 1,
    target: 4,
    phase: { kind: "turn", player: "ada", targets: ["ben"] },
    results: null,
    ...extra,
  }
}

const ids = (faces: readonly Face[]) => faces.map((card) => card.id)

describe("the cards in the middle", () => {
  it("lie in ascending order of the value printed on them, from the Spy to the Princess, whoever played them and whenever", () => {
    const view = viewOf([
      seat("ada", [face(1, "king"), face(2, "guard")]),
      seat("ben", [face(3, "princess"), face(4, "baron")]),
      seat("cleo", [face(5, "countess"), face(6, "priest"), face(7, "prince")]),
    ])
    const { middle } = tableCards(view)
    expect(middle.map((card) => card.type)).toEqual(["guard", "priest", "baron", "prince", "king", "countess", "princess"])
    const values = middle.map((card) => CARDS[card.type].value)
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })

  it("keep the cards of one value together, in the order of the seats and then in the order they were played in", () => {
    const view = viewOf([
      seat("ada", [face(1, "guard"), face(2, "chancellor"), face(3, "guard")]),
      seat("ben", [face(4, "guard"), face(5, "chancellor")]),
      seat("cleo", [face(6, "guard")]),
    ])
    const { middle } = tableCards(view)
    expect(ids(middle)).toEqual([1, 3, 4, 6, 2, 5])
  })

  it("hold every card of every area that does not stay in front, a discarded Princess and a Prince's forced discard included", () => {
    const view = viewOf([seat("ada", [face(1, "prince"), face(2, "guard")]), seat("ben", [face(3, "princess")], { out: true })])
    expect(ids(tableCards(view).middle).sort()).toEqual([1, 2, 3])
  })

  it("are empty when nobody has played, and for a table with no player at all", () => {
    expect(tableCards(viewOf([seat("ada", []), seat("ben", [])])).middle).toEqual([])
    expect(tableCards(viewOf([])).middle).toEqual([])
  })
})

describe("the cards that stay in front of their player", () => {
  it("are the Spies, which count when the round ends, wherever they stand in the order of play", () => {
    const view = viewOf([seat("ada", [face(1, "spy"), face(2, "guard"), face(3, "spy")]), seat("ben", [face(4, "spy")])])
    const { front, middle } = tableCards(view)
    expect(ids(front.get("ada")!)).toEqual([1, 3])
    expect(ids(front.get("ben")!)).toEqual([4])
    expect(ids(middle)).toEqual([2])
  })

  it("are a Handmaid while it protects, and only the last one: the older Handmaids have done their work and go to the middle", () => {
    const area = [face(1, "handmaid"), face(2, "guard"), face(3, "handmaid")]
    const protecting = tableCards(viewOf([seat("ada", area, { shielded: true })]))
    expect(ids(protecting.front.get("ada")!)).toEqual([3])
    expect(ids(protecting.middle)).toEqual([2, 1])
  })

  it("send a Handmaid to the middle once its protection has ended, at the start of its player's next turn", () => {
    const view = viewOf([seat("ada", [face(1, "handmaid")], { shielded: false })])
    const { front, middle } = tableCards(view)
    expect(front.get("ada")).toEqual([])
    expect(ids(middle)).toEqual([1])
  })

  it("keep the Handmaid that protects and the Spies of one player together, in the order they were played in", () => {
    const view = viewOf([seat("ada", [face(1, "spy"), face(2, "handmaid"), face(3, "guard")], { shielded: true })])
    expect(ids(tableCards(view).front.get("ada")!)).toEqual([1, 2])
  })

  it("are none for a player who is out: their Spy counts for nothing and their Handmaid has no one left to protect", () => {
    const view = viewOf([seat("ada", []), seat("ben", [face(1, "spy"), face(2, "handmaid"), face(3, "guard")], { out: true, shielded: true })])
    const { front, middle } = tableCards(view)
    expect(front.get("ben")).toEqual([])
    expect(ids(middle)).toEqual([1, 3, 2])
  })

  it("give every player an entry, even when nothing stays in front of them", () => {
    const { front } = tableCards(viewOf([seat("ada", [face(1, "guard")]), seat("ben", []), seat("cleo", [face(2, "spy")])]))
    expect([...front.keys()]).toEqual(["ada", "ben", "cleo"])
    expect(front.get("ada")).toEqual([])
    expect(front.get("ben")).toEqual([])
  })

  it("stay as they are between two rounds, when the finished round stays on the table", () => {
    const view = viewOf([seat("ada", [face(1, "spy"), face(2, "guard")]), seat("ben", [face(3, "handmaid")], { shielded: true })], { phase: { kind: "between", next: "ada", winners: [], spy: "ada", revealed: false } })
    const { front, middle } = tableCards(view)
    expect(ids(front.get("ada")!)).toEqual([1])
    expect(ids(front.get("ben")!)).toEqual([3])
    expect(ids(middle)).toEqual([2])
  })
})

describe("the card the viewer has picked", () => {
  const hand = [face(10, "guard"), face(11, "spy")]

  it("is laid in front of them, after the cards that stay there, and is no card of the middle", () => {
    const view = viewOf([seat("ada", [face(1, "spy"), face(2, "baron")]), seat("ben", [])])
    const { front, middle } = tableCards(view, hand[0]!)
    expect(ids(front.get("ada")!)).toEqual([1, 10])
    expect(ids(middle)).toEqual([2])
  })

  it("is laid in front of them when nothing else is, and in front of nobody else", () => {
    const { front } = tableCards(viewOf([seat("ada", []), seat("ben", [])]), hand[0]!)
    expect(ids(front.get("ada")!)).toEqual([10])
    expect(front.get("ben")).toEqual([])
  })

  it("is nothing for a spectator, who has no hand: there is no card to lay down", () => {
    const view = viewOf([seat("ada", []), seat("ben", [])], { me: null })
    const { front } = tableCards(view, hand[0]!)
    expect(front.get("ada")).toEqual([])
    expect(front.get("ben")).toEqual([])
  })

  it("changes nothing when none is picked", () => {
    const view = viewOf([seat("ada", [face(1, "spy")]), seat("ben", [face(2, "guard")])])
    expect(tableCards(view, null)).toEqual(tableCards(view))
  })
})

describe("the columns of the middle", () => {
  it("count the cards of each value from the lowest to the highest, one column for each value that has a card", () => {
    const view = viewOf([
      seat("ada", [face(1, "guard"), face(2, "king"), face(3, "guard")]),
      seat("ben", [face(4, "guard"), face(5, "princess")], { out: true }),
      seat("cleo", [face(6, "king"), face(7, "guard"), face(8, "spy")], { out: true }),
    ])
    const { middle } = tableCards(view)
    expect(middle.map((card) => card.type)).toEqual(["spy", "guard", "guard", "guard", "guard", "king", "king", "princess"])
    // no Priest, no Baron, no Handmaid, no Prince, no Chancellor and no Countess: those columns are not there
    expect(columnCounts(middle)).toEqual([1, 4, 2, 1])
  })

  it("are none for no card, and one of one for a single card", () => {
    expect(columnCounts([])).toEqual([])
    expect(columnCounts([face(1, "countess")])).toEqual([1])
  })

  it("keep every card of the list: their counts add up to the number of cards, whatever the round", () => {
    const view = viewOf([
      seat("ada", [face(1, "prince"), face(2, "prince"), face(3, "handmaid"), face(4, "guard")]),
      seat("ben", [face(5, "baron"), face(6, "priest"), face(7, "guard"), face(8, "chancellor"), face(9, "countess")]),
    ])
    const { middle } = tableCards(view)
    const counts = columnCounts(middle)
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(middle.length)
    expect(counts).toEqual([2, 1, 1, 1, 2, 1, 1])
  })
})
