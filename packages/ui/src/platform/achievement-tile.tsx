import * as React from "react"
import { Award01Icon, CrownIcon, FlashIcon, StarIcon, Target01Icon, TrophyIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { badgeOf } from "../achievements"

// An achievement a visitor earned, as a badge: an emblem drawn in SVG, then its name, then the day it was earned. It is no card, no outline and no fill around it: the emblem is what stands out, and the badges of a profile or of a game's stats go in
// a grid, which sizes the room of each. A game does not give art for its achievements yet, so the emblem is drawn from the text that stands for the achievement (`badgeOf` of `../achievements`, its id): one of five shapes, in the `muted`
// fill, with a hairline, a dotted ring inside and one of six marks in the middle, the same every time and not the same for every achievement. The platform has no colour to give a medal, and its only hue is a game's art. What the
// achievement was for is the pointer's title and a screen reader's line.

/** The marks of the badges, drawn in the middle of the shape: an award, a trophy, a star, a crown, a target and a flash (`BADGE_MARKS`). */
const MARKS = [Award01Icon, TrophyIcon, StarIcon, CrownIcon, Target01Icon, FlashIcon]

/** The corners of a regular polygon in the 96 × 96 box of a badge, the first one at `from` degrees. */
function polygon(sides: number, radius: number, from: number): string {
  const corners = Array.from({ length: sides }, (_, index) => {
    const angle = ((from + (360 / sides) * index) * Math.PI) / 180
    return `${index === 0 ? "M" : "L"}${(48 + radius * Math.cos(angle)).toFixed(2)} ${(48 + radius * Math.sin(angle)).toFixed(2)}`
  })
  return `${corners.join(" ")}Z`
}

/** A circle with a scalloped edge, like a seal: `bumps` of them, `depth` deep. */
function seal(bumps: number, radius: number, depth: number): string {
  const steps = bumps * 8
  const points = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    const reach = radius + depth * Math.cos(bumps * angle)
    return `${index === 0 ? "M" : "L"}${(48 + reach * Math.cos(angle)).toFixed(2)} ${(48 + reach * Math.sin(angle)).toFixed(2)}`
  })
  return `${points.join(" ")}Z`
}

/** The shapes of the badges (`BADGE_SHAPES`): a hexagon, a shield, a seal, a diamond and an octagon. */
const SHAPES = [polygon(6, 45, -90), "M48 4 L83 16 V46 C83 69 68 84 48 92 C28 84 13 69 13 46 V16 Z", seal(12, 41, 3), polygon(4, 46, -90), polygon(8, 45, -22.5)]

/** The emblem alone: `seed` is the text it is drawn from. It is decorative (the name and the day say what it is), and 6rem wide unless it is given another size. */
function AchievementBadge({ seed, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { seed: string }) {
  const { shape, mark } = badgeOf(seed)
  const outline = SHAPES[shape]!
  return (
    <span data-slot="achievement-badge" aria-hidden="true" className={cn("relative flex size-24 shrink-0 items-center justify-center", className)} {...props}>
      <svg viewBox="0 0 96 96" className="absolute inset-0 size-full">
        <path d={outline} strokeWidth="1.5" strokeLinejoin="round" className="fill-muted stroke-foreground/15" />
        <path
          d={outline}
          transform="translate(48 48) scale(.8) translate(-48 -48)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="1.5 3.5"
          className="fill-foreground/5 stroke-foreground/30"
        />
      </svg>
      <HugeiconsIcon icon={MARKS[mark]!} strokeWidth={1.75} className="relative size-9" />
    </span>
  )
}

type AchievementTileProps = Omit<React.ComponentProps<"div">, "children" | "title"> & {
  /** What the achievement is called. */
  name: string
  /** The day it was earned, already written ("26 Oct"). */
  date: string
  /** What it was for ("Play 20 games."). */
  description?: string
  /** The text the emblem is drawn from: the achievement's id, so that it keeps its badge. The name when there is none. */
  badge?: string
}

function AchievementTile({ className, name, date, description, badge, ...props }: AchievementTileProps) {
  return (
    <div data-slot="achievement-tile" title={description ? `${name}: ${description}` : name} className={cn("flex min-w-0 flex-col items-center gap-1 text-center", className)} {...props}>
      <AchievementBadge seed={badge ?? name} />
      <span className="mt-2 w-full truncate text-sm">{name}</span>
      <span className="text-xs text-muted-foreground">{date}</span>
      {description && <span className="sr-only">{description}</span>}
    </div>
  )
}

export { AchievementBadge, AchievementTile }
export type { AchievementTileProps }
