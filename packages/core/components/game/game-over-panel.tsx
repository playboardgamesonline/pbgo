"use client"

import type { PlayerResult } from "@pbgo/engine-kit"
import { LinkForwardIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { animate, motion } from "motion/react"
import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import { GAME_OVER_TIMING, rowDelay, signed, type GameOverEntry } from "../../lib/game-over"
import { EASE_STANDARD, type Motion } from "../../lib/motion-preference"
import { seatAvatar } from "../../lib/seat-avatar"
import { gameOverStyle, type GameOverTheme, type SeatTheme } from "../../lib/ui-theme"
import { SeatAvatarMark, SeatLabel } from "./seat-label"

// The panel of the end screen, apart from `game-over.tsx` (which reads the game, shares the result and replays): nothing here needs
// a game, so the design docs draw it on the hub without the lobby, the toolbar or the share code that file brings along.

/** The score chips of a result, in the panel's ink: one `label +n` per line of the detail */
function Details({ result, large, centered }: { result: PlayerResult; large?: boolean; centered?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center", centered ? "justify-center" : "justify-start", large ? "gap-2" : "gap-1.5")}>
      {result.detail.map((d) => (
        <span
          key={d.key}
          title={`${d.label} : ${signed(d.points)}`}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md border border-current/15 bg-current/10 font-display font-bold tabular-nums",
            large ? "h-8 px-3 text-sm short:h-7 short:px-2.5 short:text-xs" : "h-7 px-2.5 text-xs short:h-6 short:px-2 short:text-[11px]",
          )}
          style={{ opacity: d.points === 0 ? 0.45 : 1 }}
        >
          <span className="font-sans font-medium opacity-60">{d.label}</span>
          {signed(d.points)}
        </span>
      ))}
    </div>
  )
}

export type ResultDetailRenderer = (result: PlayerResult, options: { large: boolean; centered: boolean }) => React.ReactNode

/** A part of the hero that drops or rises into place the first time the panel opens (lively motion), and is simply there otherwise */
function Rise({
  active,
  delay,
  y = 0,
  scale = 1,
  spring,
  className,
  children,
}: {
  active: boolean
  delay: number
  y?: number
  scale?: number
  spring?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      className={className}
      initial={active ? { opacity: 0, y, scale } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring ? { type: "spring", stiffness: 240, damping: 16, delay } : { duration: 0.5, delay, ease: EASE_STANDARD }}
    >
      {children}
    </motion.div>
  )
}

/** A number that counts up from 0 once (lively motion); screen readers get the final value, not the count */
function CountUp({ value, active, delay, format }: { value: number; active: boolean; delay: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!active) return
    const controls = animate(0, value, { delay, duration: GAME_OVER_TIMING.count, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) })
    return () => controls.stop()
  }, [active, value, delay])
  if (!active) return <>{format(value)}</>
  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}

/** The share thumbnail, a polaroid on the panel's corner (top-left of the hero on a short screen, where the ranking sits at the right). It is the share button. */
function Polaroid({ label, thumbnail, onShare }: { label: string; thumbnail: string | null; onShare?: () => void }) {
  return (
    <button
      type="button"
      onClick={onShare}
      disabled={!onShare}
      title={label}
      aria-label={label}
      className="group absolute -top-3 -right-10 z-20 w-40 rotate-[5deg] cursor-pointer rounded-2xl bg-(--go-frame) p-[3px] shadow-[0_10px_24px_rgb(0_0_0/55%)] transition-transform duration-200 hover:rotate-[1deg] disabled:cursor-wait motion-reduce:transition-none short:-left-4 short:right-auto short:w-20 short:-rotate-[5deg] short:hover:-rotate-[1deg]"
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[13px] bg-surface-dark">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt="" className="size-full scale-[1.35] object-cover" style={{ transformOrigin: "50% 58%" }} />
        ) : (
          <span className="block size-full animate-pulse bg-surface" />
        )}
      </span>
      <span
        className="absolute top-1/2 left-[30%] flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-surface-dark text-foreground shadow-md transition-transform group-hover:scale-110 motion-reduce:transition-none short:size-6"
        style={{ borderColor: "color-mix(in oklab, var(--go-frame) 50%, transparent)" }}
      >
        <HugeiconsIcon icon={LinkForwardIcon} strokeWidth={1.8} className="size-4 short:size-3" />
      </span>
    </button>
  )
}

const CROWN_STYLE = { color: "var(--go-accent)", filter: "drop-shadow(0 0 12px var(--go-accent))" } as const

