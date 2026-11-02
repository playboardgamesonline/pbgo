import { describe, expect, it } from "vitest"
import {
  ACCEPT_ALL,
  addMonths,
  answerOf,
  CONSENT_KEY,
  CONSENT_RENEWAL_MONTHS,
  CONSENT_REVISION,
  clearConsent,
  makeConsent,
  parseConsent,
  readConsent,
  REJECT_OPTIONAL,
  writeConsent,
  type ConsentStore,
} from "./consent"

const NOW = new Date("2026-10-13T10:00:00.000Z")

function memoryStore(initial: Record<string, string> = {}): ConsentStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const brokenStore: ConsentStore = {
  getItem() {
    throw new Error("blocked")
  },
  setItem() {
    throw new Error("blocked")
  },
  removeItem() {
    throw new Error("blocked")
  },
}

const stored = (choice: string, at: string) => JSON.stringify({ choice, at })

describe("addMonths", () => {
  it("adds calendar months in UTC", () => {
    expect(addMonths(new Date("2026-10-13T10:00:00.000Z"), 13).toISOString()).toBe("2027-11-13T10:00:00.000Z")
    expect(addMonths(new Date("2026-01-01T00:00:00.000Z"), 12).toISOString()).toBe("2027-01-01T00:00:00.000Z")
  })
})

describe("parseConsent", () => {
  it("reads a valid answer of either kind, marketing off when the answer never offered it", () => {
    const at = "2026-09-01T08:00:00.000Z"
    expect(parseConsent(stored("accepted", at), NOW)).toEqual({ choice: "accepted", marketing: false, at })
    expect(parseConsent(stored("refused", at), NOW)).toEqual({ choice: "refused", marketing: false, at })
  })

  it("reads the marketing switch, and only a true one counts", () => {
    const at = "2026-09-01T08:00:00.000Z"
    expect(parseConsent(JSON.stringify({ choice: "accepted", marketing: true, rev: 1, at }), NOW)).toEqual({ choice: "accepted", marketing: true, at })
    expect(parseConsent(JSON.stringify({ choice: "refused", marketing: true, rev: 1, at }), NOW)).toEqual({ choice: "refused", marketing: true, at })
    expect(parseConsent(JSON.stringify({ choice: "accepted", marketing: "yes", rev: 1, at }), NOW)?.marketing).toBe(false)
  })

  it("is empty when nothing usable was stored", () => {
    expect(parseConsent(null, NOW)).toBeNull()
    expect(parseConsent("", NOW)).toBeNull()
    expect(parseConsent("{", NOW)).toBeNull()
    expect(parseConsent("null", NOW)).toBeNull()
    expect(parseConsent('"accepted"', NOW)).toBeNull()
    expect(parseConsent(stored("maybe", "2026-09-01T08:00:00.000Z"), NOW)).toBeNull()
    expect(parseConsent(JSON.stringify({ choice: "accepted" }), NOW)).toBeNull()
    expect(parseConsent(JSON.stringify({ choice: "accepted", at: 5 }), NOW)).toBeNull()
    expect(parseConsent(stored("accepted", "yesterday"), NOW)).toBeNull()
  })

  it("asks again once the renewal delay is over, not before", () => {
    expect(CONSENT_RENEWAL_MONTHS).toBe(13)
    // Answered on 2025-09-13: 13 months later is 2026-10-13, today. Expired.
    expect(parseConsent(stored("accepted", "2025-09-13T10:00:00.000Z"), NOW)).toBeNull()
    // One minute before the end of the delay, still valid.
    expect(parseConsent(stored("accepted", "2025-09-13T10:01:00.000Z"), NOW)).not.toBeNull()
    expect(parseConsent(stored("refused", "2024-01-01T00:00:00.000Z"), NOW)).toBeNull()
  })

  it("treats an answer dated in the future as unusable, with a day of slack for clocks", () => {
    expect(parseConsent(stored("accepted", "2026-10-14T09:00:00.000Z"), NOW)).not.toBeNull()
    expect(parseConsent(stored("accepted", "2026-10-15T00:00:00.000Z"), NOW)).toBeNull()
    expect(parseConsent(stored("accepted", "2030-01-01T00:00:00.000Z"), NOW)).toBeNull()
  })

  it("asks again for an answer given under an older revision, the one that has none being the first", () => {
    const at = "2026-09-01T08:00:00.000Z"
    // Today's revision still takes the answers stored before revisions existed
    expect(parseConsent(stored("accepted", at), NOW)).not.toBeNull()
    expect(parseConsent(JSON.stringify({ choice: "accepted", rev: CONSENT_REVISION, at }), NOW)).not.toBeNull()
    // The day a tool needs a purpose that no answer offered, the revision goes up and every answer given before is asked again
    expect(parseConsent(JSON.stringify({ choice: "accepted", marketing: true, rev: 1, at }), NOW, 2)).toBeNull()
    expect(parseConsent(stored("accepted", at), NOW, 2)).toBeNull()
    expect(parseConsent(JSON.stringify({ choice: "accepted", marketing: true, rev: 2, at }), NOW, 2)).not.toBeNull()
  })
})

