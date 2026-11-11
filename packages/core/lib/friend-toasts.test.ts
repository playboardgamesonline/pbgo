import { describe, expect, it } from "vitest"
import type { RequestEntry } from "./friends"
import { NO_WATCH, REQUEST_TOASTS_MAX, requestKey, requestToastId, watchRequests, type RequestWatch } from "./friend-toasts"

const request = (nickname: string, tag: number, at = "2026-11-11T10:00:00Z"): RequestEntry => ({ nickname, tag, avatarUrl: null, at })
const ALEX = request("Alex", 42)
const BEA = request("Bea", 7, "2026-11-11T10:05:00Z")

/** A tab that has read once, with these waiting. */
const after = (...entries: RequestEntry[]): RequestWatch => watchRequests(NO_WATCH, entries).watch

describe("the first read of a tab", () => {
  it("tells nothing: what waits already is what the badge of the panel counts", () => {
    const news = watchRequests(NO_WATCH, [ALEX, BEA])
    expect(news.tell).toEqual([])
    expect(news.more).toBe(0)
    expect(news.gone).toEqual([])
  })

  it("remembers what it read, even when nothing waits, so that the next read has something to compare with", () => {
    expect(watchRequests(NO_WATCH, []).watch.seen).toEqual(new Set())
    expect(watchRequests(watchRequests(NO_WATCH, []).watch, [ALEX]).tell).toEqual([ALEX])
  })

  it("tells nothing however many wait", () => {
    const many = Array.from({ length: 20 }, (_, index) => request(`Player${index}`, index + 1))
    const news = watchRequests(NO_WATCH, many)
    expect(news.tell).toEqual([])
    expect(news.more).toBe(0)
  })
})

describe("the reads that follow", () => {
  it("tell a request that was not there before", () => {
    const news = watchRequests(after(ALEX), [ALEX, BEA])
    expect(news.tell).toEqual([BEA])
    expect(news.more).toBe(0)
  })

  it("tell nothing when nothing is new", () => {
    expect(watchRequests(after(ALEX), [ALEX]).tell).toEqual([])
    expect(watchRequests(after(ALEX), []).tell).toEqual([])
  })

  it("never tell a request twice: the next read, with the toast gone, says nothing of it", () => {
    const first = watchRequests(after(), [ALEX])
    expect(first.tell).toEqual([ALEX])
    const second = watchRequests(first.watch, [ALEX])
    expect(second.tell).toEqual([])
    expect(watchRequests(second.watch, [ALEX, BEA]).tell).toEqual([BEA])
  })

  it("never tell a request twice, even when it goes and comes back", () => {
    const told = watchRequests(after(), [ALEX]).watch
    const gone = watchRequests(told, []).watch
    expect(watchRequests(gone, [ALEX]).tell).toEqual([])
  })

  it("tell the same person again when they ask again after taking the request back: it is another request", () => {
    const first = watchRequests(after(), [ALEX]).watch
    const gone = watchRequests(first, []).watch
    const again = request("Alex", 42, "2026-11-11T11:00:00Z")
    expect(watchRequests(gone, [again]).tell).toEqual([again])
  })

  it("take the case of a nickname for the same person", () => {
    expect(requestKey(request("Alex", 42))).toBe(requestKey(request("ALEX", 42)))
    expect(requestKey(request("Alex", 42))).not.toBe(requestKey(request("Alex", 43)))
    expect(watchRequests(after(request("Alex", 42)), [request("alex", 42)]).tell).toEqual([])
  })

  it("tell the oldest of several new requests first, so that the newest is the one in front", () => {
    const old = request("Cy", 1, "2026-11-11T09:00:00Z")
    const news = watchRequests(after(), [BEA, old])
    expect(news.tell).toEqual([old, BEA])
  })

  it("tell a request once if the read lists it twice", () => {
    expect(watchRequests(after(), [ALEX, { ...ALEX }]).tell).toEqual([ALEX])
  })
})

describe("a burst of requests", () => {
  const burst = (count: number) => Array.from({ length: count }, (_, index) => request(`Player${index}`, index + 1, `2026-11-11T10:${String(index).padStart(2, "0")}:00Z`))

  it("is told one by one up to the number of toasts sonner shows", () => {
    const news = watchRequests(after(), burst(REQUEST_TOASTS_MAX))
    expect(news.tell).toHaveLength(REQUEST_TOASTS_MAX)
    expect(news.more).toBe(0)
  })

  it("is told by the newest and counted for the rest, so that every toast fits", () => {
    const requests = burst(7)
    const news = watchRequests(after(), requests)
    expect(news.tell).toEqual(requests.slice(-(REQUEST_TOASTS_MAX - 1)))
    expect(news.more).toBe(7 - (REQUEST_TOASTS_MAX - 1))
    // The toasts and the count are as many as the toasts that are shown
    expect(news.tell.length + (news.more > 0 ? 1 : 0)).toBeLessThanOrEqual(REQUEST_TOASTS_MAX)
  })

  it("is not told again, nor counted again, at the next read", () => {
    const first = watchRequests(after(), burst(7))
    const next = watchRequests(first.watch, burst(7))
    expect(next.tell).toEqual([])
    expect(next.more).toBe(0)
  })
})

describe("the toasts that are out of date", () => {
  it("are those of the requests that were waiting at the last read and are not any more", () => {
    const first = watchRequests(after(), [ALEX, BEA])
    const news = watchRequests(first.watch, [BEA])
    expect(news.gone).toEqual([requestKey(ALEX)])
  })

  it("are said once", () => {
    const first = watchRequests(after(ALEX), [])
    expect(first.gone).toEqual([requestKey(ALEX)])
    expect(watchRequests(first.watch, []).gone).toEqual([])
  })

  it("are none for a request that is still there", () => {
    expect(watchRequests(after(ALEX), [ALEX]).gone).toEqual([])
  })
})

describe("a tab that shows another account", () => {
  it("starts again from nothing: the first read of the new account tells nothing", () => {
    const watching = watchRequests(after(ALEX), [ALEX]).watch
    expect(watching.seen).not.toBeNull()
    expect(watchRequests(NO_WATCH, [BEA]).tell).toEqual([])
  })
})

describe("requestToastId", () => {
  it("is one id for each request, and the same one each time", () => {
    expect(requestToastId(requestKey(ALEX))).toBe(requestToastId(requestKey(ALEX)))
    expect(requestToastId(requestKey(ALEX))).not.toBe(requestToastId(requestKey(BEA)))
  })

  it("names no account", () => {
    expect(requestToastId(requestKey(ALEX))).toBe("friend-request:alex#42@2026-11-11T10:00:00Z")
  })
})

describe("the memory of a tab", () => {
  it("is not changed by a read: the watch that went in is the one that stays", () => {
    const watch = after(ALEX)
    const copy = { seen: new Set(watch.seen), waiting: new Set(watch.waiting) }
    watchRequests(watch, [ALEX, BEA])
    expect(watch).toEqual(copy)
  })
})
