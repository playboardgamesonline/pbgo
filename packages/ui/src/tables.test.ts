import { describe, expect, it } from "vitest"
import { ageOf, DELETED_PLAYER, hostOf, lasted, namesOf, nicknameOf, PACES, seatCount, seatsOf, tableAction, tagOf, type TableSeat } from "./tables"

const NOW = Date.parse("2026-11-01T12:00:00Z")
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()
const seated = (...names: string[]): TableSeat[] => names.map((name) => ({ name }))

describe("seatsOf", () => {
  it("has as many seats as the table, a player in the seat they took and a null in the others", () => {
    expect(seatsOf([{ seat: 0, name: "Alex" }, { seat: 3, name: "Sam", avatarUrl: "https://example.com/sam.png" }], 5)).toEqual([
      { name: "Alex", avatarUrl: undefined },
      null,
      null,
      { name: "Sam", avatarUrl: "https://example.com/sam.png" },
      null,
    ])
  })

  it("keeps the tag and the rating of a player with their seat", () => {
    const rating = { rating: 1431, gamesPlayed: 24, wins: 14 }
    const [first, second] = seatsOf([{ seat: 0, name: "Alex", tag: "0042", rating }, { seat: 1, name: "Guest" }], 2)
    expect(first).toMatchObject({ name: "Alex", tag: "0042", rating })
    expect(second?.rating ?? null).toBeNull()
  })

  it("says which seat is the host's", () => {
    const seats = seatsOf([{ seat: 1, name: "Alex", host: true }, { seat: 0, name: "Sam" }], 3)
    expect(seats.map((seat) => seat?.host ?? false)).toEqual([false, true, false])
  })

  it("does not depend on the order the players come in", () => {
    const players = [{ seat: 2, name: "C" }, { seat: 0, name: "A" }, { seat: 1, name: "B" }]
    expect(seatsOf(players, 3).map((seat) => seat?.name)).toEqual(["A", "B", "C"])
    expect(seatsOf([...players].reverse(), 3)).toEqual(seatsOf(players, 3))
  })

  it("calls a player who deleted their account the way the platform does", () => {
    expect(seatsOf([{ seat: 0, name: null }], 2)[0]?.name).toBe(DELETED_PLAYER)
  })

  it("keeps a player whose seat is not the table's in the first seat that is free, and leaves out one too many", () => {
    // C wants seat 0, which A has, and B a seat the table does not have: they take what is left, in the order of the seats they asked for
    const players = [{ seat: 0, name: "A" }, { seat: 7, name: "B" }, { seat: 0, name: "C" }]
    expect(seatsOf(players, 3).map((seat) => seat?.name ?? null)).toEqual(["A", "C", "B"])
    expect(seatsOf(players, 2).map((seat) => seat?.name ?? null)).toEqual(["A", "C"])
    expect(seatsOf([{ seat: -1, name: "A" }], 2).map((seat) => seat?.name ?? null)).toEqual(["A", null])
  })

  it("makes no seat for a table with none, and no player for an empty table", () => {
    expect(seatsOf([], 0)).toEqual([])
    expect(seatsOf([], 3)).toEqual([null, null, null])
  })
})

describe("seatCount", () => {
  it("counts the seats taken, the seats there are and the seats left", () => {
    expect(seatCount([{ name: "A" }, null, { name: "B" }, null, null])).toEqual({ taken: 2, total: 5, free: 3 })
    expect(seatCount([])).toEqual({ taken: 0, total: 0, free: 0 })
  })
})

describe("nicknameOf", () => {
  it("drops the tag that follows a nickname, and nothing else", () => {
    expect(nicknameOf("Alex#0042")).toBe("Alex")
    expect(nicknameOf("Alex#7")).toBe("Alex")
    expect(nicknameOf("Alex")).toBe("Alex")
    expect(nicknameOf("Alex Doe")).toBe("Alex Doe")
    expect(nicknameOf("#0042")).toBe("")
    expect(nicknameOf("C#12345")).toBe("C#12345")
  })
})

