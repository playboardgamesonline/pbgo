import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FACES, LetterMix, dealLetters } from "./platform/letter-mix"

/**
 * `LetterMix` deals one face to every letter of a title. What the page relies on is tested here: the deal is the same on the server and in
 * the browser (or the page would not hydrate as it was rendered), no two neighbours share a face, and the text stays one string.
 */

const TITLE = "Play board games with friends & rivals"
const LETTERS = TITLE.replace(/\s/g, "").length

/** The faces of the letters of `text`, in order, spaces left out. */
function facesOf(text: string, faces: number, seed: number): number[] {
  return dealLetters(text, faces, seed).flatMap(({ face }) => (face === null ? [] : [face]))
}

describe("dealLetters", () => {
  it("gives the characters back, in order", () => {
    expect(
      dealLetters(TITLE, FACES.length, 1)
        .map(({ char }) => char)
        .join("")
    ).toBe(TITLE)
  })

  it("gives a space no face and every other character one of the faces", () => {
    for (const { char, face } of dealLetters(TITLE, FACES.length, 1)) {
      if (/\s/.test(char)) expect(face).toBeNull()
      else expect(FACES.map((_, index) => index)).toContain(face)
    }
  })

  it("keeps the spaces where they are: several in a row, a line break, a tab", () => {
    const dealt = dealLetters("a  b\n\tc", FACES.length, 1)
    expect(dealt.map(({ face }) => face === null)).toEqual([false, true, true, false, true, true, false])
  })

  it("deals the same faces to the same seed, and other faces to another", () => {
    expect(facesOf(TITLE, FACES.length, 7)).toEqual(facesOf(TITLE, FACES.length, 7))
    const deals = new Set(Array.from({ length: 20 }, (_, seed) => facesOf(TITLE, FACES.length, seed).join("")))
    expect(deals.size).toBe(20)
  })

  it("never deals a face twice in a row, whatever the seed", () => {
    for (let seed = 0; seed < 200; seed++) {
      const faces = facesOf(TITLE, FACES.length, seed)
      expect(faces.filter((face, index) => index > 0 && face === faces[index - 1])).toEqual([])
    }
  })

  it("deals every face once in each run of four letters", () => {
    const faces = facesOf(TITLE.repeat(5), FACES.length, 3)
    for (let start = 0; start + FACES.length <= faces.length; start += FACES.length) {
      expect(faces.slice(start, start + FACES.length).sort()).toEqual(FACES.map((_, index) => index))
    }
  })

  it("deals the only face there is to every letter", () => {
    expect(new Set(facesOf(TITLE, 1, 1))).toEqual(new Set([0]))
  })

  it("needs a face", () => {
    expect(() => dealLetters(TITLE, 0, 1)).toThrow(RangeError)
  })

  it("deals nothing to an empty text", () => {
    expect(dealLetters("", FACES.length, 1)).toEqual([])
  })
})

describe("LetterMix", () => {
  const render = () => renderToStaticMarkup(createElement(LetterMix, { className: "block", "aria-hidden": true, children: TITLE }))
  const html = render()

  it("keeps the text as one string: nothing but the letters, in order, once", () => {
    // The markup escapes the ampersand; the text a reader gets is the title
    expect(html.replace(/<[^>]*>/g, "")).toBe(TITLE.replaceAll("&", "&amp;"))
  })

  it("wraps each letter in a span of one of the faces, and nothing else", () => {
    const spans = [...html.matchAll(/<span class="(letter-face-\d)">([^<]+)<\/span>/g)]
    expect(spans).toHaveLength(LETTERS)
    expect(new Set(spans.map(([, face]) => face))).toEqual(new Set(FACES))
    // The spaces stay plain text between the words
    expect(html).toContain("</span> <span")
  })

  it("sets its class beside the caller's on the element around the letters, and passes the other props", () => {
    expect(html.startsWith('<span data-slot="letter-mix" class="letter-mix block" aria-hidden="true">')).toBe(true)
  })

  it("deals the same markup twice", () => {
    expect(render()).toBe(html)
  })
})
