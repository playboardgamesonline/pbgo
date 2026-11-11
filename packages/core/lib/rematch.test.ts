import { describe, expect, it } from "vitest"
import type { PublicPlayer } from "./game-types"
import { nameList, rematchLine, rematchOf, rematchToastId, watchRematch } from "./rematch"

const player = (id: string, nickname: string, left = false): PublicPlayer => ({ id, nickname, ...(left ? { left: true } : {}) })
const ann = player("a", "Ann")
const bob = player("b", "Bob")
const cy = player("c", "Cy")

describe("rematchOf", () => {
  it("tells who agreed and who has not answered, in seat order", () => {
    const rematch = rematchOf([ann, bob, cy], ["c", "a"], "b", 2)
    expect(rematch.agreed.map((p) => p.id)).toEqual(["a", "c"])
    expect(rematch.waiting.map((p) => p.id)).toEqual(["b"])
    expect(rematch.mine).toBe(false)
    expect(rematch.enough).toBe(true)
  })

  it("knows the visitor agreed", () => {
    expect(rematchOf([ann, bob], ["a"], "a", 2).mine).toBe(true)
    expect(rematchOf([ann, bob], ["a"], null, 2).mine).toBe(false)
  })

  it("does not ask a player who left, and does not count them", () => {
    const rematch = rematchOf([ann, player("b", "Bob", true), cy], ["a"], "a", 2)
    expect(rematch.waiting.map((p) => p.id)).toEqual(["c"])
    expect(rematch.left.map((p) => p.id)).toEqual(["b"])
    expect(rematch.enough).toBe(true)
  })

  it("has not enough players when too few are left for the game", () => {
    expect(rematchOf([ann, player("b", "Bob", true)], [], "a", 2).enough).toBe(false)
    expect(rematchOf([ann, bob, player("c", "Cy", true)], [], "a", 3).enough).toBe(false)
  })
})

describe("nameList", () => {
  it("writes names in a sentence", () => {
    expect(nameList([])).toBe("")
    expect(nameList(["Ann"])).toBe("Ann")
    expect(nameList(["Ann", "Bob"])).toBe("Ann and Bob")
    expect(nameList(["Ann", "Bob", "Cy"])).toBe("Ann, Bob and Cy")
  })
})

describe("rematchLine", () => {
  it("says nothing before anybody votes", () => {
    expect(rematchLine(rematchOf([ann, bob], [], "a", 2))).toBeNull()
  })

  it("tells the visitor who asked for another game", () => {
    expect(rematchLine(rematchOf([ann, bob, cy], ["b"], "a", 2))).toBe("Bob wants a rematch.")
    expect(rematchLine(rematchOf([ann, bob, cy], ["b", "c"], "a", 2))).toBe("Bob and Cy want a rematch.")
  })

  it("tells a visitor who has voted whom the table waits for", () => {
    expect(rematchLine(rematchOf([ann, bob, cy], ["a"], "a", 2))).toBe("Waiting for Bob and Cy.")
    expect(rematchLine(rematchOf([ann, bob, cy], ["a", "b"], "a", 2))).toBe("Waiting for Cy.")
  })

  it("says nothing when everybody agreed: the game is about to begin", () => {
    expect(rematchLine(rematchOf([ann, bob], ["a", "b"], "a", 2))).toBeNull()
  })

  it("says who left, and that there are too few players for another game when that is so", () => {
    expect(rematchLine(rematchOf([ann, bob, player("c", "Cy", true)], ["a"], "a", 2))).toBe("Waiting for Bob. Cy left the table.")
    expect(rematchLine(rematchOf([ann, player("b", "Bob", true)], [], "a", 2))).toBe("Not enough players are left for another game. Bob left the table.")
  })
})

describe("watchRematch", () => {
  it("tells nothing at the first read, which only remembers the votes", () => {
    const first = watchRematch(null, ["b"], "a")
    expect(first.tell).toEqual([])
    expect([...first.seen]).toEqual(["b"])
  })

  it("tells the players who voted since the last read, never the visitor, never twice", () => {
    const first = watchRematch(null, [], "a")
    const second = watchRematch(first.seen, ["b", "a"], "a")
    expect(second.tell).toEqual(["b"])
    const third = watchRematch(second.seen, ["b", "a", "c"], "a")
    expect(third.tell).toEqual(["c"])
    expect(watchRematch(third.seen, ["b", "a", "c"], "a").tell).toEqual([])
  })

  it("tells a vote that goes and comes back once only", () => {
    const first = watchRematch(null, [], "a")
    const second = watchRematch(first.seen, ["b"], "a")
    expect(watchRematch(second.seen, [], "a").tell).toEqual([])
    expect(watchRematch(second.seen, ["b"], "a").tell).toEqual([])
  })
})

describe("rematchToastId", () => {
  it("is one for each player of a table", () => {
    expect(rematchToastId("ABC234", "b")).toBe("rematch:ABC234:b")
    expect(rematchToastId("ABC234", "b")).not.toBe(rematchToastId("ABC234", "c"))
  })
})
