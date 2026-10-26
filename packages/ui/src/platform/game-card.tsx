import * as React from "react"
import { cn } from "../utils"
import { Badge } from "./badge"

import { HugeiconsIcon } from "@hugeicons/react"
import { HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"

type GameCardVisualProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** URL of the game's logo (or icon), contained and centered in the frame. */
  logo?: string
  /** URL of the game's background picture: it fills the frame behind the logo. Without one the frame is the plain grey. */
  background?: string
  /** `lazy` (default): a picture further down the page. `eager`: the one a page opens on. */
  loading?: "lazy" | "eager"
}

type GameCardProps = Omit<React.ComponentProps<"a">, "children"> & {
  /** The game's page: the card is a link to it. */
  href: string
  name: string
  /** URL of the game's logo (or icon), contained and centered in the frame. */
  logo?: string
  /** URL of the game's background picture: it fills the frame behind the logo. Without one the frame is the plain grey. */
  background?: string
  /** `play` (default): a game to play. `soon`: a game to come, under a "Coming soon" badge. */
  variant?: "play" | "soon"
  /** Already formatted, e.g. "2–5 players": the card does not know the visitor's language. */
  players?: string
  /** Already formatted, e.g. "30 min". */
  duration?: string
}

// What both pictures of the frame share: they zoom together when the card they are in is hovered (outside a card they stay still)
const PICTURE = "size-full transition-transform duration-slow ease-standard group-hover/game-card:scale-103"

/**
 * The picture of a game: its logo, contained and centered, over its background picture when it has one, on a grey 4:3 frame. It is
 * the top of a `GameCard` and the picture of a game's page on the hub, so that both show a game the same way.
 * The one layer it lays over the art is a scrim (`bg-scrim`, lighter than a dialog's) between the background and the logo, so that
 * the picture is darker and the logo stands out; a frame with no background has no scrim. A game without a picture leaves the frame
 * plain, no placeholder. `className` shapes the frame (rounding, ring, place in a grid).
 */
function GameCardVisual({ className, logo, background, loading = "lazy", ...props }: GameCardVisualProps) {
  return (
    <div data-slot="game-card-visual" className={cn("relative aspect-4/3 overflow-hidden bg-muted", className)} {...props}>
      {/* Plain <img>s: the package is framework-free and the art is a URL from the game's Sanity project (or, for a game to come, from the catalog's picture route).
          The background comes first, then its scrim, so that the logo is drawn over both; the logo is contained, not cropped.
          The scrim stays still when the pictures zoom; `bg-scrim/70` is the platform's scrim (60% black) at 70%, about 40% black */}
      {background && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={background} alt="" loading={loading} decoding="async" className={cn("absolute inset-0 object-cover", PICTURE)} />
          <div data-slot="game-card-scrim" className="absolute inset-0 bg-scrim/70" />
        </>
      )}
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading={loading} decoding="async" className={cn("relative object-contain p-8", PICTURE)} />
      )}
    </div>
  )
}

/**
 * The hub's game tile: the game's picture (`GameCardVisual`: its logo over its background), then the name, on one line and cut with
 * an ellipsis when it does not fit, and the practical facts (players, duration), nothing else. Game art is the only colour of the
 * platform, so the card adds none: no accent.
 * It is a plain link: the package is framework-free, and the card's target is a page the visitor loads whole.
 * `variant="soon"` is the tile of a game that is not playable yet, listed with the others: the same frame and the same facts, and a
 * small "Coming soon" badge at the top right.
 */
function GameCard({
  className,
  name,
  logo,
  background,
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
      <GameCardVisual logo={logo} background={background} />
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
