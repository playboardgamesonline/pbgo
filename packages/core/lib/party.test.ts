import { describe, expect, it } from "vitest"
import { PARTY_POLL_MS, PARTY_START_AFTER_SECONDS, partyAnswerOf, partyEnded, partyKey, partyStep, partyTableOf, partyWaitLine, partyWaitText, startableWith, type PartyTable } from "./party"

const table = (over: Partial<PartyTable> = {}): PartyTable => ({ game: "courtisans", code: "ABC234", status: "lobby", seats: 3, seated: 1, you: false, host: false, waited: 0, ...over })

describe("the table of a group, as the wire says it", () => {
  it("is read when it is whole", () => {
    expect(partyTableOf({ game: "courtisans", code: "ABC234", status: "starting", seats: 3, seated: 3, you: true, host: false, waited: 12 })).toEqual(table({ status: "starting", seated: 3, you: true, waited: 12 }))
  })

  it.each([
    ["not an object", null],
    ["no game", { code: "ABC234", status: "lobby", seats: 3, seated: 1, you: false, host: false, waited: 0 }],
    ["an empty code", { game: "courtisans", code: "", status: "lobby", seats: 3, seated: 1, you: false, host: false, waited: 0 }],
    ["a table that is played", { game: "courtisans", code: "ABC234", status: "playing", seats: 3, seated: 3, you: true, host: false, waited: 0 }],
    ["no seat", { game: "courtisans", code: "ABC234", status: "lobby", seats: 0, seated: 0, you: false, host: false, waited: 0 }],
    ["a count that is not whole", { game: "courtisans", code: "ABC234", status: "lobby", seats: 3, seated: 1.5, you: false, host: false, waited: 0 }],
    ["a wait that is negative", { game: "courtisans", code: "ABC234", status: "lobby", seats: 3, seated: 1, you: false, host: false, waited: -1 }],
    ["flags that are not flags", { game: "courtisans", code: "ABC234", status: "lobby", seats: 3, seated: 1, you: "yes", host: false, waited: 0 }],
  ])("is nothing for %s", (_name, value) => {
    expect(partyTableOf(value)).toBeNull()
  })

  it("is the table of an answer, and nothing for an answer that has none", () => {
    expect(partyAnswerOf({ table: table() })).toEqual(table())
    expect(partyAnswerOf({ table: null })).toBeNull()
    expect(partyAnswerOf(null)).toBeNull()
    expect(partyAnswerOf({})).toBeNull()
  })

  it("has a key per game and code", () => {
    expect(partyKey(table())).toBe("courtisans:ABC234")
  })
})

describe("what a tab does about the table of its group", () => {
  const none = new Set<string>()

  it("does nothing when there is no table", () => {
    expect(partyStep(null, none)).toBe("none")
  })

  it("sits a member down at a table that waits and that they do not sit at, with no press", () => {
    expect(partyStep(table(), none)).toBe("join")
  })

  it("never tries a table twice: a refusal was told in a toast, and the table is the same at every read", () => {
    expect(partyStep(table(), new Set([partyKey(table())]))).toBe("none")
    expect(partyStep(table({ code: "ZZZ999" }), new Set([partyKey(table())]))).toBe("join")
  })

  it("waits at a table that waits and that they sit at: the leader, or a member who sat down", () => {
    expect(partyStep(table({ you: true, host: true }), none)).toBe("wait")
    expect(partyStep(table({ you: true }), none)).toBe("wait")
  })

  it("never sits the leader down at their own table", () => {
    expect(partyStep(table({ host: true }), none)).toBe("none")
  })

  it("takes the people seated to the board when the ready check is on, and nobody else", () => {
    expect(partyStep(table({ status: "starting", you: true }), none)).toBe("enter")
    expect(partyStep(table({ status: "starting", you: true, host: true }), none)).toBe("enter")
    expect(partyStep(table({ status: "starting", you: false }), none)).toBe("none")
  })
})

describe("a table that was cancelled", () => {
  it("is told to a member who sat at it, from one read to the next", () => {
    expect(partyEnded(table({ you: true }), null, PARTY_POLL_MS)).toBe(true)
  })

  it("is not told after a long gap: a tab that was away cannot tell it began from it being cancelled", () => {
    expect(partyEnded(table({ you: true }), null, 60_000)).toBe(false)
  })

  it("is not told to the leader who gave it up, to a member who never sat down, or when another table has taken its place", () => {
    expect(partyEnded(table({ you: true, host: true }), null, PARTY_POLL_MS)).toBe(false)
    expect(partyEnded(table(), null, PARTY_POLL_MS)).toBe(false)
    expect(partyEnded(table({ you: true }), table({ code: "ZZZ999" }), PARTY_POLL_MS)).toBe(false)
  })

  it("is not told of a table that was in its ready check: it began", () => {
    expect(partyEnded(table({ you: true, status: "starting" }), null, PARTY_POLL_MS)).toBe(false)
  })
})

describe("starting with the people who came", () => {
  const waited = table({ host: true, you: true, seated: 2, waited: PARTY_START_AFTER_SECONDS })

  it("is offered to the leader after the wait, when the table is not full and has what the game needs", () => {
    expect(startableWith(waited, 2)).toBe(2)
    expect(startableWith(table({ host: true, you: true, seats: 4, seated: 3, waited: 90 }), 3)).toBe(3)
  })

  it("is not offered before the wait is over", () => {
    expect(startableWith({ ...waited, waited: PARTY_START_AFTER_SECONDS - 1 }, 2)).toBeNull()
  })

  it("is not offered while fewer than the game needs are seated, and never for the leader alone", () => {
    expect(startableWith({ ...waited, seated: 2 }, 3)).toBeNull()
    expect(startableWith({ ...waited, seated: 1 }, 1)).toBeNull()
  })

  it("is offered at once for a table that is full and still waits: it begins by itself, so it could not (somebody at it is in a game)", () => {
    expect(startableWith(table({ host: true, you: true, seats: 3, seated: 3, waited: 5 }), 2)).toBe(3)
  })

  it("is not offered in its ready check, or to a member", () => {
    expect(startableWith({ ...waited, status: "starting" }, 2)).toBeNull()
    expect(startableWith({ ...waited, host: false }, 2)).toBeNull()
    expect(startableWith(table({ seats: 3, seated: 3, waited: 5 }), 2)).toBeNull()
  })
})

describe("what the wait says", () => {
  it("is who is awaited and how many seats are taken", () => {
    expect(partyWaitText({ seated: 2, seats: 3 })).toEqual({ label: "Waiting for the group", count: "2/3" })
    expect(partyWaitLine({ seated: 2, seats: 3 })).toBe("Waiting for the group, 2/3.")
  })
})