describe("tagOf", () => {
  it("gives the tag after a nickname, and nothing for a name that has none", () => {
    expect(tagOf("Alex#0042")).toBe("0042")
    expect(tagOf("Alex#7")).toBe("7")
    expect(tagOf("Alex")).toBeNull()
    expect(tagOf("Alex Doe")).toBeNull()
    expect(tagOf("C#12345")).toBeNull()
  })
})

describe("namesOf", () => {
  it("lists up to three names, and then counts the others", () => {
    expect(namesOf([])).toBe("")
    expect(namesOf(seated("Alex"))).toBe("Alex")
    expect(namesOf(seated("Alex", "Sam"))).toBe("Alex and Sam")
    expect(namesOf(seated("Alex", "Sam", "Robin"))).toBe("Alex, Sam and Robin")
    expect(namesOf(seated("Alex", "Sam", "Robin", "Jo"))).toBe("Alex, Sam and 2 others")
    expect(namesOf(seated("Alex", "Sam", "Robin", "Jo", "Max", "Lea"))).toBe("Alex, Sam and 4 others")
  })

  it("skips the free seats", () => {
    expect(namesOf([null, { name: "Alex" }, null, { name: "Sam" }])).toBe("Alex and Sam")
    expect(namesOf([null, null])).toBe("")
  })
})

describe("tableAction", () => {
  it("lets a visitor sit at a table that waits and has a seat, and tells them when it is full", () => {
    expect(tableAction("waiting", 2)).toBe("join")
    expect(tableAction("waiting", 1)).toBe("join")
    expect(tableAction("waiting", 0)).toBe("full")
  })

  it("gives a visitor nothing to do at a table that is played: nobody looks on at a game", () => {
    expect(tableAction("playing", 0)).toBeNull()
    expect(tableAction("playing", 2)).toBeNull()
  })
})

describe("hostOf", () => {
  it("is the name of the one who opened the table", () => {
    expect(hostOf([{ name: "Alex" }, { name: "Sam", host: true }, null])).toBe("Sam")
  })

  it("is nothing when nobody opened it, or nobody sits", () => {
    expect(hostOf([{ name: "Alex" }, null])).toBeNull()
    expect(hostOf([null, null])).toBeNull()
  })
})

describe("PACES", () => {
  it("name every pace once, in the order a setting offers them", () => {
    expect(PACES.map((pace) => pace.value)).toEqual(["fast", "normal", "none", "async"])
    expect(new Set(PACES.map((pace) => pace.label)).size).toBe(PACES.length)
  })
})

describe("lasted", () => {
  it("says the minutes, then the hours and the minutes, then the days", () => {
    expect(lasted(0)).toBe("0 min")
    expect(lasted(59_999)).toBe("0 min")
    expect(lasted(4 * 60_000)).toBe("4 min")
    expect(lasted(59 * 60_000 + 59_000)).toBe("59 min")
    expect(lasted(60 * 60_000)).toBe("1 h 00")
    expect(lasted((2 * 60 + 5) * 60_000)).toBe("2 h 05")
    expect(lasted((23 * 60 + 59) * 60_000)).toBe("23 h 59")
    expect(lasted(24 * 60 * 60_000)).toBe("1 d")
    expect(lasted(3.5 * 24 * 60 * 60_000)).toBe("3 d")
  })
})

describe("ageOf", () => {
  it("says when a table that waits was opened", () => {
    expect(ageOf("waiting", ago(0), NOW)).toBe("Opened just now")
    expect(ageOf("waiting", new Date(NOW - 59_000).toISOString(), NOW)).toBe("Opened just now")
    expect(ageOf("waiting", ago(4), NOW)).toBe("Opened 4 min ago")
    expect(ageOf("waiting", ago(125), NOW)).toBe("Opened 2 h 05 ago")
  })

  it("says how long a table that is played has been", () => {
    expect(ageOf("playing", ago(0), NOW)).toBe("Just started")
    expect(ageOf("playing", ago(18), NOW)).toBe("Playing for 18 min")
    expect(ageOf("playing", ago(60 * 24 * 3), NOW)).toBe("Playing for 3 d")
  })

  it("counts a date in the future, or one that does not read, as now", () => {
    expect(ageOf("waiting", ago(-5), NOW)).toBe("Opened just now")
    expect(ageOf("playing", "not a date", NOW)).toBe("Just started")
  })
})
