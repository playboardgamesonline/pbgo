"use client"

import * as React from "react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Rank } from "../ranks"
import { cn } from "../utils"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { RankBadge } from "./rank-badge"

// The games of a search ("Find a game" on the signed-in home), as a visitor sets them: the games that are in it, each a tile with a cross that takes it out, and one more tile, a dark, translucent rectangle with a plus, that opens the list of the games that are not in it and puts
// in the one that is pressed. A search may hold one game or all of them, so the tiles are plain and the page sizes them by how many there are. The tile is the picture of the game on a 4:3 frame, as the hub's game card has it, with the name under it and, in a search that is for the
// rank, the visitor's rank in that game under the name ("Gold II", or "Unranked" in a game they have not rated). Game art is the only colour of the platform, so the tiles add none. The page keeps which games are in the search; the tiles draw it and decide nothing.

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

/** The visitor's rank in a game, as a word under a name: "Gold II", or "Unranked" for a game they have not rated. */
function GameRank({ rank }: { rank?: Rank | null }) {
  return rank ? <RankBadge rank={rank} quiet /> : <span className="text-xs text-muted-foreground">Unranked</span>
}

type PickedGameProps = Omit<React.ComponentProps<"div">, "children"> &
  GamePicture & {
    /** The game's name, under its picture, on one line and cut with an ellipsis when it does not fit. */
    name: string
    /** Whether the tile says the visitor's rank in the game: a search for the rank does. */
    showRank?: boolean
    /** The visitor's rank in the game, none for a game they have not rated. */
    rank?: Rank | null
    /** What the cross does: takes the game out of the search. None: no cross, for a search that is on, which is read and not set. */
    onRemove?: () => void
    /** `lazy` (default): a picture further down the page. `eager`: the one a page opens on. */
    loading?: "lazy" | "eager"
  }

/** A game that is in the search: its picture, its name, its rank when the search is for the rank, and a cross, a black circle over the top right corner of the picture, that takes it out. */
function PickedGame({ name, picture, logo, showRank = false, rank, onRemove, loading = "lazy", className, ...props }: PickedGameProps) {
  return (
    <div data-slot="picked-game" className={cn("@container/tile relative flex min-w-0 flex-col gap-3", className)} {...props}>
      <span className="relative block aspect-4/3 w-full overflow-hidden rounded-2xl @max-[8.5rem]/tile:rounded-xl @max-[6rem]/tile:rounded-lg @max-[4.5rem]/tile:rounded-md bg-muted ring-1 ring-foreground/10">
        <GameImage picture={picture} logo={logo} loading={loading} />
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Take ${name} out of the search`}
          onClick={onRemove}
          className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-background ring-1 ring-foreground/30 transition-shadow duration-fast outline-none hover:ring-foreground/60 focus-visible:ring-2 focus-visible:ring-ring @max-[7.5rem]/tile:-top-1.5 @max-[7.5rem]/tile:-right-1.5 @max-[7.5rem]/tile:size-5"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.5} aria-hidden="true" className="size-4 @max-[7.5rem]/tile:size-3.5" />
        </button>
      )}
      <span className="flex min-w-0 flex-col gap-0.5 px-1">
        <span className="truncate text-sm @max-[7.5rem]/tile:text-xs">{name}</span>
        {showRank && <GameRank rank={rank} />}
      </span>
    </div>
  )
}

/** A game that can be put in the search, as the list of the games to add draws it. */
type AddableGame = GamePicture & {
  slug: string
  name: string
  /** The visitor's rank in the game, none for a game they have not rated. */
  rank?: Rank | null
}

type AddGameProps = {
  /** The games that are not in the search, in the order to list them: with none, the list says why (`note`). */
  games: readonly AddableGame[]
  /** What the list says when there is nothing to add: that every game is in, or that the search holds no more games. */
  note?: string
  /** Whether the list says the visitor's rank in each game. */
  showRank?: boolean
  /** What a press on a game does: puts it in the search. The list stays open, so that several can be added. */
  onAdd: (slug: string) => void
  className?: string
}

/**
 * The tile that adds a game to the search: a dark, translucent rectangle, the frame of a picture, with a plus in it. It opens a list of the games that are not in the search, each with its picture, its name and, in a search for the rank, the visitor's rank in it, and a press
 * on one puts it in. The tile is always there: where every game is already in, the list says so.
 */
function AddGame({ games, note = "Every game is already in your search.", showRank = false, onAdd, className }: AddGameProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" data-slot="add-game" aria-label="Add a game to the search" className={cn("group/add @container/add flex min-w-0 flex-col gap-3 text-left outline-none", className)}>
          <span className="flex aspect-4/3 w-full items-center justify-center rounded-2xl @max-[8.5rem]/add:rounded-xl @max-[6rem]/add:rounded-lg @max-[4.5rem]/add:rounded-md bg-background/40 ring-1 ring-foreground/10 transition-shadow duration-fast group-hover/add:ring-foreground/30 group-focus-visible/add:ring-3 group-focus-visible/add:ring-ring/60 group-data-[state=open]/add:ring-foreground/30">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} aria-hidden="true" className="size-6 text-muted-foreground transition-colors duration-fast group-hover/add:text-foreground group-data-[state=open]/add:text-foreground" />
          </span>
          <span className="truncate px-1 text-sm text-muted-foreground">Add a game</span>
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Games to add" className="p-2">
        {games.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{note}</p>}
        {/* The list scrolls inside the panel, so that fifteen games do not make a panel as high as the page */}
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {games.map((game) => (
            <button
              key={game.slug}
              type="button"
              onClick={() => onAdd(game.slug)}
              className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors duration-fast outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="relative block aspect-4/3 w-14 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                <GameImage picture={game.picture} logo={game.logo} loading="lazy" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm">{game.name}</span>
                {showRank && <GameRank rank={game.rank} />}
              </span>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { AddGame, PickedGame }
export type { AddableGame, AddGameProps, PickedGameProps }
