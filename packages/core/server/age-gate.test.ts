import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ readBirthdates: vi.fn(async (_ids: readonly string[]): Promise<Map<string, string>> => new Map()), from: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./birthdate", () => ({ readBirthdates: mocks.readBirthdates }))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from }) }))

import { NO_AGE_RULES, type AgeRules } from "../lib/age-rules"
import { ageGateFor } from "./age-gate"

const NOW = new Date("2026-11-09T12:00:00Z")
const game = { slug: "testgame" }
const rulesOf = (rules: AgeRules) => async () => rules
const ADULT_PACK: AgeRules = { game: null, expansions: { "adult-pack": 18 } }
const players = (...ids: string[]) => ids.map((id) => ({ id, nickname: id }))
const codeOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? (error as Error & { code?: string }).code : "other"
  }
  return null
}

beforeEach(() => {
  mocks.readBirthdates.mockReset()
  mocks.readBirthdates.mockResolvedValue(new Map())
  mocks.from.mockReset()
})

describe("a game that asks for no age", () => {
  it("looks nobody up and refuses nobody, a guest included", async () => {
    const gate = await ageGateFor(rulesOf(NO_AGE_RULES), game, { memberId: null, signedIn: false }, NOW)
    expect(gate.restricted).toBe(false)
    expect(gate.tableAge({ "adult-pack": true })).toBeNull()
    expect(() => gate.assertMay(gate.tableAge({}))).not.toThrow()
    expect(await gate.seatsOf({ code: "ABC234", players: players("p1", "p2") }, "p1")).toBeNull()
    expect(() => gate.assertSeats({ players: players("p1", "p2") }, null, null)).not.toThrow()
    expect(mocks.readBirthdates).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe("a game with an expansion for adults", () => {
  it("looks the member who acts up, once", async () => {
    mocks.readBirthdates.mockResolvedValue(new Map([["acct-ann", "1990-04-02"]]))
    const gate = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: "acct-ann", signedIn: true }, NOW)
    expect(gate.restricted).toBe(true)
    expect(() => gate.assertMay(18)).not.toThrow()
    expect(() => gate.assertMay(gate.tableAge({ "adult-pack": true }))).not.toThrow()
    expect(mocks.readBirthdates).toHaveBeenCalledExactlyOnceWith(["acct-ann"])
  })

  it("does not look a guest up: there is nothing to look up", async () => {
    const gate = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: null, signedIn: false }, NOW)
    expect(codeOf(() => gate.assertMay(18))).toBe("AGE_SIGN_IN_REQUIRED")
    expect(mocks.readBirthdates).not.toHaveBeenCalled()
  })

  it("counts the demo account of development as an adult, and looks nothing up for it", async () => {
    const gate = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: null, signedIn: true }, NOW)
    expect(() => gate.assertMay(18)).not.toThrow()
    expect(() => gate.assertMay(21)).not.toThrow()
    expect(mocks.readBirthdates).not.toHaveBeenCalled()
  })

  it("lets a member through only when their date makes them old enough on the day the gate is made for", async () => {
    mocks.readBirthdates.mockResolvedValue(new Map([["acct-ann", "2008-11-10"]]))
    const before = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: "acct-ann", signedIn: true }, new Date("2026-11-09T23:59:59Z"))
    expect(codeOf(() => before.assertMay(18))).toBe("AGE_TOO_YOUNG")
    const onTheDay = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: "acct-ann", signedIn: true }, new Date("2026-11-10T00:00:00Z"))
    expect(() => onTheDay.assertMay(18)).not.toThrow()
  })

  it("throws what the database says when the date cannot be read: nobody is let through", async () => {
    const error = new Error('relation "public.member_birthdates" does not exist')
    mocks.readBirthdates.mockRejectedValue(error)
    await expect(ageGateFor(rulesOf(ADULT_PACK), game, { memberId: "acct-ann", signedIn: true }, NOW)).rejects.toBe(error)
  })

  describe("raises", () => {
    it("is the new age when an expansion for adults is switched on, and null in every other case", async () => {
      const gate = await ageGateFor(rulesOf({ game: null, expansions: { "adult-pack": 18, "spicy-pack": 16, "kids-pack": 6 } }), game, { memberId: null, signedIn: false }, NOW)
      expect(gate.raises({}, { "adult-pack": true })).toBe(18)
      expect(gate.raises({ "spicy-pack": true }, { "spicy-pack": true, "adult-pack": true })).toBe(18)
      expect(gate.raises({ "adult-pack": true }, { "adult-pack": true })).toBeNull()
      expect(gate.raises({ "adult-pack": true }, { "adult-pack": false })).toBeNull()
      expect(gate.raises({ "adult-pack": true }, { "spicy-pack": true })).toBeNull()
      expect(gate.raises({}, { "kids-pack": true })).toBeNull()
      expect(gate.raises({}, {})).toBeNull()
    })
  })

  describe("the people seated", () => {
    const row = { code: "ABC234", players: players("p1", "p2", "p3") }
    const seatsOf = async (accounts: Record<string, unknown>, dates: Record<string, string>) => {
      mocks.readBirthdates.mockImplementation(async (ids) => new Map(ids.filter((id) => id in dates).map((id) => [id, dates[id]!])))
      mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { member_ids: accounts }, error: null }) }) }) }) })
      const gate = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: "acct-ann", signedIn: true }, NOW)
      return { gate, seats: await gate.seatsOf(row, "p1") }
    }

    it("knows the person who acts without asking the table about them, and the others by the account the table recorded for their seat", async () => {
      const { gate, seats } = await seatsOf({ p1: "acct-ann", p2: "acct-bob", p3: "acct-cy" }, { "acct-ann": "1990-04-02", "acct-bob": "1991-01-01", "acct-cy": "1992-02-02" })
      expect([...seats!.keys()].sort()).toEqual(["p1", "p2", "p3"])
      expect(() => gate.assertSeats(row, 18, seats)).not.toThrow()
      // The date of the person who acts comes from the lookup that made the gate, and the others' from the one for the seats
      expect(mocks.readBirthdates).toHaveBeenNthCalledWith(1, ["acct-ann"])
      expect(mocks.readBirthdates).toHaveBeenNthCalledWith(2, ["acct-bob", "acct-cy"])
    })

    it("refuses a table where a seat belongs to a guest (no account recorded), to a minor, or to a member with no date", async () => {
      for (const [accounts, dates] of [
        [{ p1: "acct-ann", p2: "acct-bob" }, { "acct-ann": "1990-04-02", "acct-bob": "1991-01-01" }],
        [{ p1: "acct-ann", p2: "acct-bob", p3: "acct-cy" }, { "acct-ann": "1990-04-02", "acct-bob": "1991-01-01", "acct-cy": "2008-11-10" }],
        [{ p1: "acct-ann", p2: "acct-bob", p3: "acct-cy" }, { "acct-ann": "1990-04-02", "acct-bob": "1991-01-01" }],
      ] as const) {
        const { gate, seats } = await seatsOf(accounts, dates)
        expect(codeOf(() => gate.assertSeats(row, 18, seats))).toBe("AGE_TABLE_NOT_ALLOWED")
      }
    })

    it("asks nothing of a table that asks for no age, whoever is seated", async () => {
      const { gate, seats } = await seatsOf({ p1: "acct-ann" }, { "acct-ann": "1990-04-02" })
      expect(() => gate.assertSeats(row, null, seats)).not.toThrow()
    })

    it("throws a conflict for a seat it was not told about: somebody sat down since the table was read", async () => {
      const { gate, seats } = await seatsOf({ p1: "acct-ann", p2: "acct-bob", p3: "acct-cy" }, { "acct-ann": "1990-04-02", "acct-bob": "1991-01-01", "acct-cy": "1992-02-02" })
      expect(codeOf(() => gate.assertSeats({ players: players("p1", "p2", "p3", "p4") }, 18, seats))).toBe("CONFLICT")
      expect(codeOf(() => gate.assertSeats(row, 18, null))).toBe("CONFLICT")
    })

    it("does not ask the table about a host who sits alone", async () => {
      mocks.readBirthdates.mockResolvedValue(new Map([["acct-ann", "1990-04-02"]]))
      const gate = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: "acct-ann", signedIn: true }, NOW)
      const seats = await gate.seatsOf({ code: "ABC234", players: players("p1") }, "p1")
      expect([...seats!.keys()]).toEqual(["p1"])
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it("throws what the database says when the table cannot be read: nobody is let through", async () => {
      const error = new Error("column games.member_ids does not exist")
      mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error }) }) }) }) })
      mocks.readBirthdates.mockResolvedValue(new Map([["acct-ann", "1990-04-02"]]))
      const gate = await ageGateFor(rulesOf(ADULT_PACK), game, { memberId: "acct-ann", signedIn: true }, NOW)
      await expect(gate.seatsOf(row, "p1")).rejects.toBe(error)
    })
  })
})
