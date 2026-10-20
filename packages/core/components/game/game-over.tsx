"use client"

import type { PlayerResult } from "@pbgo/engine-kit"
import { CrownIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { GameOverPanel, type ResultDetailRenderer } from "./game-over-panel"
import { SharePreview } from "./preview-sharing"
import { generateShareImage, type ShareRow } from "./sharing"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PrimaryButton } from "../home/screen"
import type { CoreView } from "../../lib/binding"
import { useApi, useBinding } from "../../lib/binding-context"
import { formatDateTime } from "../../lib/format-date"
import { pointsLine, sectionMotion, splitResults, type GameOverEntry } from "../../lib/game-over"
import type { PublicGame } from "../../lib/game-types"
import { fade } from "../../lib/motion-preference"
import { gameOverTheme } from "../../lib/ui-theme"
import { useMotion } from "../../lib/use-motion"
import { cn } from "@pbgo/ui/utils"
import { useSiteSettings } from "../settings-provider"
import { useSkin, useText } from "../skin-provider"
import { HostIcon } from "../lobby/lobby"
import { useGame } from "./context"
import { useSeatTheme } from "./seat-label"
import { DEFAULT_SKIN, fill } from "../../lib/skin"

export type { GameOverLabels, GameOverPanelProps, ResultDetailRenderer } from "./game-over-panel"

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
