import * as React from "react"
import { cn } from "../utils"

import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, DiceIcon, UserGroupIcon } from "@hugeicons/core-free-icons"

type GameCardProps = Omit<React.ComponentProps<"a">, "children"> & {
  href: string
  name: string
  tagline?: string
  /** URL of the cover art. Without one, the card shows a neutral placeholder. */
  visual?: string
  /** Already formatted, e.g. "2–5 players": the card does not know the visitor's language. */
  players?: string
  /** Already formatted, e.g. "30 min". */
  duration?: string
}

/**
 * The hub's game tile: a big visual, the name, the tagline and the practical facts (players, duration).
 * Game art is the only colour of the platform, so the card adds none: no scrim over the visual, no accent.
 * It is a plain link (full page load): the hub and the games have separate root layouts.
 */
function GameCard({
  className,
  name,
  tagline,
  visual,
  players,
  duration,
  ...props
}: GameCardProps) {
  return (
    <a
      data-slot="game-card"
      className={cn(
        "group/game-card flex flex-col overflow-hidden rounded-4xl bg-card text-card-foreground shadow-surface ring-1 ring-foreground/10 transition-[box-shadow,background-color] outline-none hover:bg-secondary hover:shadow-float hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      {...props}
    >
      <div
        data-slot="game-card-visual"
        className="relative aspect-4/3 overflow-hidden bg-muted"
      >
        {visual ? (
          // A plain <img>: the package is framework-free and the art is a static file of the game's public folder.
          // `object-top` keeps the top of a tall cut-out (a crown, a face) when the 4:3 frame crops it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visual}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top transition-transform duration-slow ease-standard group-hover/game-card:scale-103"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <HugeiconsIcon icon={DiceIcon} strokeWidth={1.5} className="size-10" />
          </div>
        )}
      </div>
      <div data-slot="game-card-body" className="flex flex-1 flex-col gap-1 p-5 pb-4">
        <h3 data-slot="game-card-title" className="font-heading text-lg">
          {name}
        </h3>
        {tagline && (
          <p data-slot="game-card-tagline" className="text-sm text-pretty text-muted-foreground">
            {tagline}
          </p>
        )}
      </div>
      {(players || duration) && (
        <div
          data-slot="game-card-facts"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-5 text-sm text-muted-foreground"
        >
          {players && (
            <span className="inline-flex items-center gap-1.5">
              <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
              {players}
            </span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1.5">
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4" />
              {duration}
            </span>
          )}
        </div>
      )}
    </a>
  )
}

export { GameCard }
export type { GameCardProps }
