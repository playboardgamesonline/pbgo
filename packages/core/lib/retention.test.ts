import { describe, expect, it } from "vitest"
import { FEEDBACK_RETENTION_MONTHS, FINISHED_STATE_RETENTION_HOURS, TABLE_RETENTION_DAYS, UNRANKED_SEAT_RETENTION_MONTHS, feedbackCutoff, finishedStateCutoff, tableCutoff, unrankedSeatCutoff } from "./retention"

const at = (iso: string) => new Date(iso)

describe("the periods", () => {
  it("are the ones the owner confirmed on 6 November 2026 and the Privacy Policy states", () => {
    expect(TABLE_RETENTION_DAYS).toBe(30)
    expect(FEEDBACK_RETENTION_MONTHS).toBe(12)
  })

  it("are the ones the owner decided on 11 October 2026 for the games that are written down: their state a day after the table was last written, the seats of an unranked game a year after it ended", () => {
    expect(FINISHED_STATE_RETENTION_HOURS).toBe(24)
    expect(UNRANKED_SEAT_RETENTION_MONTHS).toBe(12)
  })
})

describe("tableCutoff", () => {
  it("is 30 days before now, to the millisecond", () => {
    expect(tableCutoff(at("2026-11-06T12:00:00.123Z")).toISOString()).toBe("2026-10-07T12:00:00.123Z")
  })

  it("crosses a month and a year", () => {
    expect(tableCutoff(at("2027-01-10T03:17:00.000Z")).toISOString()).toBe("2026-12-11T03:17:00.000Z")
  })

  it("does not move with the clock changes of a time zone: the days are 24 hours", () => {
    expect(tableCutoff(at("2026-04-15T00:00:00.000Z")).toISOString()).toBe("2026-03-16T00:00:00.000Z")
  })
})

describe("feedbackCutoff", () => {
  it("is the same moment 12 months earlier", () => {
    expect(feedbackCutoff(at("2026-11-06T03:17:45.678Z")).toISOString()).toBe("2025-11-06T03:17:45.678Z")
  })

  it("keeps a 31st when the earlier month has one", () => {
    expect(feedbackCutoff(at("2027-03-31T00:00:00.000Z")).toISOString()).toBe("2026-03-31T00:00:00.000Z")
  })

  it("lands on the last day of an earlier month that is shorter: 29 February goes to 28 February", () => {
    expect(feedbackCutoff(at("2028-02-29T10:00:00.000Z")).toISOString()).toBe("2027-02-28T10:00:00.000Z")
  })

  it("goes back across a leap year without losing a day", () => {
    expect(feedbackCutoff(at("2029-03-01T00:00:00.000Z")).toISOString()).toBe("2028-03-01T00:00:00.000Z")
  })

  it("does not change the date it is given", () => {
    const now = at("2026-11-06T03:17:00.000Z")
    feedbackCutoff(now)
    tableCutoff(now)
    finishedStateCutoff(now)
    unrankedSeatCutoff(now)
    expect(now.toISOString()).toBe("2026-11-06T03:17:00.000Z")
  })
})

describe("finishedStateCutoff", () => {
  it("is 24 hours before now, to the millisecond, across a day and a month", () => {
    expect(finishedStateCutoff(at("2026-11-06T12:00:00.123Z")).toISOString()).toBe("2026-11-05T12:00:00.123Z")
    expect(finishedStateCutoff(at("2026-12-01T00:30:00.000Z")).toISOString()).toBe("2026-11-30T00:30:00.000Z")
  })
})

describe("unrankedSeatCutoff", () => {
  it("is the same moment 12 months earlier, as the feedback's is", () => {
    expect(unrankedSeatCutoff(at("2026-11-06T03:17:45.678Z")).toISOString()).toBe("2025-11-06T03:17:45.678Z")
    expect(unrankedSeatCutoff(at("2028-02-29T10:00:00.000Z")).toISOString()).toBe("2027-02-28T10:00:00.000Z")
  })
})
