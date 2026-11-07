import * as React from "react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"

// A game that a visitor picks among others, a tile that is pressed to choose it and pressed again to leave it: the games of a search ("Find a game" on the signed-in home). It is the picture of the game on a 4:3 frame, as the hub's game card has it, with the name under it and, at the corner
// of the picture, a box that says whether it is chosen. A game that is chosen is in its own colours, with the ring of the foreground round its picture and a tick in its box; one that is not is dimmed and grey, and its box is empty, as the card of an expansion is in a lobby's settings
// (`LobbySettings`). The tile is one button that is pressed (`aria-pressed`), so it reads as "Courtisans, pressed" and a set of them is a group of toggles; it is not a link: where a game's page leads is the card's. Game art is the only colour of the platform, so the tile adds none.

type GamePickProps = Omit<React.ComponentProps<"button">, "children" | "onChange" | "type"> & {
  /** The game's name, under its picture, on one line and cut with an ellipsis when it does not fit. */
  name: string
  /** URL of a picture that fills the frame, cropped to it (the game's cover, or its background). */
  picture?: string
  /** URL of the game's logo (or icon), contained and centered on the plain frame: for a game with no `picture`. */
  logo?: string
  /** Whether the game is chosen. */
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  /** `lazy` (default): a picture further down the page. `eager`: the one a page opens on. */
  loading?: "lazy" | "eager"
}

function GamePick({ name, picture, logo, selected, onSelectedChange, loading = "lazy", disabled, className, ...props }: GamePickProps) {
  return (
    <button
      type="button"
      data-slot="game-pick"
      data-selected={selected ? "" : undefined}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelectedChange(!selected)}
      className={cn("group/game-pick relative flex min-w-0 flex-col gap-3 text-left outline-none disabled:pointer-events-none", className)}
      {...props}
    >
      {/* Spans all the way down, so that the tile is valid inside a button. The frame is the game card's: a picture that fills it, or a logo contained on the plain frame */}
      <span
        className={cn(
          "relative block aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted ring-1 transition-[opacity,filter,box-shadow] duration-fast group-focus-visible/game-pick:ring-3 group-focus-visible/game-pick:ring-ring/60",
          selected ? "ring-2 ring-foreground" : "opacity-50 ring-foreground/10 grayscale group-hover/game-pick:opacity-80"
        )}
      >
        {picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" loading={loading} decoding="async" className="absolute inset-0 size-full object-cover" />
        )}
        {!picture && logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" loading={loading} decoding="async" className="absolute inset-0 size-full object-contain p-6" />
        )}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2.5 left-2.5 flex size-6 items-center justify-center rounded-md ring-1 transition-colors duration-fast",
          selected ? "bg-primary text-primary-foreground ring-transparent" : "bg-background/60 ring-foreground/30"
        )}
      >
        {selected && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-4" />}
      </span>
      <span className={cn("truncate px-1 text-sm transition-colors duration-fast", selected ? "text-foreground" : "text-muted-foreground")}>{name}</span>
    </button>
  )
}

export { GamePick }
export type { GamePickProps }
