import { describe, expect, it } from "vitest"
import { extractLinks, formatDuration, formatUsd, palette, printable, shorten, tilde, tildeAll } from "./render.ts"

describe("render", () => {
  it("says how long a call took", () => {
    expect(formatDuration(0)).toBe("0 s")
    expect(formatDuration(37_400)).toBe("37 s")
    expect(formatDuration(60_000)).toBe("1 min")
    expect(formatDuration(252_000)).toBe("4 min 12 s")
  })

  it("prints money in dollars with cents", () => {
    expect(formatUsd(0.6401)).toBe("$0.64")
    expect(formatUsd(3)).toBe("$3.00")
  })

  it("makes one line of at most the width, with an ellipsis when it cut", () => {
    expect(shorten("a   b\n c", 20)).toBe("a b c")
    expect(shorten("abcdefghij", 5)).toBe("abcd…")
  })

  it("prints the home folder as a tilde", () => {
    expect(tilde("/Users/ada/Companies/PBGO", "/Users/ada")).toBe("~/Companies/PBGO")
    expect(tilde("/Users/adam/x", "/Users/ada")).toBe("/Users/adam/x")
    expect(tilde("/tmp/x", "")).toBe("/tmp/x")
  })

  it("finds the https addresses of a report, once each, without the punctuation of the sentence", () => {
    const text = "Draft https://pbgo.sanity.studio/intent/edit/id=game-x;type=game.\nSee (https://example.com/a), https://example.com/a and http://insecure.example"
    expect(extractLinks(text)).toEqual(["https://pbgo.sanity.studio/intent/edit/id=game-x;type=game", "https://example.com/a"])
  })

  it("has no escape code when colours are off", () => {
    expect(palette(false).bold("x")).toBe("x")
    expect(palette(true).green("x")).toContain("\u001b[32m")
  })
})

describe("home paths in a text", () => {
  it("prints every path of the home folder as a tilde", () => {
    expect(tildeAll("ok /Users/ada/Companies/x/scout.json and /Users/ada/y", "/Users/ada")).toBe("ok ~/Companies/x/scout.json and ~/y")
    expect(tildeAll("/Users/adam/x", "/Users/ada")).toBe("/Users/adam/x")
    expect(tildeAll("/x", "")).toBe("/x")
  })
})

describe("text from an agent", () => {
  const ESC = String.fromCharCode(27)
  const BEL = String.fromCharCode(7)

  it("is printed with no escape sequence in it: the agent read web pages, and a terminal obeys what it is sent", () => {
    expect(printable(`${ESC}[31mred${ESC}[0m text`)).toBe("red text")
    expect(printable(`before${ESC}[2J${ESC}[Hafter`)).toBe("beforeafter")
    // a title of the window, ended by a bell or by a string terminator, and a link that hides where it leads
    expect(printable(`a${ESC}]0;pwned${BEL}b`)).toBe("ab")
    expect(printable(`${ESC}]8;;https://evil.example${ESC}\\the link${ESC}]8;;${ESC}\\ ok`)).toBe("the link ok")
    expect(printable(`x${ESC}c${ESC}7y`)).toBe("xy")
  })

  it("loses no escape character, even one that no sequence ends", () => {
    for (const text of [`a${ESC}`, `${ESC}[`, `${ESC}[31`, `a${ESC}]0;never ended`, `${ESC}${ESC}${ESC}`]) expect(printable(text), JSON.stringify(text)).not.toContain(ESC)
  })

  it("drops the control characters but the line break and the tab, and keeps every other character", () => {
    expect(printable(`a${BEL}b${String.fromCharCode(8)}c${String.fromCharCode(0)}d\r\ne`)).toBe("abcd\ne")
    expect(printable("a\tb\nc")).toBe("a\tb\nc")
    expect(printable(`a${String.fromCharCode(0x9b)}31mb`)).toBe("a31mb")
    const plain = "Édition française · ✓ validé — 日本語 🎲 « tarot » https://example.com/a?b=c#d"
    expect(printable(plain)).toBe(plain)
  })
})
