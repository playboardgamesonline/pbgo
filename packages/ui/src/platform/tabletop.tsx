import * as React from "react"
import { cn } from "../utils"
import { Suit, type SuitName } from "./suits"

// The backdrop of a hero: a table of board games seen from above at a low angle, in perspective, under a lamp, with what is played on it lying and standing on it: dice, playing cards, chips and meeples. It is all CSS
// and a few inline SVGs (the utility `tabletop` of `styles/platform.css` draws the table, the lamp and every piece from the `data-` attributes set here), so it is made of no image, it is decorative (`aria-hidden`)
// and it takes no click. The colours are those of a game table (`--wood-*`, `--piece-*`), the hero's alone, and the title and the search bar keep the page over them. Where a piece lies is a place on the table, in
// percent of it (`x` from its left, `y` from its far end, so a bigger `y` is nearer the eye and a piece there is bigger); how big it is, how it is turned and what it is made of are its own.

type Tone = "red" | "gold" | "teal" | "navy"

/** A custom property of the table, which the CSS reads: a number or a length, never a colour. */
type Place = React.CSSProperties & Record<`--${string}`, string | number | undefined>

const DICE: readonly { x: number; y: number; size: number; yaw: number; top: number; tone?: "red" | "teal" | "gold"; farther?: boolean }[] = [
  { x: 25.4, y: 75, size: 84, yaw: 16, top: 5 },
  { x: 30.8, y: 83, size: 70, yaw: -28, top: 3, tone: "red" },
  { x: 74.4, y: 64, size: 76, yaw: 32, top: 6, tone: "teal", farther: true },
  { x: 79.5, y: 52, size: 54, yaw: -18, top: 4, tone: "gold", farther: true },
]

type CardSpec = { x: number; y: number; w: number; rot: number; z: number; face?: { rank: string; suit: SuitName }; tone?: Tone; farther?: boolean }

const CARDS: readonly CardSpec[] = [
  { x: 21, y: 55, w: 70, rot: -16, z: 1, face: { rank: "K", suit: "spade" }, farther: true },
  { x: 81.5, y: 38, w: 62, rot: 13, z: 1, tone: "navy", farther: true },
  // The fan on the right: a card face down, then three face up
  { x: 67.6, y: 78, w: 92, rot: -34, z: 1 },
  { x: 69.2, y: 78, w: 92, rot: -14, z: 2, face: { rank: "A", suit: "heart" } },
  { x: 71, y: 78, w: 92, rot: 8, z: 3, face: { rank: "Q", suit: "spade" } },
  { x: 72.8, y: 79, w: 92, rot: 27, z: 4, face: { rank: "7", suit: "diamond" } },
]

const CHIPS: readonly { x: number; y: number; size: number; n: number; tone: Tone }[] = [
  { x: 21.8, y: 85, size: 64, n: 4, tone: "gold" },
  { x: 25.8, y: 91, size: 58, n: 2, tone: "red" },
  { x: 68.4, y: 90, size: 62, n: 4, tone: "teal" },
  { x: 73, y: 92, size: 56, n: 2, tone: "navy" },
]

const MEEPLES: readonly { x: number; y: number; size: number; tone: "red" | "gold" | "teal" }[] = [
  { x: 13, y: 44, size: 58, tone: "teal" },
  { x: 27.2, y: 63, size: 84, tone: "red" },
  { x: 66.6, y: 66, size: 82, tone: "gold" },
]

const MEEPLE = "M50 6a15 15 0 1 0 .01 0ZM50 38c-10 0-17 4-21 10L9 54c-5 2-5 8 0 10l20 2-7 24h19l9-14 9 14h19l-7-24 20-2c5-2 5-8 0-10l-20-6c-4-6-11-10-21-10Z"

