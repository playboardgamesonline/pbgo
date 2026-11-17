"use client"

import * as React from "react"
import { Add01Icon, Alert02Icon, Cancel01Icon, Settings02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Rank } from "../ranks"
import { cn } from "../utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card"
import { RankBadge } from "./rank-badge"
import { RankEmblem } from "./rank-emblem"

// The games of a search or of a table that is about to be opened (the play zone of the signed-in home), as a visitor sets them: the games that are in it, each a tile with a cross that takes it out. A search may hold one game or ten, so the tiles are plain and the page sizes them: they are the
// cells of a grid of five columns, which the number of games does not change. The tile is the picture of the game on a 4:3 frame, as the hub's game card has it, with the name centred under it and, in a search that is for the rank, the visitor's rank in that game centred under the name, the small emblem of its tier at the left of its name ("Gold II", or "Unranked" in a game they have not rated).
// A press on the picture opens the settings of the game for this search or this table (`config`: its speed, its expansions) in a window; a small gear at the corner of the picture says that it does, shown under the pointer and always on a screen that cannot hover, and a dot says
// that the settings are not the usual ones. A game that cannot be
// played now (`unavailable`: a group too large for it) is shown off, with a warning at its corner whose hover says why and no settings to open; its cross still takes it out. Game art is the only colour of the platform, so the tiles add none. The page keeps which games are in the
// search; the tiles draw it and decide nothing. The games are picked in the panel of a `GameSelect`, which a free slot of the row opens (`AddGameTile`): a dark, translucent rectangle with a plus in it, as big as the tiles of the games. A search has four slots to begin with and a fifth, free, when the four are taken, so the games
// that are picked are followed by the slots that are free (`gameSlotsFor` of `@pbgo/ui/play-zone`), each of them one of these.

type GamePicture = {
  /** URL of a picture that fills the frame, cropped to it (the game's cover, or its background). */
  picture?: string
  /** URL of the game's logo (or icon), contained and centered on the plain frame: for a game with no `picture`. */
  logo?: string
}

/** The picture of a game in its frame: it fills it, or the logo sits contained on the plain frame. */
function GameImage({ picture, logo, loading }: GamePicture & { loading: "lazy" | "eager" }) {
  if (picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={picture} alt="" loading={loading} decoding="async" className="absolute inset-0 size-full object-cover" />
  }
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" loading={loading} decoding="async" className="absolute inset-0 size-full object-contain p-4" />
  }
  return null
}

/** The visitor's rank in a game, under a name: the small emblem of its tier at the left of its name ("Gold II"), or "Unranked" for a game they have not rated. */
function GameRank({ rank }: { rank?: Rank | null }) {
  if (!rank) return <span className="text-xs text-muted-foreground">Unranked</span>
  return (
    <span className="flex items-center gap-1.5">
      <RankEmblem rank={rank} className="size-5 rounded-md text-xs @max-[7.5rem]/tile:size-4" />
      <RankBadge rank={rank} quiet />
    </span>
  )
}

/** The corner of the picture: one step for a large tile, a smaller one as the tile shrinks, so that a small tile is no rounder than a large one. */
const CORNERS = "rounded-2xl @max-[8.5rem]/tile:rounded-xl @max-[6rem]/tile:rounded-lg @max-[4.5rem]/tile:rounded-md"

type PickedGameProps = Omit<React.ComponentProps<"div">, "children"> &
  GamePicture & {
    /** The game's name, under its picture, on one line and cut with an ellipsis when it does not fit. */
    name: string
    /** Whether the tile says the visitor's rank in the game: a search for the rank does. */
    showRank?: boolean
    /** The visitor's rank in the game, none for a game they have not rated. */
    rank?: Rank | null
    /** What the cross does: takes the game out. None: no cross, for a search that is on, which is read and not set. */
    onRemove?: () => void
    /** `lazy` (default): a picture further down the page. `eager`: the one a page opens on. */
    loading?: "lazy" | "eager"
    /** The settings of the game for this search or this table, drawn in the window that a press on the picture opens (`LobbySettings`). None: the picture is only a picture. */
    config?: React.ReactNode
    /** Whether the settings are not the usual ones: a dot on the picture says so. */
    configured?: boolean
    /** Why the game cannot be played now: the tile is off, with a warning at its corner that says it on hover, and its settings do not open. */
    unavailable?: string
  }

/**
 * A game that is in the search: its picture, its name, its rank when the search is for the rank, a cross, a black circle over the top right corner of the picture, that takes it out, and, with `config`, the settings that a press on the picture opens. They are in a `Dialog`, a window
 * with the game's name in its title and the same width as the settings of a lobby, which scrolls when the settings are taller than the screen.
 */
