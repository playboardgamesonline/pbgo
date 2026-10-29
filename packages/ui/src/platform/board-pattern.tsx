import * as React from "react"
import type { HugeiconsIcon } from "@hugeicons/react"
import {
  Cards01Icon,
  ChessPawnIcon,
  ClubsIcon,
  Crown02Icon,
  DiceFaces05Icon,
  GemIcon,
  HourglassIcon,
  JokerIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "../utils"

// A backdrop of game pieces drawn in a line (dice, cards, a pawn, a crown, a suit, an hourglass, a gem, a joker), tilted this way and that and spread
// like the doodles of a wallpaper, to lay behind the top of a page and give it some life: the hub's hero. It is one SVG pattern, a tile that repeats,
// so it is as light as a picture and as wide as its parent. It draws in `currentColor` at full strength: the page makes that `foreground` and fades the
// whole drawing with `opacity`, not the colour, so that strokes that cross do not add up, and a mask lets it fade out where the page moves on. It is
// decorative: `aria-hidden`, and it takes no click.

type Icon = React.ComponentProps<typeof HugeiconsIcon>["icon"]

/** The side of the tile that repeats, in pixels. */
const TILE = 240

/** One piece of the tile: its icon, the centre it is drawn around, its tilt in degrees and its size in pixels (the icons are drawn on a 24 grid). */
const PIECES: readonly { icon: Icon; x: number; y: number; turn: number; size: number }[] = [
  { icon: DiceFaces05Icon, x: 34, y: 40, turn: -14, size: 38 },
  { icon: ChessPawnIcon, x: 128, y: 28, turn: 10, size: 36 },
  { icon: Cards01Icon, x: 208, y: 80, turn: 16, size: 38 },
  { icon: Crown02Icon, x: 82, y: 104, turn: -8, size: 36 },
  { icon: HourglassIcon, x: 168, y: 152, turn: -12, size: 34 },
  { icon: ClubsIcon, x: 28, y: 170, turn: 18, size: 32 },
  { icon: GemIcon, x: 106, y: 196, turn: 8, size: 34 },
  { icon: JokerIcon, x: 214, y: 218, turn: -16, size: 36 },
]

/** The game pieces as a repeating backdrop, as wide and as high as the parent that gives it a size. Colour it with a text colour, make it faint with `opacity`, fade it out with a mask. */
function BoardPattern({ className, ...props }: Omit<React.ComponentProps<"svg">, "children" | "aria-hidden">) {
  const id = React.useId()
  return (
    <svg data-slot="board-pattern" aria-hidden="true" className={cn("pointer-events-none block size-full select-none", className)} {...props}>
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          {PIECES.map(({ icon, x, y, turn, size }) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${turn}) scale(${size / 24}) translate(-12 -12)`} fill="none">
              {icon.map(([tag, attributes]) => React.createElement(tag, attributes))}
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

export { BoardPattern }
