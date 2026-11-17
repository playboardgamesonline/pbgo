"use client"

import * as React from "react"
import { Add01Icon, Alert02Icon, Cancel01Icon, SlidersHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { hoverIntent } from "../hover-intent"
import type { Rank } from "../ranks"
import { cn } from "../utils"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { RankBadge } from "./rank-badge"
import { RankEmblem } from "./rank-emblem"

// The games of a search or of a table that is about to be opened (the play zone of the signed-in home), as a visitor sets them: the games that are in it, each a tile with a cross that takes it out. A search may hold one game or ten, so the tiles are plain and the page sizes them: they are the
// cells of a grid of five columns, which the number of games does not change. The tile is the picture of the game on a 4:3 frame, as the hub's game card has it, with the name centred under it and, in a search that is for the rank, the visitor's rank in that game centred under the name, the small emblem of its tier at the left of its name ("Gold II", or "Unranked" in a game they have not rated).
// The settings of the game for this search or this table (`config`: its speed, its expansions) open in a panel under its picture when the pointer rests on it (`hoverIntent`: after a short rest, and the panel stays while the pointer crosses to it); a press opens them too, which is the only way
// on a touch screen, where nothing hovers and a small button at the corner of the picture says that it does. A dot says that the settings are not the usual ones. A game that cannot be
// played now (`unavailable`: a group too large for it) is shown off, with a warning at its corner whose hover says why and no settings to open; its cross still takes it out. Game art is the only colour of the platform, so the tiles add none. The page keeps which games are in the
// search; the tiles draw it and decide nothing. The games are picked in the panel of a `GameSelect`, which a free slot of the row opens (`AddGameTile`): a dark, translucent rectangle with a plus in it, as big as the tiles of the games. A search has five slots to begin with, so the games that
// are picked are followed by the slots that are free (`gameSlotsFor` of `@pbgo/ui/play-zone`), each of them one of these.

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
    /** The settings of the game for this search or this table, drawn in the panel that a press on the picture opens (`LobbySettings`). None: the picture is only a picture. */
    config?: React.ReactNode
    /** Whether the settings are not the usual ones: a dot on the picture says so. */
    configured?: boolean
    /** Why the game cannot be played now: the tile is off, with a warning at its corner that says it on hover, and its settings do not open. */
    unavailable?: string
  }

/**
 * A game that is in the search: its picture, its name, its rank when the search is for the rank, a cross, a black circle over the top right corner of the picture, that takes it out, and, with `config`, the settings that a pointer resting on the picture opens (a press does too). The panel of the settings is a
 * `Popover` as wide as the settings of a lobby, `rounded-2xl` like the other panels that hold a list. It opens under a mouse that rests on the picture and closes once the mouse has left the picture and the panel, without taking the focus: a touch and a key press toggle it, as a popover always does.
 */
function PickedGame({ name, picture, logo, showRank = false, rank, onRemove, loading = "lazy", config, configured = false, unavailable, className, ...props }: PickedGameProps) {
  const [open, setOpen] = React.useState(false)
  // Whether the panel was opened (and is closed) by the pointer's rest or by a press or a key: the first does not take the focus and does not give it back. What the last press on the picture was, a mouse or a touch, is read by its click
  const [openedBy, setOpenedBy] = React.useState<"hover" | "press">("press")
  const pointer = React.useRef("mouse")
  const intent = React.useMemo(
    () =>
      hoverIntent((next) => {
        setOpenedBy("hover")
        setOpen(next)
      }),
    [],
  )
  React.useEffect(() => intent.dispose, [intent])
  const byMouse = (event: React.PointerEvent) => event.pointerType === "mouse"
  const frame = (
    <span className={cn("relative block aspect-4/3 w-full overflow-hidden bg-muted ring-1 ring-foreground/10 transition-[opacity,filter] duration-fast", CORNERS, unavailable !== undefined && "opacity-50 grayscale")}>
      <GameImage picture={picture} logo={logo} loading={loading} />
    </span>
  )
  return (
    <div data-slot="picked-game" data-unavailable={unavailable !== undefined ? "" : undefined} className={cn("@container/tile relative flex min-w-0 flex-col gap-3", className)} {...props}>
      {config !== undefined && unavailable === undefined ? (
        <Popover
          open={open}
          onOpenChange={(next) => {
            // What Radix asks for is a press, a key, Escape or a press outside: they decide the panel, and what the pointer was waiting for no longer counts
            intent.dispose()
            setOpenedBy("press")
            setOpen(next)
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Settings of ${name}`}
              onPointerDown={(event) => {
                pointer.current = event.pointerType
              }}
              onPointerEnter={(event) => byMouse(event) && intent.enter()}
              onPointerLeave={(event) => byMouse(event) && intent.leave()}
              onClick={(event) => {
                // The click of a mouse that rests on the picture belongs to the rest: the panel is open or about to be, and the click opens it now and does not shut it. A touch and a key press toggle it
                if (event.detail > 0 && pointer.current === "mouse") {
                  event.preventDefault()
                  intent.open()
                }
              }}
              className={cn("relative block w-full outline-none focus-visible:ring-3 focus-visible:ring-ring/60", CORNERS)}
            >
              {frame}
              {/* Where nothing can hover, this small button says that a press opens the settings; where a pointer can, resting on the picture opens them and nothing is drawn */}
              <span aria-hidden="true" className="absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-md bg-background/70 text-foreground backdrop-blur-sm @max-[7.5rem]/tile:size-6 [@media(hover:hover)]:hidden">
                <HugeiconsIcon icon={SlidersHorizontalIcon} strokeWidth={2} className="size-4 @max-[7.5rem]/tile:size-3.5" />
              </span>
              {configured && <span aria-hidden="true" className="absolute top-1.5 left-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />}
            </button>
          </PopoverTrigger>
          <PopoverContent
            aria-label={`Settings of ${name}`}
            align="center"
            className="w-md rounded-2xl p-5"
            onPointerEnter={(event) => byMouse(event) && intent.stay()}
            onPointerLeave={(event) => byMouse(event) && intent.leave()}
            // A panel that the pointer opened leaves the focus where it was, and gives none back when it closes
            onOpenAutoFocus={(event) => openedBy === "hover" && event.preventDefault()}
            onCloseAutoFocus={(event) => openedBy === "hover" && event.preventDefault()}
          >
            {config}
          </PopoverContent>
        </Popover>
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
 * A free slot of the row of games, the tile that adds one: a dark, translucent rectangle, the frame of a picture, with a plus in it and no label, drawn at the size of the tiles of the games that are in and as tall as they are, the room that a name takes being left empty under the frame, so that a row of free slots is as tall
 * as a row of games and nothing moves when a game is picked. Only the frame is a button. It is the trigger of the panel that lists the games (`GameSelect`): under the pointer and while the panel is open its outline is a little stronger. When the row has several free slots the first is the trigger and the others
 * only ask the page to open the panel. It takes the sizing of the row it is in (`className`: a width), as a picked tile does.
 */
function AddGameTile({ label, className, ...props }: AddGameTileProps) {
  return (
    <div data-slot="add-game" className={cn("@container/tile flex min-w-0 flex-col gap-3", className)}>
      <button type="button" aria-label={label} className="group/add block w-full outline-none" {...props}>
        <span
          className={cn(
            "flex aspect-4/3 w-full items-center justify-center bg-background/40 ring-1 ring-foreground/10 transition-shadow duration-fast group-hover/add:ring-foreground/30 group-focus-visible/add:ring-3 group-focus-visible/add:ring-ring/60 group-data-[state=open]/add:ring-foreground/30",
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
