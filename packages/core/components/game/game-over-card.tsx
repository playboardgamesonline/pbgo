"use client"

import { ArrowRight01Icon, RepeatIcon, Share08Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { scoreLabelKey, type PlayerResult } from "@pbgo/engine-kit"
import { motion as animated } from "motion/react"
import { useId, useState, type ReactNode } from "react"
import { pointsLabel, pointsTone } from "@pbgo/ui/results"
import { cn } from "@pbgo/ui/utils"
import { scoreText, sectionMotion, signed, type GameOverEntry, type Summary } from "../../lib/game-over"
import type { Motion } from "../../lib/motion-preference"
import type { RankChange } from "../../lib/rank-change"
import { nameList, rematchLine, type Rematch } from "../../lib/rematch"
import { seatAvatar } from "../../lib/seat-avatar"
import { gameOverStyle, type GameOverTheme, type SeatTheme } from "../../lib/ui-theme"
import { PrimaryButton } from "../home/screen"
import { useEngineTexts } from "../skin-provider"
import { SeatAvatarMark, SeatLabel, type SeatSize } from "./seat-label"

// The end screen, in the game's look: a card centered on the screen, over the board with no veil around it. It wears what a game gives its screens: the surface, line, corners and ink of `UI_THEME.gameOver`, the ring and the name colours of `UI_THEME.seat`
// (the pictures are always round), the game's fonts, its crown and its buttons (`PrimaryButton`). At the very top it says how the game ended for the visitor (a score, the rank points of a game that counted for the rank). Under it a podium has the winner
// in the middle, with the second place on its left and the third on its right, on steps that touch each other; at two places the steps share the whole width; players who share a rank share a step (a tie, a team), and a table that plays together has one
// place for everybody. The places after the third are rows under the podium. Then two buttons: "Continue", which leaves the finished game for the platform, and "Rematch", which asks the table for another game and says who has agreed. The scores of every
// player, with their lines, are behind "Show scores". Pure presentation, no game context: the connected `GameOver` feeds it from the game, the design docs with samples. The names and the score lines are what the players and the game wrote; every other word
// is English until the language pass.

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

const CROWN_STYLE = { color: "var(--go-accent)", filter: "drop-shadow(0 0 12px var(--go-accent))" } as const
const ACCENT = { color: "var(--go-accent)" } as const

/** A small tile of the card: a score, a mark, a line of a score. */
const CHIP = "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-current/15 bg-current/10 px-2.5 font-display text-xs font-bold tabular-nums"

/** The score lines of a result, as small chips: `label +n`, the words being the game's, in its Sanity (the engine gives the line's key and the values of its variables). */
function Details({ result }: { result: PlayerResult }) {
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
function Crowned({ crown, className }: { crown: GameOverCardProps["crown"]; className?: string }) {
  return (
    <span role="img" aria-label="Winner" className={cn("inline-flex", className)} style={CROWN_STYLE}>
      {crown("size-8")}
    </span>
  )
}

/** The pictures of the players of a place, side by side and overlapping when there are several. */
function Faces({ entries, seat, size }: { entries: GameOverEntry[]; seat: SeatTheme; size: SeatSize }) {
  return (
    <div className="flex -space-x-2">
      {entries.map((entry) => (
        <SeatAvatarMark key={entry.result.playerId} avatar={seatAvatar({ nickname: entry.nickname, color: entry.color, imageUrl: entry.imageUrl })} theme={seat} size={size} />
      ))}
    </div>
  )
}

/** The names of the players of a place in a sentence, the visitor's marked: "Ana (you)", "Ana, Ben and Chloé". */
const namesOf = (entries: readonly GameOverEntry[], meId: string | null): string => nameList(entries.map((entry) => `${entry.nickname}${entry.result.playerId === meId ? " (you)" : ""}`))

/** A player alone is written in the colour of their seat when the game asks for it; several players, in the ink of the card. */
const inSeatColour = (seat: SeatTheme, entries: readonly GameOverEntry[]) => seat.name === "seat" && entries.length === 1

/** The height of the steps, which touch each other: the first place is the highest, and each step after it is lower. */
const STEP_HEIGHTS = ["min-h-32", "min-h-28", "min-h-24"] as const
/**
 * How the steps stand for one, two or three places. The first place is in the middle of three; at two the steps share the whole width, the second on the left of the first; a single place takes it all. The classes are written out for the stylesheet to find them.
 */
const LAYOUT = {
  1: { grid: "grid-cols-1", columns: ["col-start-1"] },
  2: { grid: "grid-cols-2", columns: ["col-start-2", "col-start-1"] },
  3: { grid: "grid-cols-3", columns: ["col-start-2", "col-start-1", "col-start-3"] },
} as const

type PlaceProps = { place: PodiumPlace; winners: readonly string[]; meId: string | null; scored: boolean; seat: SeatTheme; crown: GameOverCardProps["crown"] }

/**
 * One step of the podium: the players stand on it (the crown of a winner above their pictures), and the name (or the name of the team and the names of its players under it) and the score are written on its face. The steps touch each other, so that
 * together they make one podium, and none of them has a number.
 */
function Step({ place, index, count, winners, meId, scored, seat, crown }: PlaceProps & { index: number; count: 1 | 2 | 3 }) {
  const { entries } = place
  const first = index === 0
  const alone = first && entries.length === 1
  const coloured = inSeatColour(seat, entries)
  return (
    <li className={cn("row-start-1 flex min-w-0 flex-col items-center justify-end", LAYOUT[count].columns[index])}>
      <div className="flex flex-col items-center gap-1.5 pb-2 short:pb-1">
        {entries.some((entry) => winners.includes(entry.result.playerId)) && <Crowned crown={crown} className="short:hidden" />}
        <Faces entries={entries} seat={seat} size={alone ? "xl" : entries.length > 2 ? "md" : "lg"} />
      </div>
      <div
        className={cn(
          "flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-t-lg border border-current/15 px-2 py-3 text-center short:min-h-0 short:py-2",
          first ? "bg-current/15" : "bg-current/10",
          STEP_HEIGHTS[index] ?? "min-h-24",
        )}
      >
        <p
          className={cn(
            "ph-mask line-clamp-2 w-full font-sans leading-tight font-black tracking-[0.1em] text-balance uppercase [overflow-wrap:anywhere]",
            first ? "text-lg" : "text-sm",
            coloured && "brightness-150",
          )}
          style={coloured ? { color: entries[0]!.color } : undefined}
        >
          {place.label ?? namesOf(entries, meId)}
        </p>
        {place.label && <p className="ph-mask line-clamp-2 w-full font-sans text-xs text-balance opacity-60">{namesOf(entries, meId)}</p>}
        {scored && entries[0] && (
          <p className={cn("font-display tabular-nums", first ? "text-xl" : "text-base opacity-80")} style={first ? ACCENT : undefined}>
            {scoreText(entries[0].result.total)}
          </p>
        )}
      </div>
    </li>
  )
}

/** A place after the third, as a row under the podium: its rank, the pictures, the names and the score. The visitor's row is lit. */
function Rest({ place, meId, scored, seat }: Omit<PlaceProps, "winners" | "crown">) {
  const { entries } = place
  const coloured = inSeatColour(seat, entries)
  return (
    <li className={cn("flex items-center gap-3 rounded-lg px-3 py-1.5", entries.some((entry) => entry.result.playerId === meId) && "bg-current/10")}>
      <span className="w-5 shrink-0 text-center font-display text-lg tabular-nums opacity-45">{place.rank}</span>
      <Faces entries={entries} seat={seat} size="md" />
      <span
        className={cn("ph-mask min-w-0 flex-1 truncate font-sans text-base leading-tight font-black tracking-[0.1em] uppercase", coloured && "brightness-150")}
        style={coloured ? { color: entries[0]!.color } : undefined}
      >
        {place.label ?? namesOf(entries, meId)}
      </span>
      {scored && entries[0] && <span className="font-display text-xl leading-none tabular-nums">{entries[0].result.total}</span>}
    </li>
  )
}

/** The podium: the three first places on steps that touch each other, the others as rows under them. A place after the third has no step. */
function Podium({ places, ...rest }: Omit<PlaceProps, "place"> & { places: PodiumPlace[] }) {
  const steps = places.slice(0, 3)
  const after = places.slice(3)
  const count = steps.length as 1 | 2 | 3
  if (steps.length === 0) return null
  return (
    <div className="flex flex-col gap-3 pt-2 short:pt-0">
      <ol aria-label="Podium" className={cn("grid items-end", LAYOUT[count].grid)}>
        {steps.map((place, index) => (
          <Step key={place.rank} place={place} index={index} count={count} {...rest} />
        ))}
      </ol>
      {after.length > 0 && (
        <ol aria-label="Other places" className="flex flex-col gap-0.5">
          {after.map((place) => (
            <Rest key={place.rank} place={place} meId={rest.meId} scored={rest.scored} seat={rest.seat} />
          ))}
        </ol>
      )}
    </div>
  )
}

/** A table that plays together: no steps, since nobody beat anybody. Everybody stands in one place, crowned when the table won and not when it lost. */
function Together({ place, won, meId, scored, seat, crown }: { place: PodiumPlace; won: boolean; meId: string | null; scored: boolean; seat: SeatTheme; crown: GameOverCardProps["crown"] }) {
  const { entries } = place
  return (
    <div className="flex flex-col items-center gap-1.5 pt-2 short:pt-0">
      {won && <Crowned crown={crown} className="short:hidden" />}
      <Faces entries={entries} seat={seat} size={entries.length > 3 ? "lg" : "xl"} />
      <p className="ph-mask w-full text-center font-sans text-lg leading-tight font-black tracking-[0.1em] text-balance uppercase">{place.label ?? namesOf(entries, meId)}</p>
      {scored && entries[0] && (
        <p className="font-display text-xl tabular-nums" style={ACCENT}>
          {scoreText(entries[0].result.total)}
        </p>
      )}
    </div>
  )
}

/** A player in the scores that unfold under the head: where they came, their score and its lines. The visitor's row is lit. */
function Row({ entry, rank, winner, me, scored, seat, crown, renderDetail }: { entry: GameOverEntry; rank: number; winner: boolean; me: boolean; scored: boolean; seat: SeatTheme; crown: GameOverCardProps["crown"]; renderDetail?: ResultDetailRenderer }) {
  const { result, nickname, color, imageUrl } = entry
  return (
    <li className={cn("space-y-1.5 rounded-lg px-3 py-2", me && "bg-current/10")}>
      <div className="flex items-center gap-3">
        <span className="grid w-6 shrink-0 place-items-center font-display text-lg tabular-nums opacity-45">{winner ? <span style={CROWN_STYLE}>{crown("size-5")}</span> : rank}</span>
        <SeatLabel
          nickname={nickname}
          color={color}
          imageUrl={imageUrl}
          theme={seat}
          className="min-w-0 flex-1 gap-3 font-sans text-base font-black tracking-[0.1em] uppercase"
          nameClassName={seat.name === "seat" ? "brightness-150" : undefined}
        >
          {me && <span className="font-sans text-xs font-medium tracking-normal normal-case opacity-60">(you)</span>}
        </SeatLabel>
        {scored && <span className="font-display text-2xl leading-none tabular-nums">{result.total}</span>}
      </div>
      {scored && <div className="pl-9 empty:hidden">{renderDetail ? renderDetail(result, { large: false, centered: false }) : <Details result={result} />}</div>}
    </li>
  )
}

export type GameOverCardProps = {
  /** The game's look for the card (`UI_THEME.gameOver` over its defaults, `gameOverTheme`). */
  theme: GameOverTheme
  /** The game's look for the pictures of its players (`UI_THEME.seat` over its defaults, `seatTheme`). */
  seat: SeatTheme
  /** The skin's pattern, faint on the card. */
  pattern?: string | null
  /** The mark of a winner (the skin's host icon or a crown), drawn at the size classes it is given; it takes the colour of the text it sits in, which the card sets to its accent. */
  crown: (sizeClassName: string) => ReactNode
  /** How the game ended for the visitor. */
  summary: Summary
  /** The places from the first to the last: the players who share a rank share a place, and a table that plays together has a single one. */
  places: PodiumPlace[]
  /** The ids of the winners: nobody for a table that lost together. */
  winners: readonly string[]
  /** The table plays together and won or lost as one: the podium gives way to one place for everybody. */
  together?: "won" | "lost"
  /** The visitor's player id. */
  meId: string | null
  /** What the game did to the visitor's rank points: absent for a guest, and while it is not known. */
  rank?: RankChange | null
  /** Where the vote for another game stands. */
  rematch: Rematch
  /** The vote of the visitor is being sent. */
  voting?: boolean
  /** Asks the table for another game. Absent: the button is off. */
  onRematch?: () => void
  /** Leaves the finished game for the platform. Absent: the button is off. */
  onContinue?: () => void
  /** Opens the share window of the result. Absent while its picture is being drawn. */
  onShare?: () => void
  renderDetail?: ResultDetailRenderer
  /** How much it moves: `useMotion()` in a game, picked by hand in a specimen. */
  motion: Motion
  className?: string
}

/**
 * The end screen: how the game ended for the visitor at the very top, the podium under it, the scores of every player behind "Show scores" and the two buttons. The score of a game that counts no points is not written, and neither are the lines under it.
 * `Rematch` says how many of the players still at the table agreed, and a line under the buttons says who asked, whom the table waits for and who left (`rematchLine`).
 */
export function GameOverCard({ theme, seat, pattern, crown, summary, places, winners, together, meId, rank, rematch, voting = false, onRematch, onContinue, onShare, renderDetail, motion, className }: GameOverCardProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const scored = summary.points !== null
  const line = rematchLine(rematch)
  const here = rematch.agreed.length + rematch.waiting.length
  // The count of the players who agreed means something while another game can still be played
  const asked = rematch.agreed.length > 0 && rematch.enough
  const everyone = places.flatMap((place) => place.entries.map((entry) => ({ entry, rank: place.rank })))
  // A picture of a player is always round, whatever shape the game gives the seats on its table; the ring and the colour of the names stay the theme's
  const faces: SeatTheme = { ...seat, shape: "disc" }
  return (
    <animated.section
      aria-label="Game result"
      {...sectionMotion(motion)}
      className={cn("pointer-events-auto relative flex w-full max-w-lg flex-col border-[0.5px] font-sans shadow-[0_24px_70px_rgb(0_0_0/65%)] short:max-w-md", className)}
      style={gameOverStyle(theme)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {pattern && <div className="absolute inset-0 bg-[length:128px_128px] opacity-[0.07]" style={{ backgroundImage: `url(${pattern})` }} />}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgb(255_255_255/8%),transparent_70%)]" />
      </div>

      <div className="relative flex flex-col gap-4 px-6 pt-7 pb-6 short:gap-2 short:px-5 short:py-4">
        <button
          type="button"
          aria-label="Share the result"
          title="Share the result"
          disabled={!onShare}
          onClick={onShare}
          className="absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-md opacity-70 transition-opacity hover:opacity-100 disabled:cursor-wait disabled:opacity-30 motion-reduce:transition-none"
        >
          <HugeiconsIcon icon={Share08Icon} strokeWidth={1.8} className="size-5" />
        </button>

        {/* How it ended for the visitor comes first, at the very top of the card, with the score and the rank points; the share is in the corner beside it */}
        <div className="flex flex-col items-center gap-2 px-9">
          <h2 className="text-center font-display text-3xl leading-tight tracking-wide short:text-2xl" style={summary.outcome === "win" ? ACCENT : undefined}>
            {summary.title}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-1.5 empty:hidden">
            {summary.points !== null && <span className={CHIP}>{scoreText(summary.points)}</span>}
            {rank?.ranked && (
              <span className={CHIP} style={ACCENT}>
                Ranked
              </span>
            )}
            {rank?.ranked && rank.points !== null && (
              <span className={cn(CHIP, pointsTone(rank.points) === "destructive" && "opacity-70")} style={pointsTone(rank.points) === "success" ? ACCENT : undefined}>
                {pointsLabel(rank.points)} rank points
              </span>
            )}
          </div>
        </div>

        {together ? (
          <Together place={places[0] ?? { rank: 1, entries: [] }} won={together === "won"} meId={meId} scored={scored} seat={faces} crown={crown} />
        ) : (
          <Podium places={places} winners={winners} meId={meId} scored={scored} seat={faces} crown={crown} />
        )}

        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((was) => !was)}
          className="mx-auto cursor-pointer font-display text-sm underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100 motion-reduce:transition-none"
        >
          {open ? "Hide scores" : "Show scores"}
        </button>

        <ol id={listId} aria-label="Final ranking" className={cn("flex max-h-[min(30dvh,14rem)] flex-col gap-0.5 overflow-y-auto [scrollbar-width:thin] short:max-h-20", !open && "hidden")}>
          {everyone.map(({ entry, rank: place }) => (
            <Row key={entry.result.playerId} entry={entry} rank={place} winner={winners.includes(entry.result.playerId)} me={entry.result.playerId === meId} scored={scored} seat={faces} crown={crown} renderDetail={renderDetail} />
          ))}
        </ol>

        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <PrimaryButton
              onClick={onRematch}
              busy={voting}
              waiting={rematch.mine}
              disabled={!onRematch || !rematch.enough}
              className="h-12 max-w-none border border-current/30 bg-current/10 px-4 text-xl text-inherit shadow-none hover:scale-100 hover:bg-current/20 short:h-10 short:text-lg"
            >
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon icon={rematch.mine ? Tick02Icon : RepeatIcon} strokeWidth={1.8} className="size-5" />
                Rematch
                {asked && (
                  <span className="tabular-nums opacity-60">
                    {rematch.agreed.length}/{here}
                  </span>
                )}
              </span>
            </PrimaryButton>
            <PrimaryButton onClick={onContinue} disabled={!onContinue} className="h-12 max-w-none px-4 text-xl short:h-10 short:text-lg">
              <span className="inline-flex items-center gap-2">
                Continue
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.8} className="size-5" />
              </span>
            </PrimaryButton>
          </div>
          {line && (
            <p role="status" className="ph-mask text-center font-sans text-sm opacity-70">
              {line}
            </p>
          )}
        </div>
      </div>
    </animated.section>
  )
}