/** The faces of a die for the number that is on top: opposite faces make seven, as on a real one. */
function facesOf(top: number) {
  const rest = [1, 2, 3, 4, 5, 6].filter((n) => n !== top && n !== 7 - top)
  const front = rest[0]
  const right = rest.find((n) => n !== front && n !== 7 - front) ?? 3
  return { top, bottom: 7 - top, front, back: 7 - front, right, left: 7 - right }
}

function Die({ x, y, size, yaw, top, tone, farther }: (typeof DICE)[number]) {
  const faces = facesOf(top)
  const place: Place = { "--x": `${x}%`, "--y": `${y}%`, "--s": size, "--yaw": `${yaw}deg` }
  return (
    <div data-piece="die" data-tone={tone} data-farther={farther ? "" : undefined} style={place}>
      <b data-slot="shadow" />
      {(Object.keys(faces) as (keyof typeof faces)[]).map((face) => (
        <i key={face} data-face={face} data-pips={faces[face]} className="die-pips" />
      ))}
    </div>
  )
}

function PlayingCard({ x, y, w, rot, z, face, tone, farther }: CardSpec) {
  const place: Place = { "--x": `${x}%`, "--y": `${y}%`, "--w": w, "--rot": `${rot}deg`, "--z": z, "--shows": face ? "0deg" : "180deg" }
  return (
    <div data-piece="card" data-tone={tone} data-farther={farther ? "" : undefined} style={place}>
      <div data-slot="card-body">
        {face ? (
          <div data-side="face" data-suit={face.suit}>
            <span data-slot="rank">
              {face.rank}
              <Suit suit={face.suit} />
            </span>
            <Suit suit={face.suit} data-slot="pip" />
          </div>
        ) : (
          <div data-side="back" />
        )}
      </div>
    </div>
  )
}

function ChipStack({ x, y, size, n, tone }: (typeof CHIPS)[number]) {
  const place: Place = { "--x": `${x}%`, "--y": `${y}%`, "--s": size }
  return (
    <div data-piece="chips" data-tone={tone} style={place}>
      <b data-slot="shadow" />
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ "--i": i } as Place} />
      ))}
    </div>
  )
}

function Meeple({ x, y, size, tone }: (typeof MEEPLES)[number]) {
  const place: Place = { "--x": `${x}%`, "--y": `${y}%`, "--s": size }
  return (
    <div data-piece="meeple" data-tone={tone} style={place}>
      <b data-slot="shadow" />
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d={MEEPLE} />
      </svg>
    </div>
  )
}

/**
 * The table under the lamp, as wide and as high as the parent that gives it a size: a layer that is `absolute inset-0`, to lay in a `relative` section whose content is `relative` too, so the content paints over it.
 * It fades out at its foot, where the black of the page takes over. The pieces are where the title, the figures and the search bar are not: the dice, the meeples and the chips on the left, a fan of cards on the right,
 * and a few farther away, which are smaller. On a phone they are smaller too (`--tabletop-unit`), and the farther ones and the meeples, which would stand behind the text, are left out. Nothing moves.
 */
function Tabletop({ className, ...props }: Omit<React.ComponentProps<"div">, "children" | "aria-hidden">) {
  return (
    <div data-slot="tabletop" aria-hidden="true" className={cn("tabletop", className)} {...props}>
      <div data-slot="tabletop-light" />
      <div data-slot="tabletop-stage">
        <div data-slot="tabletop-plane">
          <div data-slot="tabletop-wood" />
          {MEEPLES.map((meeple) => (
            <Meeple key={`${meeple.x}-${meeple.y}`} {...meeple} />
          ))}
          {CHIPS.map((chips) => (
            <ChipStack key={`${chips.x}-${chips.y}`} {...chips} />
          ))}
          {DICE.map((die) => (
            <Die key={`${die.x}-${die.y}`} {...die} />
          ))}
          {CARDS.map((card) => (
            <PlayingCard key={`${card.x}-${card.y}-${card.z}`} {...card} />
          ))}
        </div>
      </div>
      <div data-slot="tabletop-shade" />
    </div>
  )
}

export { Tabletop }
