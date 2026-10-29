import { describe, expect, it } from "vitest"
import {
  addMonths,
  allowedOf,
  choiceOf,
  CONSENT_KEY,
  CONSENT_RENEWAL_MONTHS,
  clearConsent,
  makeConsent,
  parseConsent,
  readConsent,
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
  it("reads a valid answer of either kind", () => {
    const at = "2026-09-01T08:00:00.000Z"
    expect(parseConsent(stored("accepted", at), NOW)).toEqual({ choice: "accepted", at })
    expect(parseConsent(stored("refused", at), NOW)).toEqual({ choice: "refused", at })
    expect(parseConsent(stored("analytics", at), NOW)).toEqual({ choice: "analytics", at })
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
})

describe("allowedOf / choiceOf", () => {
  it("says what each choice lets the site do, and nothing when there is no answer", () => {
    expect(allowedOf("refused")).toEqual({ analytics: false, recordings: false })
    expect(allowedOf("analytics")).toEqual({ analytics: true, recordings: false })
    expect(allowedOf("accepted")).toEqual({ analytics: true, recordings: true })
    expect(allowedOf(null)).toEqual({ analytics: false, recordings: false })
    expect(allowedOf(undefined)).toEqual({ analytics: false, recordings: false })
  })

  it("hands out a copy, so nobody changes what a choice allows", () => {
    allowedOf("accepted").analytics = false
    expect(allowedOf("accepted").analytics).toBe(true)
  })

  it("gives back the choice that allows exactly this", () => {
    expect(choiceOf({ analytics: false, recordings: false })).toBe("refused")
    expect(choiceOf({ analytics: true, recordings: false })).toBe("analytics")
    expect(choiceOf({ analytics: true, recordings: true })).toBe("accepted")
    for (const choice of ["refused", "analytics", "accepted"] as const) expect(choiceOf(allowedOf(choice))).toBe(choice)
  })

  it("reads a recording without the identifier it hangs on as a refusal", () => {
    expect(choiceOf({ analytics: false, recordings: true })).toBe("refused")
  })
})

describe("readConsent / writeConsent / clearConsent", () => {
  it("round-trips the answer under one key", () => {
    const store = memoryStore()
    expect(readConsent(store, NOW)).toBeNull()
    const written = writeConsent(store, "accepted", NOW)
    expect(written).toEqual({ choice: "accepted", at: NOW.toISOString() })
    expect([...store.data.keys()]).toEqual([CONSENT_KEY])
    expect(readConsent(store, NOW)).toEqual(written)
    expect(writeConsent(store, "refused", NOW).choice).toBe("refused")
    expect(readConsent(store, NOW)?.choice).toBe("refused")
    clearConsent(store)
    expect(readConsent(store, NOW)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it("survives a storage that throws", () => {
    expect(readConsent(brokenStore, NOW)).toBeNull()
    expect(writeConsent(brokenStore, "refused", NOW)).toEqual(makeConsent("refused", NOW))
    expect(() => clearConsent(brokenStore)).not.toThrow()
  })
})
