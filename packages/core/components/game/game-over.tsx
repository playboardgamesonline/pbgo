"use client"

import type { PlayerResult, PlayerView } from "@pgo/binding"
import { CrownIcon } from "lucide-react"
import { LinkForwardIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { SharePreview } from "./preview-sharing"
import { generateShareImage, type ShareRow } from "./sharing"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PrimaryButton } from "../home/screen"
import { api } from "../../lib/api"
import type { PublicGame } from "../../lib/game-types"
import { cn } from "@pgo/ui/utils"
import { useSiteSettings } from "../settings-provider"
import { useText } from "../skin-provider"
import { useGame } from "./context"
import { DEFAULT_SKIN } from "../../lib/skin"

function hash(text: string) {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/**
 * Phrase de victoire tirée des phrases de l'habillage par un hash déterministe (tout le monde voit la même).
 * Gabarit `{pseudo}` / `{points}` : l'annonce garde ce qui précède `{pseudo}`, les noms et les points passent en sous-titre.
 */
export function winnerAnnouncement(game: PublicGame, view: PlayerView, phrases: string[] = DEFAULT_SKIN.victoryPhrases) {
  const results = view.results
  if (!results) return { phrase: "", detail: "" }
  const winners = results.players.filter((j) => results.winners.includes(j.playerId))
  const template = phrases[hash(game.code + view.log.length) % phrases.length] ?? ""
  const phrase = template.split("{pseudo}")[0]!.replace("{points}", String(winners[0]?.total ?? 0)).trim()
  const names = winners.map((v) => game.players.find((j) => j.id === v.playerId)?.nickname).join(" & ")
  return { phrase, detail: `${names} · ${winners[0]?.total ?? 0} pts` }
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
            "flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/10 font-display font-bold text-white/90 tabular-nums",
            large ? "h-8 px-3 text-sm" : "h-7 px-2.5 text-xs",
          )}
          style={{ opacity: d.points === 0 ? 0.45 : 1 }}
        >
          <span className="font-sans font-medium text-white/60">{d.label}</span>
          {sign(d.points)}
        </span>
      ))}
    </div>
  )
}

export type ResultDetailRenderer = (result: PlayerResult, options: { large: boolean; centered: boolean }) => React.ReactNode

/**
 * Tableau de fin : vainqueur(s), classement, « Rejouer (x/n) », afficher / masquer, vignette de partage.
 * `renderDetail` : rendu propre au jeu du détail des points d'un joueur (par défaut, des pastilles `label +n`).
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
    const t = setTimeout(() => {
      generateShareImage(lines, game.code, title)
        .then((f) => !cancelled && setImage(f))
        .catch(() => !cancelled && toast.error("Impossible de générer l'image du résultat"))
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey])

  const url = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  if (!results) return null
  const winners = results.players.filter((j) => results.winners.includes(j.playerId))
  const ranking = [...results.players].sort((a, b) => a.rank - b.rank)
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

  const shareText = `${winners.map((v) => info(v.playerId)?.nickname).join(" & ")} remporte la partie avec ${winners[0]?.total ?? 0} points !`
  const names = winners.map((v) => info(v.playerId)?.nickname).join(" & ")

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
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-[2px]"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 bottom-[10rem] z-40 flex flex-col items-center justify-end px-6 pt-6"
      >
        <AnimatePresence mode="popLayout">
          {isOpen && (
            <motion.section
              key="scoreboard"
              role="dialog"
              aria-label="Tableau des scores"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              className="pointer-events-auto relative flex max-h-full w-full max-w-lg flex-col"
            >

              <div className="relative flex min-h-[26rem] flex-1 flex-col overflow-hidden rounded-lg border border-accent-game/70 bg-surface shadow-[0_24px_70px_rgb(0_0_0/65%)]">
                            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgb(255_255_255/8%),transparent_70%)]" />
              <div className="relative shrink-0 px-8 pt-6 pb-5">
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  disabled={!image}
                  title="Partager le résultat"
                  aria-label="Partager le résultat"
                  className="group absolute -top-3 -right-10 z-20 w-40 rotate-[5deg] cursor-pointer rounded-[3px] bg-[#f3ecd6] p-[2px] shadow-[0_10px_24px_rgb(0_0_0/55%)] transition-transform duration-200 hover:rotate-[1deg] disabled:cursor-wait"
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-[2px] bg-surface-dark">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="size-full scale-[1.35] object-cover" style={{ transformOrigin: "50% 58%" }} />
                    ) : (
                      <span className="block size-full animate-pulse bg-surface" />
                    )}
                  </span>
                  <span className="absolute top-1/2 left-[30%] flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#f3ecd6]/50 bg-surface-dark text-foreground shadow-md transition-transform group-hover:scale-110">
                    <HugeiconsIcon icon={LinkForwardIcon} strokeWidth={1.8} className="size-4" />
                  </span>
                </button>
                <div className="relative flex flex-col items-center gap-1.5 px-20 text-center">
                  <p className="-mx-16 font-display text-sm tracking-[0.18em] whitespace-nowrap text-foreground/55 uppercase">Victoire de</p>
                  <CrownIcon aria-hidden className="relative z-10 -mt-1 size-9 fill-accent-game text-accent-game drop-shadow-[0_0_12px_var(--accent-game)]" />
                  <p className="font-sans text-4xl font-black tracking-[0.16em] uppercase brightness-150" style={{ color: color(winners[0]!.playerId) }}>
                    {names}
                  </p>
                  <p className="font-display text-2xl text-accent-game tabular-nums">
                    {winners[0]!.total > 0 ? "+" : ""}
                    {winners[0]!.total} pts
                  </p>
                  <div className="mt-2 space-y-2">
                    {winners.map((v) => (
                      <div key={v.playerId}>{renderDetail ? renderDetail(v, { large: true, centered: true }) : <Details j={v} large centered />}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-auto px-8 pb-20 [scrollbar-width:thin]">
                <ol className="divide-y divide-foreground/15 border-t border-foreground/15">
                  {ranking
                    .filter((j) => !results.winners.includes(j.playerId))
                    .map((j) => (
                      <li key={j.playerId} className="space-y-2 py-3.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-lg text-foreground/45 tabular-nums">{j.rank}.</span>
                          <span className="min-w-0 flex-1 truncate font-sans text-lg font-black tracking-[0.14em] uppercase brightness-150" style={{ color: color(j.playerId) }}>
                            {info(j.playerId)?.nickname}
                          </span>
                          <span className="font-display text-3xl leading-none text-foreground/90 tabular-nums">
                            {j.total > 0 ? "+" : ""}
                            {j.total} pts
                          </span>
                        </div>
                        {renderDetail ? renderDetail(j, { large: false, centered: false }) : <Details j={j} />}
                      </li>
                    ))}
                </ol>
              </div>

              </div>
              <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-1/2">
                <PrimaryButton onClick={replay} busy={sending} disabled={alreadyVoted} className="w-auto max-w-none px-8 whitespace-nowrap">
                  {t("replay")} ({game.replay.length}/{game.players.length})
                </PrimaryButton>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="pointer-events-auto fixed bottom-8 left-1/2 z-50 h-9 -translate-x-1/2 cursor-pointer px-4 font-display text-sm tracking-wide whitespace-nowrap text-foreground/75 uppercase underline-offset-4 transition-colors duration-200 [text-shadow:0_1px_6px_rgb(0_0_0/80%)] hover:text-foreground hover:underline"
        >
          {isOpen ? "Masquer le tableau des scores" : "Afficher le tableau des scores"}
        </button>
    </>
  )
}
