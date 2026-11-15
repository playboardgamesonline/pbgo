"use client"

import { scoreLabelKey, type PlayerResult } from "@pbgo/engine-kit"
import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import { signed, type GameOverEntry } from "../../lib/game-over"
import { nameList } from "../../lib/rematch"
import { seatAvatar } from "../../lib/seat-avatar"
import type { SeatTheme } from "../../lib/ui-theme"
import { useEngineTexts } from "../skin-provider"
import { SeatAvatarMark } from "./seat-label"

// The small parts that the end screen's card and its panels share: a score line, the mark of a winner, the pictures of a place and the way a place is named. Pure presentation, in the game's look (the card sets `--go-accent`, the ink is the text colour
// around them and every tint is `current`, so any surface a game picks works). Nothing here knows the game.

/** The game's own rendering of the score lines of a player (its `renderDetail`), for a game whose lines are more than chips. */
export type ResultDetailRenderer = (result: PlayerResult, options: { large: boolean; centered: boolean }) => ReactNode

/** A step of the podium: the players who share a place, one player alone, or several for a tie or a team. */
export type PodiumPlace = {
  /** The rank of the place: the step after a tie for the first place is the third. */
  rank: number
  entries: GameOverEntry[]
  /** What the step is called besides the names of its players, when the game names them: a team. */
  label?: string
}

/** The mark of a winner (the skin's host icon or a plain crown), drawn at the size classes it is given. */
export type CrownMark = (sizeClassName: string) => ReactNode

export const CROWN_STYLE = { color: "var(--go-accent)", filter: "drop-shadow(0 0 12px var(--go-accent))" } as const
export const ACCENT = { color: "var(--go-accent)" } as const

/** A small tile of the card: a score line, a mark. */
export const CHIP = "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-current/15 bg-current/10 px-2.5 font-display text-xs font-bold tabular-nums"

/** The score lines of a result, as small chips: `label +n`, the words being the game's, in its Sanity (the engine gives the line's key and the values of its variables). */
export function Details({ result }: { result: PlayerResult }) {
  const { text } = useEngineTexts()
  if (result.detail.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {result.detail.map((line, index) => {
        const label = text(scoreLabelKey(line.key), line.label, line.values)
        return (
          <span key={`${line.key}:${index}`} title={`${label} : ${signed(line.points)}`} className={cn(CHIP, "h-6 px-2")} style={{ opacity: line.points === 0 ? 0.45 : 1 }}>
            <span className="font-sans font-medium opacity-60">{label}</span>
            {signed(line.points)}
          </span>
        )
      })}
    </div>
  )
}

/** The mark of a winner, in the accent of the card. */
export function Crowned({ crown, className, size = "size-6" }: { crown: CrownMark; className?: string; size?: string }) {
  return (
    <span role="img" aria-label="Winner" className={cn("inline-flex", className)} style={CROWN_STYLE}>
      {crown(size)}
    </span>
  )
}

/**
 * The pictures of the players of a place, side by side and overlapping when there are several. `className` sets the size of each (a custom size, since the podium is smaller than any of the seat sizes), which is the picture's width and height.
 */
export function Faces({ entries, seat, size, className }: { entries: GameOverEntry[]; seat: SeatTheme; size?: Parameters<typeof SeatAvatarMark>[0]["size"]; className?: string }) {
  return (
    <div className="flex -space-x-2">
      {entries.map((entry) => (
        <SeatAvatarMark key={entry.result.playerId} avatar={seatAvatar({ nickname: entry.nickname, color: entry.color, imageUrl: entry.imageUrl })} theme={seat} size={size} className={className} />
      ))}
    </div>
  )
}

/** The names of the players of a place in a sentence, the visitor's marked: "Ana (you)", "Ana, Ben and Chloé". */
export const namesOf = (entries: readonly GameOverEntry[], meId: string | null): string => nameList(entries.map((entry) => `${entry.nickname}${entry.result.playerId === meId ? " (you)" : ""}`))

/** A player alone is written in the colour of their seat when the game asks for it; several players, in the ink of the card. */
export const inSeatColour = (seat: SeatTheme, entries: readonly GameOverEntry[]) => seat.name === "seat" && entries.length === 1