function PickedGame({ name, picture, logo, showRank = false, rank, onRemove, loading = "lazy", config, configured = false, unavailable, className, ...props }: PickedGameProps) {
  const frame = (
    <span className={cn("relative block aspect-4/3 w-full overflow-hidden bg-muted ring-1 ring-foreground/10 transition-[opacity,filter] duration-fast", CORNERS, unavailable !== undefined && "opacity-50 grayscale")}>
      <GameImage picture={picture} logo={logo} loading={loading} />
    </span>
  )
  return (
    <div data-slot="picked-game" data-unavailable={unavailable !== undefined ? "" : undefined} className={cn("@container/tile relative flex min-w-0 flex-col gap-3", className)} {...props}>
      {config !== undefined && unavailable === undefined ? (
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" aria-label={`Settings of ${name}`} className={cn("group/config relative block w-full outline-none focus-visible:ring-3 focus-visible:ring-ring/60", CORNERS)}>
              {frame}
              <span
                aria-hidden="true"
                className="absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-md bg-background/70 text-foreground backdrop-blur-sm transition-opacity duration-fast group-hover/config:opacity-100 group-focus-visible/config:opacity-100 group-data-[state=open]/config:opacity-100 [@media(hover:hover)]:opacity-0 @max-[7.5rem]/tile:size-6"
              >
                <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} className="size-4 @max-[7.5rem]/tile:size-3.5" />
              </span>
              {configured && <span aria-hidden="true" className="absolute top-1.5 left-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />}
            </button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className="max-h-[calc(100svh-2rem)] overflow-y-auto">
            <DialogHeader className="pr-10">
              <DialogTitle>{name} settings</DialogTitle>
            </DialogHeader>
            {config}
          </DialogContent>
        </Dialog>
      ) : (
        frame
      )}
      {unavailable !== undefined && (
        <HoverCard>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-label={`${name}: ${unavailable}`}
              className="absolute top-1.5 left-1.5 z-10 flex size-6 items-center justify-center rounded-md bg-background/80 text-destructive backdrop-blur-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60 @max-[7.5rem]/tile:size-5"
            >
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" className="size-4 @max-[7.5rem]/tile:size-3.5" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="start" className="w-auto max-w-64 rounded-2xl p-3 text-sm">
            {unavailable}
          </HoverCardContent>
        </HoverCard>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Take ${name} out`}
          onClick={onRemove}
          className="absolute -top-2 -right-2 z-10 flex size-6 items-center justify-center rounded-full bg-background ring-1 ring-foreground/30 transition-shadow duration-fast outline-none hover:ring-foreground/60 focus-visible:ring-2 focus-visible:ring-ring @max-[7.5rem]/tile:-top-1.5 @max-[7.5rem]/tile:-right-1.5 @max-[7.5rem]/tile:size-5"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.5} aria-hidden="true" className="size-4 @max-[7.5rem]/tile:size-3.5" />
        </button>
      )}
      <span className="flex min-h-10.5 min-w-0 flex-col items-center gap-0.5 px-1 text-center">
        <span className={cn("max-w-full truncate text-sm @max-[7.5rem]/tile:text-xs", unavailable !== undefined && "text-muted-foreground")}>{name}</span>
        {showRank && <GameRank rank={rank} />}
      </span>
    </div>
  )
}

type AddGameTileProps = Omit<React.ComponentProps<"button">, "children" | "type"> & {
  /** What a screen reader hears: "Add a game". The tile draws no label, as a free place of the row of players draws none. */
  label: string
}

/**
 * A free slot of the row of games, the tile that adds one: a dark, translucent rectangle with a thin outline, the same outline and background as a free place of the row of players has, the frame of a picture, with a plus in it and no label, drawn at the size of the tiles of the games that are in and as tall as
 * they are, the room that a name and a rank take being left empty under the frame, in every row, so that a row of free slots is as tall as a row of games and nothing moves when a game is picked or the kind of play changes. Only the frame is a button. It is the trigger of the panel that lists the games (`GameSelect`): under the pointer and while the panel is open its outline is a little stronger. When the row has several free slots the first is the trigger and the others
 * only ask the page to open the panel. It takes the sizing of the row it is in (`className`: a width), as a picked tile does.
 */
function AddGameTile({ label, className, ...props }: AddGameTileProps) {
  return (
    <div data-slot="add-game" className={cn("@container/tile flex min-w-0 flex-col gap-3", className)}>
      <button type="button" aria-label={label} className="group/add block w-full outline-none" {...props}>
        <span
          className={cn(
            "flex aspect-4/3 w-full items-center justify-center border border-border bg-background/40 transition-colors duration-fast group-hover/add:border-foreground/50 group-focus-visible/add:ring-3 group-focus-visible/add:ring-ring/60 group-data-[state=open]/add:border-foreground/50",
            CORNERS,
          )}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} aria-hidden="true" className="size-6 text-muted-foreground transition-colors duration-fast group-hover/add:text-foreground group-data-[state=open]/add:text-foreground" />
        </span>
      </button>
      <span aria-hidden="true" className="min-h-10.5" />
    </div>
  )
}

export { AddGameTile, PickedGame }
export type { AddGameTileProps, PickedGameProps }
