import * as React from "react"
import { cn } from "../utils"
import { Badge } from "./badge"

import { HugeiconsIcon } from "@hugeicons/react"
import { HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"

type GameCardVisualProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** URL of a picture that fills the frame, cropped to it (the game's cover, or its background): nothing is laid over it, so a `logo` given with it is not drawn. */
  picture?: string
  /** URL of the game's logo (or icon), contained and centered on the plain frame: for a game with no `picture`. */
  logo?: string
  /** `lazy` (default): a picture further down the page. `eager`: the one a page opens on. */
  loading?: "lazy" | "eager"
}

type GameCardProps = Omit<React.ComponentProps<"a">, "children"> & {
  /** The game's page: the card is a link to it. */
  href: string
  name: string
  /** URL of a picture that fills the frame, cropped to it (the game's cover, or its background): nothing is laid over it, so a `logo` given with it is not drawn. */
  picture?: string
  /** URL of the game's logo (or icon), contained and centered on the plain frame: for a game with no `picture`. */
  logo?: string
  /** `play` (default): a game to play. `soon`: a game to come, under a "Coming soon" badge. */
  variant?: "play" | "soon"
  /** Already formatted, e.g. "2–5 players": the card does not know the visitor's language. */
  players?: string
  /** Already formatted, e.g. "30 min". */
  duration?: string
}

// What the frame's one picture, whichever it is, does when the card it is in is hovered: it zooms (outside a card it stays still)
const PICTURE = "size-full transition-transform duration-slow ease-standard group-hover/game-card:scale-103"

/**
 * The picture of a game on a grey 4:3 frame: either a `picture` that fills it (a cover, or a background) or, for a game that has none, its
 * `logo`, contained and centered on the plain frame. Never both: a picture has nothing laid over it, no logo, scrim or tint, and a `picture`
 * wins over a `logo`. A game with neither leaves the frame plain, no placeholder. The card draws what it is given and chooses nothing: the hub
 * does (`gamePicture`, `apps/web/src/lib/game-card-props.ts`). It is the top of a `GameCard`; `className` shapes the frame (rounding, ring,
 * place in a grid).
 */
function GameCardVisual({ className, picture, logo, loading = "lazy", ...props }: GameCardVisualProps) {
  return (
    <div data-slot="game-card-visual" className={cn("relative aspect-4/3 overflow-hidden bg-muted", className)} {...props}>
      {/* Plain <img>s: the package is framework-free and the art is a URL, which the hub takes from the image CDN of the platform's Sanity project (`@pbgo/catalog`).
          The picture fills the frame and is cropped to it; the logo is contained, not cropped */}
      {picture && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" loading={loading} decoding="async" className={cn("absolute inset-0 object-cover", PICTURE)} />
      )}
      {!picture && logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading={loading} decoding="async" className={cn("relative object-contain p-12", PICTURE)} />
      )}
    </div>
  )
}

/**
 * The hub's game tile: the game's picture (`GameCardVisual`: a picture that fills the frame, or a logo on the plain frame), then the name, on
 * one line and cut with an ellipsis when it does not fit, and the practical facts (players, duration), nothing else. Game art is the only colour of the
 * platform, so the card adds none: no accent. Its corners are a surface's (`rounded-4xl`): only the picture of a person is round.
 * It is a plain link: the package is framework-free, and the card's target is a page the visitor loads whole.
 * `variant="soon"` is the tile of a game that is not playable yet, listed with the others: the same frame and the same facts, and a
 * small "Coming soon" badge at the top right.
 */
function GameCard({
  className,
  name,
  picture,
  logo,
  variant = "play",
  players,
  duration,
  ...props
}: GameCardProps) {
  const soon = variant === "soon"
  return (
    <a
      data-slot="game-card"
      data-variant={variant}
      className={cn(
        "group/game-card relative flex flex-col overflow-hidden rounded-4xl bg-card text-card-foreground shadow-surface ring-1 ring-foreground/10 transition-[box-shadow,background-color] outline-none hover:bg-secondary hover:shadow-float hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      {...props}
    >
      <GameCardVisual picture={picture} logo={logo} />
      <div data-slot="game-card-body" className="flex flex-1 flex-col gap-2 p-5">
        <h3 data-slot="game-card-title" className="truncate font-heading text-lg">
          {name}
        </h3>
        {(players || duration) && (
          <div
            data-slot="game-card-facts"
            className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
          >
            {players && (
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-4" />
                {players}
              </span>
            )}
            {duration && (
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={HourglassIcon} strokeWidth={2} className="size-4" />
                {duration}
              </span>
            )}
          </div>
        )}
      </div>
      {/* After the name in the document, so that the link reads "<name>, Coming soon"; the badge is placed over the corner of the frame,
          on a `background` fill since a `secondary` one is the frame's own grey */}
      {soon && (
        <Badge variant="outline" data-slot="game-card-badge" className="absolute top-3 right-3 bg-background">
          Coming soon
        </Badge>
      )}
    </a>
  )
}

export { GameCard, GameCardVisual }
export type { GameCardProps, GameCardVisualProps }
