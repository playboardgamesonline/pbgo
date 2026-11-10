import { describe, expect, it, vi } from "vitest"
import type { LogLine } from "./game-types"
import { createLogPlayer } from "./log-player"

type Event = { kind: string }
const line = (v: number, kind = "draw"): LogLine<Event> => ({ v, event: { kind } })

/** A handler that records what it plays and holds each line until the test lets it go */
function slow() {
  const played: { v: number; instant: boolean }[] = []
  const releases: (() => void)[] = []
  return {
    played,
    releases,
    play: (l: LogLine<Event>, context: { instant: boolean }) => {
      played.push({ v: l.v, instant: context.instant })
      return new Promise<void>((resolve) => releases.push(resolve))
    },
  }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("createLogPlayer", () => {
  it("plays nothing the first time: it only takes note of how far the log goes", async () => {
    const play = vi.fn()
    const player = createLogPlayer<Event>({ play })
    player.sync([line(3), line(4), line(4)])
    await tick()
    expect(play).not.toHaveBeenCalled()
    expect(player.last).toBe(4)
  })

  it("plays the new lines in the order they were said, and not the ones it has seen", async () => {
    const seen: number[] = []
    const player = createLogPlayer<Event>({ play: (l) => void seen.push(l.v) })
    player.sync([line(3)])
    player.sync([line(3), line(5), line(5), line(6)])
    await tick()
    expect(seen).toEqual([5, 5, 6])
    player.sync([line(3), line(5), line(5), line(6)])
    await tick()
    expect(seen).toEqual([5, 5, 6])
  })

  it("takes note of an empty log, so the first moves are played", async () => {
    const seen: number[] = []
    const player = createLogPlayer<Event>({ play: (l) => void seen.push(l.v) })
    player.sync([])
    player.sync([line(2)])
    await tick()
    expect(seen).toEqual([2])
  })

  it("waits for a line to finish before it plays the next, and is busy meanwhile", async () => {
    const handler = slow()
    const busy: boolean[] = []
    const player = createLogPlayer<Event>({ play: handler.play, onBusy: (b) => busy.push(b) })
    player.sync([line(1)])
    player.sync([line(1), line(2), line(3)])
    await tick()
    expect(handler.played.map((p) => p.v)).toEqual([2])
    expect(player.busy).toBe(true)
    handler.releases[0]!()
    await tick()
    expect(handler.played.map((p) => p.v)).toEqual([2, 3])
    handler.releases[1]!()
    await tick()
    expect(player.busy).toBe(false)
    expect(busy).toEqual([true, false])
  })

  it("queues the lines that come while one is playing, after the ones that wait", async () => {
    const handler = slow()
    const player = createLogPlayer<Event>({ play: handler.play })
    player.sync([line(1)])
    player.sync([line(1), line(2)])
    await tick()
    player.sync([line(1), line(2), line(3)])
    handler.releases[0]!()
    await tick()
    expect(handler.played.map((p) => p.v)).toEqual([2, 3])
  })

  it("plays a line instantly while motion is off", async () => {
    let off = false
    const seen: boolean[] = []
    const player = createLogPlayer<Event>({ play: (_l, { instant }) => void seen.push(instant), instant: () => off })
    player.sync([line(1)])
    player.sync([line(1), line(2)])
    await tick()
    off = true
    player.sync([line(1), line(2), line(3)])
    await tick()
    expect(seen).toEqual([false, true])
  })

  it("plays all the lines that came at once instantly when there are more than it can catch up", async () => {
    const seen: boolean[] = []
    const player = createLogPlayer<Event>({ play: (_l, { instant }) => void seen.push(instant), catchUp: 3 })
    player.sync([line(1)])
    player.sync([line(1), line(2), line(3), line(4)])
    await tick()
    player.sync([line(1), line(2), line(3), line(4), line(5), line(6)])
    await tick()
    expect(seen).toEqual([false, false, false, false, false])
    player.sync([line(7), line(8), line(9), line(10), line(11)])
    await tick()
    expect(seen.slice(5)).toEqual([true, true, true, true, true])
  })

  it("goes on after a line that throws or rejects, and says so", async () => {
    const errors: number[] = []
    const seen: number[] = []
    const player = createLogPlayer<Event>({
      play: (l) => {
        seen.push(l.v)
        if (l.v === 2) throw new Error("sync")
        if (l.v === 3) return Promise.reject(new Error("async"))
      },
      onError: (_e, l) => errors.push(l.v),
    })
    player.sync([line(1)])
    player.sync([line(1), line(2), line(3), line(4)])
    await tick()
    expect(seen).toEqual([2, 3, 4])
    expect(errors).toEqual([2, 3])
    expect(player.busy).toBe(false)
  })

  it("keeps playing the moves of a new game once the log was emptied, since the versions only grow", async () => {
    const seen: number[] = []
    const player = createLogPlayer<Event>({ play: (l) => void seen.push(l.v) })
    player.sync([line(8), line(9)])
    player.sync([])
    player.sync([line(12, "round"), line(12), line(13)])
    await tick()
    expect(seen).toEqual([12, 12, 13])
  })

  it("never plays a line older than the last it took note of", async () => {
    const seen: number[] = []
    const player = createLogPlayer<Event>({ play: (l) => void seen.push(l.v) })
    player.sync([line(10)])
    player.sync([line(4), line(5)])
    await tick()
    expect(seen).toEqual([])
    expect(player.last).toBe(10)
  })

  it("drops what waits and takes no more lines once stopped, and lets the line that plays finish", async () => {
    const handler = slow()
    const player = createLogPlayer<Event>({ play: handler.play })
    player.sync([line(1)])
    player.sync([line(1), line(2), line(3)])
    await tick()
    player.stop()
    handler.releases[0]!()
    await tick()
    expect(handler.played.map((p) => p.v)).toEqual([2])
    player.sync([line(1), line(2), line(3), line(4)])
    await tick()
    expect(handler.played.map((p) => p.v)).toEqual([2])
    expect(player.busy).toBe(false)
  })
})