type WinnerProps = {
  entry: GameOverEntry
  seat: SeatTheme
  crown: GameOverPanelProps["crown"]
  /** The flourish is on: the parts come in one after the other, the points count up */
  lively: boolean
  /** When this winner's parts start coming in (seconds) */
  delay: number
  points: GameOverLabels["points"]
  renderDetail?: ResultDetailRenderer
}

const nameStyle = (seat: SeatTheme, entry: GameOverEntry) => (seat.name === "seat" ? { color: entry.color } : undefined)

/** The only winner: the hero, stacked and centred (crown, avatar, name, points, breakdown) */
function SoloWinner({ entry, seat, crown, lively, delay, points, renderDetail }: WinnerProps) {
  return (
    <div className="flex max-w-full min-w-0 flex-col items-center gap-1">
      <Rise active={lively} delay={delay + 0.12} y={-18} scale={0.5} spring className="relative z-10 -mb-3">
        <span className="inline-flex" style={CROWN_STYLE}>
          {crown("size-9")}
        </span>
      </Rise>
      <Rise active={lively} delay={delay} scale={0.6} spring>
        <SeatAvatarMark avatar={seatAvatar({ nickname: entry.nickname, color: entry.color, imageUrl: entry.imageUrl })} theme={seat} size="xl" />
      </Rise>
      <Rise active={lively} delay={delay + 0.16} y={14}>
        <p
          className={cn(
            "ph-mask font-sans text-4xl font-black tracking-[0.16em] text-balance uppercase [overflow-wrap:anywhere] short:text-3xl",
            seat.name === "seat" && "brightness-150",
          )}
          style={nameStyle(seat, entry)}
        >
          {entry.nickname}
        </p>
      </Rise>
      <p className="font-display text-2xl tabular-nums short:text-xl" style={{ color: "var(--go-accent)" }}>
        <CountUp value={entry.result.total} active={lively} delay={delay + 0.25} format={points} />
      </p>
      <Rise active={lively} delay={delay + 0.45} y={8} className="mt-1">
        {renderDetail ? renderDetail(entry.result, { large: true, centered: true }) : <Details result={entry.result} large centered />}
      </Rise>
    </div>
  )
}

/**
 * One of several winners (a tie): the avatar with its crown on the corner beside the name and the points, the breakdown under
 * them. Stacked winners this way take a third of the height of stacked heroes, so the ranking keeps its room.
 */
function TiedWinner({ entry, seat, crown, lively, delay, points, renderDetail }: WinnerProps) {
  return (
    <div className="flex max-w-full min-w-0 flex-col items-center gap-2.5 short:gap-1.5">
      <div className="flex max-w-full min-w-0 items-center gap-4 short:gap-3">
        <Rise active={lively} delay={delay} scale={0.6} spring>
          <SeatAvatarMark avatar={seatAvatar({ nickname: entry.nickname, color: entry.color, imageUrl: entry.imageUrl })} theme={seat} size="lg">
            <span className="inline-flex rotate-[16deg]" style={CROWN_STYLE}>
              {crown("size-6 short:size-5")}
            </span>
          </SeatAvatarMark>
        </Rise>
        <div className="min-w-0 text-left">
          <Rise active={lively} delay={delay + 0.1} y={10}>
            <p
              className={cn(
                "ph-mask font-sans text-2xl font-black tracking-[0.16em] uppercase [overflow-wrap:anywhere] short:text-xl",
                seat.name === "seat" && "brightness-150",
              )}
              style={nameStyle(seat, entry)}
            >
              {entry.nickname}
            </p>
          </Rise>
          <p className="font-display text-2xl tabular-nums short:text-xl" style={{ color: "var(--go-accent)" }}>
            <CountUp value={entry.result.total} active={lively} delay={delay + 0.2} format={points} />
          </p>
        </div>
      </div>
      <Rise active={lively} delay={delay + 0.35} y={8}>
        {renderDetail ? renderDetail(entry.result, { large: true, centered: true }) : <Details result={entry.result} large centered />}
      </Rise>
    </div>
  )
}

export type GameOverLabels = {
  scoreboard: string
  winnerTitle: string
  shareResult: string
  /** A player's points as the panel writes them ("+12 pts") */
  points: (n: number) => string
}

export type GameOverPanelProps = {
  theme: GameOverTheme
  seat: SeatTheme
  /** How much it moves: `useMotion()` in a game, picked by hand in a specimen */
  motion: Motion
  winners: GameOverEntry[]
  others: GameOverEntry[]
  labels: GameOverLabels
  /** The skin's pattern, faint on the panel */
  pattern?: string | null
  /** The mark of a winner (the skin's host icon or a crown), drawn at the size classes it is given; it takes the colour of the text it sits in, which the panel sets to its accent */
  crown: (sizeClassName: string) => ReactNode
  /** The line at the foot of the panel: game, length, date */
  footer: string
  /** The share thumbnail: an image URL, null while it is being drawn */
  thumbnail: string | null
  /** Opens the share dialog; absent while the thumbnail is not ready */
  onShare?: () => void
  renderDetail?: ResultDetailRenderer
  /** The first time the panel opens: with lively motion the hero comes in part by part, the points count up and the rows follow one after the other */
  entrance?: boolean
}

