import * as React from "react"
import { cn } from "../utils"

/**
 * The faces of the mix, one utility each in `styles/platform.css`: it holds the family, the weight and the size of the face, so a component
 * names none of them. The fonts themselves are loaded by the app (`apps/web/src/app/globals.css`). Changing a face is changing its utility and
 * its import; the number of faces is the length of this list.
 */
const FACES = ["letter-face-1", "letter-face-2", "letter-face-3", "letter-face-4"] as const

/** A character that stays in the parent's face: a space, a line break. */
const SPACE = /\s/u

/** mulberry32: a small generator that a seed always sends down the same road, so the server and the browser deal the same faces. */
function generator(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** Every face once, in a random order. */
function shuffled(faces: number, random: () => number): number[] {
  return Array.from({ length: faces }, (_, face) => ({ face, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ face }) => face)
}

/**
 * The faces of `length` letters in a row, dealt like a deck: a shuffled bag of every face, used up one letter at a time, then a new bag.
 * So every face comes once in each run of four letters, a face never comes twice in a row, and the order still looks random.
 */
function deal(length: number, faces: number, seed: number): number[] {
  if (!(faces >= 1)) throw new RangeError("A mix needs at least one face")
  const random = generator(seed)
  const dealt: number[] = []
  while (dealt.length < length) {
    const bag = shuffled(faces, random)
    // A new bag may not open with the face the last one closed on, or two neighbours would share a face
    if (bag.length > 1 && bag[0] === dealt.at(-1)) bag.push(...bag.splice(0, 1))
    dealt.push(...bag)
  }
  return dealt.slice(0, length)
}

/** One character of a text, and the face it takes (`null` for a space, which has none). */
type Letter = { char: string; face: number | null }

/** The characters of `text`, each with its face from 0 to `faces - 1`: the deal runs over the letters, spaces left out. */
function dealLetters(text: string, faces: number, seed: number): Letter[] {
  const chars = Array.from(text)
  const dealt = deal(chars.filter((char) => !SPACE.test(char)).length, faces, seed)
  let next = 0
  return chars.map((char) => ({ char, face: SPACE.test(char) ? null : dealt[next++] }))
}

/**
 * A text in capitals with every letter in one of the platform's display faces, dealt in a random-looking order that is the same on every render:
 * for the title of a page, never for a text to read or a label. The faces differ in shape, weight and width, and the narrowest, a script, is
 * hard to read small, so it is for sizes from `text-3xl` up. The line-height does not change with the faces (each letter has none of its own):
 * the lines of the title keep the height of the element's own.
 *
 * It adds a plain inline `<span>` around each letter and nothing else, and the capitals are CSS (`letter-mix`), so the text stays one string,
 * written as it is, for a screen reader, a search engine and a copy. Give `seed` another number to deal another order, for two lines that must
 * not start the same way.
 */
function LetterMix({
  children,
  seed = 1,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  /** The text to set. A string: each of its characters gets a face of its own. */
  children: string
  /** The same number always deals the same order of faces. */
  seed?: number
}) {
  return (
    <span data-slot="letter-mix" className={cn("letter-mix", className)} {...props}>
      {dealLetters(children, FACES.length, seed).map(({ char, face }, index) =>
        face === null ? (
          char
        ) : (
          <span key={index} className={FACES[face]}>
            {char}
          </span>
        )
      )}
    </span>
  )
}

export { LetterMix, dealLetters, FACES }
