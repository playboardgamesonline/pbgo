import { describe, expect, it } from "vitest"
import { LINE_LEADING, setLine, turnSentence, type TurnWords, whoseTurn } from "./turn"

const playing = { status: "playing" as const, meId: "me" }

describe("whoseTurn", () => {
  it("is the viewer when the game waits for them, alone or with others", () => {
    expect(whoseTurn({ ...playing, waitingFor: ["me"] })).toEqual({ kind: "you" })
    expect(whoseTurn({ ...playing, waitingFor: ["ann", "me", "bob"] })).toEqual({ kind: "you" })
  })

  it("is the one other player the game waits for, on a classic turn", () => {
    expect(whoseTurn({ ...playing, waitingFor: ["ann"] })).toEqual({ kind: "turn", id: "ann" })
  })

  it("is the players the game waits for together, when the viewer is not one of them: a simultaneous step", () => {
    expect(whoseTurn({ ...playing, waitingFor: ["ann", "bob"] })).toEqual({ kind: "waiting", ids: ["ann", "bob"] })
  })

  it("is the same for a spectator, who is nobody's seat", () => {
    expect(whoseTurn({ status: "playing", meId: null, waitingFor: ["ann"] })).toEqual({ kind: "turn", id: "ann" })
    expect(whoseTurn({ status: "playing", meId: null, waitingFor: ["ann", "bob"] })).toEqual({ kind: "waiting", ids: ["ann", "bob"] })
  })

  it("is nobody before the game, after it, or when the game waits for nobody", () => {
    for (const status of ["lobby", "starting", "over"] as const) expect(whoseTurn({ status, meId: "me", waitingFor: ["me"] })).toBeNull()
    expect(whoseTurn({ ...playing, waitingFor: [] })).toBeNull()
  })
})

// The platform's English words, as `UI_TEXTS` writes them
const WORDS: Record<string, string> = { yourTurn: "It's your turn", turnOf: "{name}'s turn", waitingFor: "Waiting for {names}" }
const words: TurnWords = (key, params) => Object.entries(params ?? {}).reduce((text, [name, value]) => text.replace(`{${name}}`, value), WORDS[key]!)
const nameOf = (id: string) => ({ ann: "Ann", bob: "Bob", cyd: "Cyd" })[id] ?? "?"

describe("turnSentence", () => {
  it("says it is the viewer's turn in the platform's words", () => {
    expect(turnSentence({ kind: "you" }, words, nameOf)).toBe("It's your turn")
  })

  it("names the player whose turn it is", () => {
    expect(turnSentence({ kind: "turn", id: "ann" }, words, nameOf)).toBe("Ann's turn")
  })

  it("lists, in the order the game gives them, the players it waits for together", () => {
    expect(turnSentence({ kind: "waiting", ids: ["bob", "ann", "cyd"] }, words, nameOf)).toBe("Waiting for Bob, Ann, Cyd")
  })

  it("says nothing for nobody", () => {
    expect(turnSentence(null, words, nameOf)).toBeNull()
  })
})

describe("setLine", () => {
  it("keeps a sentence on one line at the height asked for while it fits, or when there is no limit", () => {
    expect(setLine("Ann's turn", 0.7)).toEqual({ lines: ["Ann's turn"], height: 0.7 })
    expect(setLine("Ann's turn", 0.7, 6)).toEqual({ lines: ["Ann's turn"], height: 0.7 })
  })

  it("breaks a sentence that does not fit at the space that leaves the two lines the most alike, in letters of the same height", () => {
    const set = setLine("Waiting for Ann, Bob, Cyd", 0.5, 4.4)
    expect(set.lines).toEqual(["Waiting for", "Ann, Bob, Cyd"])
    expect(set.height).toBe(0.5)
  })

  it("sets the letters smaller when two lines are still too wide", () => {
    const set = setLine("Waiting for Alexandria, Bartholomew, Christopher", 0.5, 4.4)
    expect(set.lines).toHaveLength(2)
    expect(set.height).toBeLessThan(0.5)
    const widest = Math.max(...set.lines.map((line) => Array.from(line).length))
    expect(widest * 0.62 * set.height).toBeLessThanOrEqual(4.4 + 1e-9)
  })

  it("shrinks a single long word, which has no space to break at", () => {
    const set = setLine("Supercalifragilisticexpialidocious", 0.7, 4)
    expect(set.lines).toHaveLength(1)
    expect(set.height).toBeLessThan(0.7)
  })

  it("leaves a line a little more than its height apart from the next", () => {
    expect(LINE_LEADING).toBeGreaterThan(1)
  })
})
