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

const DICE: readonly { x: number; u: number; size: number; yaw: number; top: number; tone?: "red" | "teal" | "gold"; farther?: boolean }[] = [
  { x: 27.1, u: 400, size: 50, yaw: 16, top: 5 },
  { x: 33, u: 290, size: 42, yaw: -28, top: 3, tone: "red" },
  { x: 18.5, u: 900, size: 40, yaw: 32, top: 6, tone: "teal", farther: true },
  { x: 74.6, u: 420, size: 46, yaw: -22, top: 4, tone: "teal", farther: true },
  { x: 82.1, u: 850, size: 36, yaw: 28, top: 2, tone: "gold", farther: true },
]

type CardSpec = { x: number; u: number; w: number; rot: number; z: number; face?: { rank: string; suit: SuitName }; farther?: boolean }

const CARDS: readonly CardSpec[] = [
  { x: 19.9, u: 620, w: 80, rot: -16, z: 1, face: { rank: "K", suit: "spade" }, farther: true },
  { x: 81.6, u: 700, w: 74, rot: 13, z: 1, farther: true },
  // The fan on the right: a card face down, then three face up
  { x: 70, u: 340, w: 100, rot: -34, z: 1 },
  { x: 71.6, u: 340, w: 100, rot: -14, z: 2, face: { rank: "A", suit: "heart" } },
  { x: 73.4, u: 340, w: 100, rot: 8, z: 3, face: { rank: "Q", suit: "spade" } },
  { x: 75.2, u: 325, w: 100, rot: 27, z: 4, face: { rank: "7", suit: "diamond" } },
]

const CHIPS: readonly { x: number; u: number; size: number; n: number; tone: Tone; farther?: boolean }[] = [
  { x: 24, u: 360, size: 64, n: 5, tone: "gold" },
  { x: 31.3, u: 250, size: 62, n: 3, tone: "red" },
  { x: 70.8, u: 290, size: 62, n: 5, tone: "teal" },
  { x: 73.7, u: 240, size: 60, n: 3, tone: "navy" },
  { x: 10.2, u: 1100, size: 64, n: 4, tone: "gold", farther: true },
  { x: 89, u: 1050, size: 62, n: 4, tone: "red", farther: true },
]

const MEEPLES: readonly { x: number; u: number; size: number; tone: "red" | "gold" | "teal"; farther?: boolean }[] = [
  { x: 23.1, u: 560, size: 60, tone: "red", farther: true },
  { x: 79.6, u: 560, size: 58, tone: "gold", farther: true },
]

/** The plane is 6000px deep: a piece is `u` px from its near edge, and that is a place from the top of the plane of `100 - u / 60` percent. */
const PLANE_DEPTH = 6000
const deep = (u: number) => 100 - (u / PLANE_DEPTH) * 100

const MEEPLE = "M50 6a15 15 0 1 0 .01 0ZM50 38c-10 0-17 4-21 10L9 54c-5 2-5 8 0 10l20 2-7 24h19l9-14 9 14h19l-7-24 20-2c5-2 5-8 0-10l-20-6c-4-6-11-10-21-10Z"

/** The faces of a die for the number that is on top: opposite faces make seven, as on a real one. */
function facesOf(top: number) {
  const rest = [1, 2, 3, 4, 5, 6].filter((n) => n !== top && n !== 7 - top)
  const front = rest[0]
  const right = rest.find((n) => n !== front && n !== 7 - front) ?? 3
  return { top, bottom: 7 - top, front, back: 7 - front, right, left: 7 - right }
}

function Die({ x, u, size, yaw, top, tone, farther }: (typeof DICE)[number]) {
  const faces = facesOf(top)
  const place: Place = { "--x": `${x}%`, "--y": `${deep(u)}%`, "--s": size, "--yaw": `${yaw}deg` }
  return (
    <div data-piece="die" data-tone={tone} data-farther={farther ? "" : undefined} style={place}>
      <b data-slot="shadow" />
      {(Object.keys(faces) as (keyof typeof faces)[]).map((face) => (
        <i key={face} data-face={face} data-pips={faces[face]} className="die-pips" />
      ))}
    </div>
  )
}

function PlayingCard({ x, u, w, rot, z, face, farther }: CardSpec) {
  const place: Place = { "--x": `${x}%`, "--y": `${deep(u)}%`, "--w": w, "--rot": `${rot}deg`, "--z": z, "--shows": face ? "0deg" : "180deg" }
  return (
    <div data-piece="card" data-farther={farther ? "" : undefined} style={place}>
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

function ChipStack({ x, u, size, n, tone, farther }: (typeof CHIPS)[number]) {
  const place: Place = { "--x": `${x}%`, "--y": `${deep(u)}%`, "--s": size }
  return (
    <div data-piece="chips" data-tone={tone} data-farther={farther ? "" : undefined} style={place}>
      <b data-slot="shadow" />
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ "--i": i } as Place} />
      ))}
    </div>
  )
}

function Meeple({ x, u, size, tone, farther }: (typeof MEEPLES)[number]) {
  const place: Place = { "--x": `${x}%`, "--y": `${deep(u)}%`, "--s": size }
  return (
    <div data-piece="meeple" data-tone={tone} data-farther={farther ? "" : undefined} style={place}>
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
            <Meeple key={`${meeple.x}-${meeple.u}`} {...meeple} />
          ))}
          {CHIPS.map((chips) => (
            <ChipStack key={`${chips.x}-${chips.u}`} {...chips} />
          ))}
          {DICE.map((die) => (
            <Die key={`${die.x}-${die.u}`} {...die} />
          ))}
          {CARDS.map((card) => (
            <PlayingCard key={`${card.x}-${card.u}-${card.z}`} {...card} />
          ))}
        </div>
      </div>
      <div data-slot="tabletop-shade" />
    </div>
  )
}

export { Tabletop }
