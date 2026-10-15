"use client"

import type { PlayerResult } from "@pbgo/engine-kit"
import { CheckIcon, CrownIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { LinkForwardIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { SharePreview } from "./preview-sharing"
import { generateShareImage, type ShareRow } from "./sharing"
import { AnimatePresence, motion } from "motion/react"
import { Fragment, useEffect, useState } from "react"
import { toast } from "sonner"
import type { CoreView } from "../../lib/binding"
import { useApi, useBinding } from "../../lib/binding-context"
import { formatDateTime } from "../../lib/format-date"
import type { PublicGame } from "../../lib/game-types"
import { EASE_STANDARD, fade, travel } from "../../lib/motion-preference"
import { useMotion } from "../../lib/use-motion"
import { cn } from "@pbgo/ui/utils"
import { useSiteSettings } from "../settings-provider"
import { useSkin, useText } from "../skin-provider"
import { HostIcon } from "../lobby/lobby"
import { useGame } from "./context"
import { HUD_TEXT, HUD_TITLE, HudButton, readableColor } from "./hud-ui"
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
 */
export function winnerAnnouncement(game: PublicGame, view: CoreView, phrases: string[] = DEFAULT_SKIN.victoryPhrases, pointsText = defaultPointsText) {
  const results = view.results
  if (!results) return { phrase: "", detail: "" }
  const winners = results.players.filter((j) => results.winners.includes(j.playerId))
  const template = phrases[hash(game.code + (view.log?.length ?? 0)) % phrases.length] ?? ""
  const phrase = template.split("{pseudo}")[0]!.replace("{points}", String(winners[0]?.total ?? 0)).replace(/[\s:,–-]+$/, "").trim()
  const names = winners.map((j) => game.players.find((x) => x.id === j.playerId)?.nickname).join(" & ")
  return { phrase, detail: `${names} · ${pointsText(winners[0]?.total ?? 0)}` }
}

function Details({ j, large, centered }: { j: PlayerResult; large?: boolean; centered?: boolean }) {
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`
  return (
    <div className={cn("flex flex-wrap items-center", centered ? "justify-center" : "justify-start", large ? "gap-2" : "gap-1.5")}>
      {j.detail.map((d) => (
        <span
          key={d.key}
          title={`${d.label} : ${sign(d.points)}`}
          className={cn(
            HUD_TEXT,
            "flex shrink-0 items-center gap-1.5 rounded-md bg-hud-foreground/10 text-hud-foreground tabular-nums",
            large ? "h-8 px-3 text-sm" : "h-7 px-2.5 text-xs",
            d.points === 0 && "opacity-50",
          )}
        >
          <span className="text-hud-muted">{d.label}</span>
          {sign(d.points)}
        </span>
      ))}
    </div>
  )
}

export type ResultDetailRenderer = (result: PlayerResult, options: { large: boolean; centered: boolean }) => React.ReactNode

/**
 * End-of-game board: winner(s), ranking, "Replay (x/n)", show / hide, share.
 * A flat panel over a scrim, centred; the show / hide pill sits on the top edge, the replay button on the bottom one, the share
 * button in the corner of the panel.
 * `renderDetail`: the game's own rendering of a player's score breakdown (default: `label +n` chips).
 *
 * On a short viewport (a phone held sideways) the panel scrolls as a whole and the show / hide pill shrinks to its icon.
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
  const { GAME, NAME, SLUG } = useBinding()
  const api = useApi()
  const motionMode = useMotion()
  const { hostIcon, locale } = useSkin()
  const { view, game, color } = useGame()
  const { title } = useSiteSettings()
  const [sending, setSending] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)
  const results = view.phase === "over" ? view.results : null
  const info = (id: string) => game.players.find((j) => j.id === id)

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

  if (!results) return null
  const winners = results.players.filter((j) => results.winners.includes(j.playerId))
  const ranking = [...results.players].sort((a, b) => a.rank - b.rank)
  const others = ranking.filter((j) => !results.winners.includes(j.playerId))
  const alreadyVoted = !!game.meId && game.replay.includes(game.meId)
  const lively = motionMode === "lively"
  const nameOf = (id: string) => info(id)?.nickname
  const points = (total: number) => `${total > 0 ? "+" : ""}${t("pointsShort", { points: total })}`

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
  const names = winners.map((v) => nameOf(v.playerId)).join(" & ")
  const shareText = t("winsWith", { names, points: winners[0]?.total ?? 0 })
  const panelFrom = { opacity: 0, y: travel(motionMode, 16), scale: lively ? 0.97 : 1 }
  const panelTransition = lively ? { type: "spring" as const, stiffness: 200, damping: 24 } : { duration: fade(motionMode, 0.25), ease: EASE_STANDARD }
  const toggleLabel = isOpen ? t("hideScores") : t("showScores")

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
            transition={{ duration: fade(motionMode, 0.25), ease: EASE_STANDARD }}
            className="fixed inset-0 z-40 bg-hud-backdrop"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center px-6 pt-20 pb-24 short:pt-14 short:pb-[4.5rem]">
        <AnimatePresence mode="popLayout">
          {isOpen && (
            <motion.section
              key="scoreboard"
              role="dialog"
              aria-label={t("scoreboard")}
              initial={panelFrom}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={panelFrom}
              transition={panelTransition}
              className="pointer-events-auto relative flex max-h-full w-full max-w-lg flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-hud-surface text-hud-foreground shadow-overlay ring-1 ring-hud-border">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden short:overflow-y-auto">
                  <header className="relative shrink-0 px-6 pt-6 pb-5 text-center short:pt-4 short:pb-3">
                    <HudButton
                      variant="quiet"
                      size="sm"
                      title={t("shareResult")}
                      aria-label={t("shareResult")}
                      onClick={() => setPreview(true)}
                      disabled={!image}
                      className="absolute top-3 right-3 w-8 px-0 short:top-2 short:right-2"
                    >
                      <HugeiconsIcon icon={LinkForwardIcon} strokeWidth={1.8} className="size-4" />
                    </HudButton>
                    <p className={cn(HUD_TEXT, "text-sm text-hud-muted")}>{t("winnerTitle")}</p>
                    <div className="mt-2 flex flex-col items-center gap-1 short:mt-1">
                      {hostIcon ? (
                        <HostIcon className="inline-block size-7 shrink-0 bg-hud-accent" />
                      ) : (
                        <CrownIcon aria-hidden className="size-7 fill-hud-accent text-hud-accent" />
                      )}
                      <p className={cn(HUD_TITLE, "text-3xl leading-tight text-balance short:text-2xl")}>
                        {winners.map((v, i) => (
                          <Fragment key={v.playerId}>
                            {i > 0 && <span className="text-hud-muted"> & </span>}
                            <span style={{ color: readableColor(color(v.playerId)) }}>{nameOf(v.playerId)}</span>
                          </Fragment>
                        ))}
                      </p>
                      <p className={cn(HUD_TEXT, "text-xl text-hud-accent tabular-nums short:text-lg")}>{points(winners[0]?.total ?? 0)}</p>
                    </div>
                    <div className="mt-4 space-y-3 short:mt-2 short:space-y-2">
                      {winners.map((v) => (
                        <div key={v.playerId} className="space-y-1.5">
                          {winners.length > 1 && (
                            <p className={cn(HUD_TEXT, "text-sm")} style={{ color: readableColor(color(v.playerId)) }}>
                              {nameOf(v.playerId)}
                            </p>
                          )}
                          {renderDetail ? renderDetail(v, { large: true, centered: true }) : <Details j={v} large centered />}
                        </div>
                      ))}
                    </div>
                  </header>

                  {others.length > 0 && (
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 [scrollbar-width:thin] short:flex-none short:overflow-visible">
                      <ol className="divide-y divide-hud-border border-t border-hud-border">
                        {others.map((j) => (
                          <li key={j.playerId} className="space-y-2 py-3 short:py-2">
                            <div className="flex items-baseline gap-2">
                              <span className={cn(HUD_TEXT, "text-base text-hud-muted tabular-nums")}>{j.rank}.</span>
                              <span className={cn(HUD_TEXT, "min-w-0 flex-1 truncate text-lg")} style={{ color: readableColor(color(j.playerId)) }} title={nameOf(j.playerId)}>
                                {nameOf(j.playerId)}
                              </span>
                              <span className={cn(HUD_TEXT, "text-xl leading-none tabular-nums")}>{points(j.total)}</span>
                            </div>
                            {renderDetail ? renderDetail(j, { large: false, centered: false }) : <Details j={j} />}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                <footer className={cn(HUD_TEXT, "shrink-0 border-t border-hud-border px-6 py-3 text-center text-xs text-hud-muted short:hidden")}>{footer}</footer>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-[max(1.5rem,env(safe-area-inset-top))] z-50 flex justify-center short:top-[max(0.75rem,env(safe-area-inset-top))]">
        <HudButton variant="floating" size="sm" title={toggleLabel} onClick={onToggle} className="pointer-events-auto rounded-full short:w-8 short:px-0">
          {isOpen ? <EyeOffIcon aria-hidden className="size-4" /> : <EyeIcon aria-hidden className="size-4" />}
          <span className="short:sr-only">{toggleLabel}</span>
        </HudButton>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center short:bottom-[max(0.75rem,env(safe-area-inset-bottom))]">
        <HudButton
          variant={alreadyVoted ? "floating" : "primary"}
          size="lg"
          onClick={replay}
          disabled={sending || alreadyVoted}
          className={cn("pointer-events-auto shadow-float short:h-10", alreadyVoted && "text-hud-muted disabled:opacity-100")}
        >
          {alreadyVoted && <CheckIcon aria-hidden className="size-4" />}
          {t("replay")} ({game.replay.length}/{game.players.length})
        </HudButton>
      </div>
    </>
  )
}