describe("answers", () => {
  it("reads Accept all and Reject optional as every switch the same way", () => {
    expect(makeConsent("accepted", NOW)).toEqual({ choice: "accepted", marketing: true, at: NOW.toISOString() })
    expect(makeConsent("refused", NOW)).toEqual({ choice: "refused", marketing: false, at: NOW.toISOString() })
    expect(makeConsent(ACCEPT_ALL, NOW)).toEqual(makeConsent("accepted", NOW))
    expect(makeConsent(REJECT_OPTIONAL, NOW)).toEqual(makeConsent("refused", NOW))
  })

  it("keeps each switch of a custom answer apart: analytics makes the choice, marketing stands alone", () => {
    expect(makeConsent({ analytics: true, marketing: false }, NOW)).toMatchObject({ choice: "accepted", marketing: false })
    expect(makeConsent({ analytics: false, marketing: true }, NOW)).toMatchObject({ choice: "refused", marketing: true })
  })

  it("gives the switches back as a stored answer left them, all off when there is none", () => {
    expect(answerOf(null)).toEqual(REJECT_OPTIONAL)
    expect(answerOf(makeConsent(ACCEPT_ALL, NOW))).toEqual(ACCEPT_ALL)
    expect(answerOf(makeConsent({ analytics: false, marketing: true }, NOW))).toEqual({ analytics: false, marketing: true })
  })
})

describe("readConsent / writeConsent / clearConsent", () => {
  it("round-trips the answer under one key, with the revision beside it", () => {
    const store = memoryStore()
    expect(readConsent(store, NOW)).toBeNull()
    const written = writeConsent(store, "accepted", NOW)
    expect(written).toEqual({ choice: "accepted", marketing: true, at: NOW.toISOString() })
    expect([...store.data.keys()]).toEqual([CONSENT_KEY])
    expect(JSON.parse(store.data.get(CONSENT_KEY) ?? "null")).toEqual({ ...written, rev: CONSENT_REVISION })
    expect(readConsent(store, NOW)).toEqual(written)
    expect(writeConsent(store, "refused", NOW).choice).toBe("refused")
    expect(readConsent(store, NOW)?.choice).toBe("refused")
    clearConsent(store)
    expect(readConsent(store, NOW)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it("round-trips a custom answer", () => {
    const store = memoryStore()
    writeConsent(store, { analytics: false, marketing: true }, NOW)
    expect(readConsent(store, NOW)).toEqual({ choice: "refused", marketing: true, at: NOW.toISOString() })
  })

  it("survives a storage that throws", () => {
    expect(readConsent(brokenStore, NOW)).toBeNull()
    expect(writeConsent(brokenStore, "refused", NOW)).toEqual(makeConsent("refused", NOW))
    expect(() => clearConsent(brokenStore)).not.toThrow()
  })
})
