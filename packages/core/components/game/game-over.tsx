"use client"

import type { PlayerResult } from "@pbgo/engine-kit"
import { CrownIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { LinkForwardIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { SharePreview } from "./preview-sharing"
import { generateShareImage, type ShareRow } from "./sharing"
import { animate, AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { PrimaryButton } from "../home/screen"
import type { CoreView } from "../../lib/binding"
import { useApi, useBinding } from "../../lib/binding-context"
import { formatDateTime } from "../../lib/format-date"
import { GAME_OVER_TIMING, pointsLine, rowDelay, sectionMotion, signed, splitResults, type GameOverEntry } from "../../lib/game-over"
import type { PublicGame } from "../../lib/game-types"
import { EASE_STANDARD, fade, type Motion } from "../../lib/motion-preference"
import { seatAvatar } from "../../lib/seat-avatar"
import { gameOverStyle, gameOverTheme, type GameOverTheme, type SeatTheme } from "../../lib/ui-theme"
import { useMotion } from "../../lib/use-motion"
import { cn } from "@pbgo/ui/utils"
import { useSiteSettings } from "../settings-provider"
import { useSkin, useText } from "../skin-provider"
import { HostIcon } from "../lobby/lobby"
import { useGame } from "./context"
import { SeatAvatarMark, SeatLabel, useSeatTheme } from "./seat-label"
import { DEFAULT_SKIN, fill } from "../../lib/skin"

function hash(text: string) {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

const defaultPointsText = (points: number) => fill(DEFAULT_SKIN.texts.pointsShort, { points })

/**
 * Victory sentence picked from the skin's phrases with a deterministic hash (everyone sees the same one).
 * Template `{pseudo}` / `{points}`: the announcement keeps what comes before `{pseudo}`, the names and points go in the subtitle.
 * `pointsText` writes the winner's points in that subtitle: pass `(points) => t("pointsShort", { points })` for the visitor's language (default: French).
 * `winners`: their player ids, in ranking order (for the medallions of the victory announcement, `seatsOf`).
 */
export function winnerAnnouncement(
  game: PublicGame,
  view: CoreView,
  phrases: string[] = DEFAULT_SKIN.victoryPhrases,
  pointsText = defaultPointsText,
): { phrase: string; detail: string; winners: string[] } {
  const results = view.results
  if (!results) return { phrase: "", detail: "", winners: [] }
  const winners = results.players.filter((j) => results.winners.includes(j.playerId))
  const template = phrases[hash(game.code + (view.log?.length ?? 0)) % phrases.length] ?? ""
  const phrase = template.split("{pseudo}")[0]!.replace("{points}", String(winners[0]?.total ?? 0)).replace(/[\s:,–-]+$/, "").trim()
  const names = winners.map((v) => game.players.find((j) => j.id === v.playerId)?.nickname).join(" & ")
  return { phrase, detail: `${names} · ${pointsText(winners[0]?.total ?? 0)}`, winners: winners.map((v) => v.playerId) }
}

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
 * share thumbnail on its corner. Pure presentation, no game context: the connected `GameOver` feeds it from the game, `/design`
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
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg tabular-nums opacity-45">{entry.result.rank}.</span>
                  <SeatLabel
                    nickname={entry.nickname}
                    color={entry.color}
                    imageUrl={entry.imageUrl}
                    theme={seat}
                    className="min-w-0 flex-1 gap-3 font-sans text-lg font-black tracking-[0.14em] uppercase"
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

/**
 * End-of-game board: winner(s), ranking, "Replay (x/n)", show / hide, share thumbnail.
 * `renderDetail`: the game's own rendering of a player's score breakdown (default: `label +n` chips).
 * The look is the game's `UI_THEME.gameOver` and `UI_THEME.seat`, how much it moves its `UI_THEME.motion`.
 */
export function GameOver({
  onUpdate,
  isOpen,
  onToggle,
  renderDetail,
}: {
  onUpdate: (p: PublicGame) => void
  isOpen: boolean
  onToggle: () => void
  renderDetail?: ResultDetailRenderer
}) {
  const t = useText()
  const { GAME, NAME, SLUG, UI_THEME } = useBinding()
  const api = useApi()
  const { hostIcon, decor, locale } = useSkin()
  const { view, game, nickname, color, avatarUrl } = useGame()
  const { title } = useSiteSettings()
  const seat = useSeatTheme()
  const mode = useMotion()
  const theme = useMemo(() => gameOverTheme(UI_THEME?.gameOver), [UI_THEME?.gameOver])
  const [sending, setSending] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)
  const [seenKey, setSeenKey] = useState<string | null>(null)
  const results = view.phase === "over" ? view.results : null

  const resultsKey = results ? `${game.code}|${results.winners.join()}|${results.players.map((j) => `${j.playerId}:${j.total}`).join()}` : null
  useEffect(() => {
    if (!results) return
    let cancelled = false
    const lines: ShareRow[] = [...results.players]
      .sort((a, b) => a.rank - b.rank)
      .map((j) => ({
        rank: j.rank,
        nickname: game.players.find((x) => x.id === j.playerId)?.nickname ?? "?",
        color: color(j.playerId),
        total: j.total,
        winner: results.winners.includes(j.playerId),
      }))
    const timer = setTimeout(() => {
      generateShareImage(lines, SLUG, game.code, title, locale, t)
        .then((f) => !cancelled && setImage(f))
        .catch(() => !cancelled && toast.error(t("imageError")))
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey, locale])

  // The first opening plays the panel's flourish; hiding the scores and showing them back does not play it again
  const shown = isOpen && !!resultsKey
  useEffect(() => {
    if (!shown) return
    const id = setTimeout(() => setSeenKey(resultsKey), 2000)
    return () => clearTimeout(id)
  }, [shown, resultsKey])

  const url = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  if (!results) return null
  const { winners, others } = splitResults(results)
  const entry = (result: PlayerResult): GameOverEntry => ({
    result,
    nickname: nickname(result.playerId),
    color: color(result.playerId),
    imageUrl: avatarUrl(result.playerId),
  })
  const alreadyVoted = !!game.meId && game.replay.includes(game.meId)

  async function replay() {
    setSending(true)
    try {
      onUpdate(await api.replay(game.code))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const replayButton = (
    <div className="pointer-events-auto">
      <PrimaryButton onClick={replay} busy={sending} waiting={alreadyVoted} className="h-14 w-auto max-w-none rounded-t-2xl rounded-b-none px-10 whitespace-nowrap shadow-[0_-6px_24px_rgb(0_0_0/35%)] hover:scale-100 hover:brightness-110 short:h-11">
        {t("replay")} ({game.replay.length}/{game.players.length})
      </PrimaryButton>
    </div>
  )
  const created = game.createdAt ? new Date(game.createdAt) : null
  const ended = game.updatedAt ? new Date(game.updatedAt) : null
  const minutes = created && ended ? Math.max(1, Math.round((ended.getTime() - created.getTime()) / 60000)) : null
  const footer = [
    GAME?.name ?? NAME,
    minutes !== null ? (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`) : null,
    ended ? formatDateTime(ended, locale) : null,
    "PBGO",
  ]
    .filter(Boolean)
    .join("  ·  ")
  const names = winners.map((v) => nickname(v.playerId)).join(" & ")
  const shareText = t("winsWith", { names, points: winners[0]?.total ?? 0 })

  return (
    <>
      <SharePreview file={preview ? image : null} text={shareText} onClose={() => setPreview(false)} />
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: fade(mode, 0.3) }}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-[2px]"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center px-6 pt-20 pb-[calc(var(--spacing)*28+var(--consent-h,0px))] short:pt-12 short:pb-[calc(var(--spacing)*14+var(--consent-h,0px))]">
        <AnimatePresence mode="popLayout">
          {isOpen && (
            <motion.section
              key="scoreboard"
              role="dialog"
              aria-label={t("scoreboard")}
              {...sectionMotion(mode)}
              className="pointer-events-auto relative flex max-h-full w-full max-w-lg flex-col short:max-w-2xl"
            >
              <GameOverPanel
                theme={theme}
                seat={seat}
                motion={mode}
                winners={winners.map(entry)}
                others={others.map(entry)}
                labels={{
                  scoreboard: t("scoreboard"),
                  winnerTitle: t("winnerTitle"),
                  shareResult: t("shareResult"),
                  points: (n) => pointsLine(n, (points) => t("pointsShort", { points })),
                }}
                pattern={decor.pattern}
                crown={(size) =>
                  hostIcon ? (
                    <HostIcon className={cn("inline-block shrink-0 bg-current", size)} />
                  ) : (
                    <CrownIcon aria-hidden className={cn("fill-current text-current", size)} />
                  )
                }
                footer={footer}
                thumbnail={url}
                onShare={image ? () => setPreview(true) : undefined}
                renderDetail={renderDetail}
                entrance={seenKey !== resultsKey}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--spacing)*6)] z-50 flex justify-center short:top-[calc(var(--spacing)*2)]">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={isOpen}
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm text-white opacity-80 transition-opacity duration-200 [text-shadow:0_1px_6px_rgb(0_0_0/80%)] hover:opacity-100 motion-reduce:transition-none"
        >
          {isOpen ? <EyeOffIcon strokeWidth={1.6} className="size-5" /> : <EyeIcon strokeWidth={1.6} className="size-5" />}
          <span className="underline underline-offset-4">{isOpen ? t("hideScores") : t("showScores")}</span>
        </button>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-[var(--consent-h,0px)] z-50 flex justify-center">{replayButton}</div>
    </>
  )
}
