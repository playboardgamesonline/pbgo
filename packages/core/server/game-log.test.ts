import type { LogEntry } from "@pbgo/engine-kit"
import { describe, expect, it, vi } from "vitest"
import type { LogLine } from "../lib/game-types"
import { LOG_TAIL, type LoggedStep, viewLogged } from "./game-log"

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({}) }))

type Event = { kind: "said"; by: string } | { kind: "looked"; by: string; card?: number }

const said = (by: string): LogEntry<Event> => ({ event: { kind: "said", by } })
const looked = (by: string, card: number): LogEntry<Event> => ({ event: { kind: "looked", by, card }, to: [by], masked: { kind: "looked", by } })
const step = (version: number, ...entries: LogEntry<Event>[]): LoggedStep => ({ version, entries })

describe("viewLogged", () => {
  const steps = [step(3, said("ana"), looked("ana", 7)), step(4, said("bob")), step(6, looked("bob", 9))]

  it("gives the lines of every move, oldest first, each with the version of its move", () => {
    expect(viewLogged(steps, "ana")).toEqual([
      { v: 3, event: { kind: "said", by: "ana" } },
      { v: 3, event: { kind: "looked", by: "ana", card: 7 } },
      { v: 4, event: { kind: "said", by: "bob" } },
      { v: 6, event: { kind: "looked", by: "bob" } },
    ])
  })

  it("reads each viewer's own lines in full and the lines of the others masked, a spectator and a stranger like any other player", () => {
    const cards = (viewer: string | null) => (viewLogged(steps, viewer) as LogLine<Event>[]).flatMap((line) => ("card" in line.event && line.event.card !== undefined ? [line.event.card] : []))
    expect(cards("ana")).toEqual([7])
    expect(cards("bob")).toEqual([9])
    expect(cards(null)).toEqual([])
    expect(cards("stranger")).toEqual([])
  })

  it("leaves out what a viewer may not know of at all, so the versions of their lines can skip some", () => {
    const hidden = [step(3, { event: { kind: "looked", by: "ana", card: 1 }, to: ["ana"] }), step(4, said("bob"))]
    expect(viewLogged(hidden, "bob")).toEqual([{ v: 4, event: { kind: "said", by: "bob" } }])
  })

  it("is empty for a table that has said nothing", () => {
    expect(viewLogged([], "ana")).toEqual([])
  })

  it("keeps the newest lines when there are more than a player is sent", () => {
    const many = Array.from({ length: LOG_TAIL + 15 }, (_, i) => step(i + 1, said("ana")))
    const lines = viewLogged(many, "ana")
    expect(lines).toHaveLength(LOG_TAIL)
    expect(lines[0]?.v).toBe(16)
    expect(lines.at(-1)?.v).toBe(LOG_TAIL + 15)
  })
})
