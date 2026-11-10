import { describe, expect, it } from "vitest"
import { isEngineError, isSharedErrorCode } from "./errors"
import { cleanText, DEFAULT_TEXT_MAX, sameText, textKey } from "./writing"

const refusal = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return isEngineError(error) ? error.code : `not an engine error: ${String(error)}`
  }
  return "accepted"
}

describe("cleanText", () => {
  it("returns a plain text as it is", () => {
    expect(cleanText("elephant")).toBe("elephant")
    expect(cleanText("The cat sat on the mat")).toBe("The cat sat on the mat")
  })

  it("trims it and turns every run of spaces, tabs and odd spaces into one space", () => {
    expect(cleanText("  a   b\t\tc\u00A0\u00A0d\u3000e  ")).toBe("a b c d e")
  })

  it("composes accents, so that the same word is always the same text", () => {
    const composed = "café"
    const decomposed = "cafe\u0301"
    expect(cleanText(decomposed)).toBe(composed)
    expect(cleanText(decomposed, { max: 4 })).toBe(composed)
  })

  it("removes what cannot be shown or stored: controls, right-to-left overrides, zero-width spaces, soft hyphens and byte order marks", () => {
    expect(cleanText("a\u0000b\u0007c")).toBe("abc")
    expect(cleanText("pay\u202Epal")).toBe("paypal")
    expect(cleanText("ze\u200Bro\u2060 wi\u00ADdth\uFEFF")).toBe("zero width")
    expect(cleanText("\u2066a\u2069")).toBe("a")
  })

  it("removes lone surrogates, which jsonb would refuse, and what it returns survives a round trip through JSON", () => {
    const text = cleanText("a\uD800b\uDC00c")
    expect(text).toBe("abc")
    expect(JSON.parse(JSON.stringify(text))).toBe(text)
  })

  it("keeps the joiners that emoji and some scripts cannot do without", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"
    expect(cleanText(family)).toBe(family)
    const persian = "می\u200Cخواهم"
    expect(cleanText(persian)).toBe(persian)
  })

  it("keeps the characters of every script", () => {
    for (const text of ["éléphant", "大象", "слон", "فيل", "ह\u093Eथ\u0940", "\u{1F418}"]) {
      expect(cleanText(text)).toBe(text)
    }
  })

  it("cuts the stack of combining marks on one character at three", () => {
    expect(cleanText("x" + "\u0315".repeat(12))).toBe("x" + "\u0315".repeat(3))
  })

  it("is idempotent: cleaning a clean text changes nothing", () => {
    for (const raw of ["  e\u0301le\u0301phant ", "a\u202Eb\u200Bc", "\u{1F468}\u200D\u{1F469} x", "x" + "\u0315".repeat(9)]) {
      const once = cleanText(raw)
      expect(cleanText(once)).toBe(once)
    }
  })

  describe("lines", () => {
    it("turns line breaks into spaces by default", () => {
      expect(cleanText("one\ntwo\r\nthree\rfour\u2028five")).toBe("one two three four five")
    })

    it("keeps up to the lines the game allows, drops empty ones and tidies each", () => {
      expect(cleanText("  one  \n\n   \n two\r\nthree", { lines: 3 })).toBe("one\ntwo\nthree")
    })

    it("refuses more lines than that, instead of cutting them", () => {
      expect(refusal(() => cleanText("a\nb\nc", { lines: 2 }))).toBe("INVALID_TEXT")
      expect(cleanText("a\nb", { lines: 2 })).toBe("a\nb")
    })
  })

  describe("length", () => {
    it("allows up to the maximum and refuses beyond it, never cutting", () => {
      expect(cleanText("abcde", { max: 5 })).toBe("abcde")
      expect(refusal(() => cleanText("abcdef", { max: 5 }))).toBe("INVALID_TEXT")
    })

    it("has a default maximum", () => {
      expect(cleanText("a".repeat(DEFAULT_TEXT_MAX))).toHaveLength(DEFAULT_TEXT_MAX)
      expect(refusal(() => cleanText("a".repeat(DEFAULT_TEXT_MAX + 1)))).toBe("INVALID_TEXT")
    })

    it("counts what a reader sees as one character: an emoji sequence or a letter with its accent is one", () => {
      const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"
      expect(cleanText(family.repeat(3), { max: 3 })).toBe(family.repeat(3))
      expect(refusal(() => cleanText(family.repeat(4), { max: 3 }))).toBe("INVALID_TEXT")
      expect(cleanText("cafe\u0301", { max: 4 })).toBe("café")
    })

    it("refuses an empty text, or a text with nothing but what is removed", () => {
      for (const empty of ["", "   ", "\n\t", "\u200B\u200B", "\u0000"]) expect(refusal(() => cleanText(empty)), JSON.stringify(empty)).toBe("INVALID_TEXT")
    })

    it("allows an empty text when the game asks for none at least", () => {
      expect(cleanText("   ", { min: 0 })).toBe("")
    })

    it("refuses a text shorter than the game wants", () => {
      expect(refusal(() => cleanText("ab", { min: 3 }))).toBe("INVALID_TEXT")
      expect(cleanText("abc", { min: 3 })).toBe("abc")
    })

    it("refuses a huge text at once", () => {
      expect(refusal(() => cleanText("a".repeat(1_000_000)))).toBe("INVALID_TEXT")
    })
  })

  describe("words", () => {
    it("refuses more words than the game allows", () => {
      expect(cleanText("elephant", { words: 1 })).toBe("elephant")
      expect(cleanText("well-known", { words: 1 })).toBe("well-known")
      expect(refusal(() => cleanText("two words", { words: 1 }))).toBe("INVALID_TEXT")
      expect(cleanText("two words", { words: 2 })).toBe("two words")
    })
  })

  it("refuses what is not a text", () => {
    for (const value of [42, null, undefined, {}, [], ["a"], true, () => "a"]) {
      expect(refusal(() => cleanText(value)), String(value)).toBe("INVALID_TEXT")
    }
  })

  it("refuses with a code that is shared by every game, so that the platform words it", () => {
    expect(isSharedErrorCode("INVALID_TEXT")).toBe(true)
  })
})

describe("textKey and sameText", () => {
  it("ignores case, accents, spaces and punctuation", () => {
    expect(sameText("Éléphant!", "elephant")).toBe(true)
    expect(sameText("rock 'n' roll", "ROCKNROLL")).toBe(true)
    expect(sameText("cafe\u0301", "CAFÉ")).toBe(true)
  })

  it("reads full-width letters as the plain ones", () => {
    expect(sameText("Ａｂｃ", "abc")).toBe(true)
  })

  it("tells two different words apart", () => {
    expect(sameText("cat", "cap")).toBe(false)
    expect(sameText("chat", "chats")).toBe(false)
  })

  it("compares a text with no letter or digit as it is, and never matches two empty texts", () => {
    expect(sameText("\u{1F600}", "\u{1F600}")).toBe(true)
    expect(sameText("\u{1F600}", "\u{1F603}")).toBe(false)
    expect(sameText("", "")).toBe(false)
    expect(sameText("   ", "!!!")).toBe(false)
  })

  it("is a key a state can hold: the same for the same word", () => {
    expect(textKey("The Cat")).toBe("thecat")
    expect(textKey("the  CAT")).toBe(textKey("The Cat"))
  })
})