/**
 * The end-of-game panel: the winners as the hero (avatar, crown, name, points, score breakdown), the others as a ranking, the
 * share thumbnail on its corner. Pure presentation, no game context: the connected `GameOver` feeds it from the game, the design docs
 * with samples. The look comes from `theme` (`UI_THEME.gameOver`) and `seat`; the box takes the room of its parent, a flex column.
 * On a short screen (`short`) the hero stands at the left and the ranking scrolls at the right.
 */
export function GameOverPanel({
  theme,
  seat,
  motion: mode,
  winners,
  others,
  labels,
  pattern,
  crown,
  footer,
  thumbnail,
  onShare,
  renderDetail,
  entrance = false,
}: GameOverPanelProps) {
  const lively = mode === "lively" && entrance
  const hero = GAME_OVER_TIMING.hero
  const Winner = winners.length === 1 ? SoloWinner : TiedWinner
  return (
    <div
      className="relative flex min-h-[26rem] flex-1 flex-col border-[0.5px] shadow-[0_24px_70px_rgb(0_0_0/65%)] short:min-h-0 short:flex-row"
      style={gameOverStyle(theme)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {pattern && <div className="absolute inset-0 bg-[length:128px_128px] opacity-[0.07]" style={{ backgroundImage: `url(${pattern})` }} />}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgb(255_255_255/8%),transparent_70%)]" />
      </div>
      <Polaroid label={labels.shareResult} thumbnail={thumbnail} onShare={onShare} />

      {/* On a short screen the hero is wide enough for the breakdown of a winner to stay on one line, whatever the number of winners */}
      <div className={cn("relative shrink-0 px-8 pt-6 pb-5 short:flex short:flex-col short:overflow-y-auto short:px-5 short:py-4", others.length > 0 && "short:w-[56%]")}>
        <div className="flex flex-col items-center gap-2 text-center short:my-auto">
          <p className="font-display text-sm tracking-[0.18em] whitespace-nowrap uppercase opacity-55 short:text-xs">
            {winners.length > 0 ? labels.winnerTitle : labels.scoreboard}
          </p>
          <div className="flex max-w-full min-w-0 flex-col items-center gap-5 short:gap-3">
            {winners.map((entry, i) => (
              <Winner
                key={entry.result.playerId}
                entry={entry}
                seat={seat}
                crown={crown}
                lively={lively}
                delay={hero + i * 0.14}
                points={labels.points}
                renderDetail={renderDetail}
              />
            ))}
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div className="relative min-h-0 flex-1 overflow-y-auto px-8 pb-6 [scrollbar-width:thin] short:border-l short:border-current/15 short:px-5 short:py-1 short:pb-1">
          <ol className="divide-y divide-current/15 border-t border-current/15 short:border-t-0">
            {others.map((entry, i) => (
              <motion.li
                key={entry.result.playerId}
                className="space-y-1.5 py-3 short:py-2.5"
                initial={lively ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: rowDelay(i), ease: EASE_STANDARD }}
              >
                <div className="flex items-center gap-3 short:gap-2">
                  <span className="font-display text-lg tabular-nums opacity-45">{entry.result.rank}.</span>
                  <SeatLabel
                    nickname={entry.nickname}
                    color={entry.color}
                    imageUrl={entry.imageUrl}
                    theme={seat}
                    className="min-w-0 flex-1 gap-3 font-sans text-lg font-black tracking-[0.14em] uppercase short:gap-2 short:text-base short:tracking-[0.1em]"
                    nameClassName={seat.name === "seat" ? "brightness-150" : undefined}
                  />
                  <span className="font-display text-3xl leading-none tabular-nums opacity-90 short:text-2xl">{labels.points(entry.result.total)}</span>
                </div>
                {renderDetail ? renderDetail(entry.result, { large: false, centered: false }) : <Details result={entry.result} />}
              </motion.li>
            ))}
          </ol>
        </div>
      )}

      <footer className="relative shrink-0 border-t border-current/10 px-8 py-3 text-center font-sans text-[11px] tracking-[0.12em] uppercase short:hidden">
        <span className="opacity-40">{footer}</span>
      </footer>
    </div>
  )
}
