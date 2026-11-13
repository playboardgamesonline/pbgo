import { describe, expect, it } from "vitest"
import { NAME_LIMIT, shortName } from "./short-name"

describe("shortName", () => {
  it("keeps a name that fits, as it is", () => {
    expect(shortName("Alex")).toBe("Alex")
    expect(shortName("a".repeat(NAME_LIMIT))).toBe("a".repeat(NAME_LIMIT))
    expect(shortName("")).toBe("")
  })

  it("limits what is drawn to the limit, the ellipsis included", () => {
    const out = shortName("abcdefghijklmnop")
    expect(out).toBe("abcdefghijk…")
    expect(Array.from(out)).toHaveLength(NAME_LIMIT)
  })

  it("cuts a name that is one character too long", () => {
    expect(shortName("a".repeat(NAME_LIMIT + 1))).toBe("a".repeat(NAME_LIMIT - 1) + "…")
  })

  it("drops the spaces before the ellipsis", () => {
    expect(shortName("Jean Baptiste Poquelin")).toBe("Jean Baptis…")
    expect(shortName("Jean-Baptiste Poquelin")).toBe("Jean-Baptis…")
    expect(shortName("Jean Pierre Dupont")).toBe("Jean Pierre…")
    expect(shortName("Hello       world and more")).toBe("Hello…")
  })

  it("counts characters, not UTF-16 units: an emoji is not cut in half", () => {
    const out = shortName("😀".repeat(20))
    expect(out).toBe("😀".repeat(NAME_LIMIT - 1) + "…")
    expect("😀".repeat(NAME_LIMIT).length).toBeGreaterThan(NAME_LIMIT)
    expect(shortName("😀".repeat(NAME_LIMIT))).toBe("😀".repeat(NAME_LIMIT))
  })

  it("keeps an accent, written composed or not, whole", () => {
    const composed = "é".repeat(NAME_LIMIT)
    const decomposed = "e\u0301".repeat(NAME_LIMIT)
    expect(shortName(composed)).toBe(composed)
    expect(shortName(decomposed)).toBe(decomposed)
    expect(shortName("e\u0301".repeat(20))).toBe("e\u0301".repeat(NAME_LIMIT - 1) + "…")
  })

  it("does not split an emoji joined from several (a family)", () => {
    const family = "👨‍👩‍👧"
    expect(shortName(family.repeat(20))).toBe(family.repeat(NAME_LIMIT - 1) + "…")
  })

  it("takes a limit", () => {
    expect(shortName("abcdef", 4)).toBe("abc…")
    expect(shortName("abcd", 4)).toBe("abcd")
  })
})
