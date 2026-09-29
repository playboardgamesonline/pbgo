"use client"

import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useState } from "react"
import { Logo } from "@pgo/binding-ui"
import type { RulesContent } from "../../lib/rules"
import { GameRulesButton as RulesButton } from "../rules-slot"
import { useSiteSettings } from "../settings-provider"
import { useText } from "../skin-provider"
import { SoundButton } from "../sound/sound"
import { Announcement, type AnnouncementSettings } from "./announcement"
import { useGame } from "./context"

/** Un tour de l'historique : l'auteur et les actions affichées (le rendu de chaque action appartient au jeu). */
export type HistoryTurn = { key: string | number; playerId: string; entries: { key: string | number; node: React.ReactNode }[] }

/**
 * Regroupe un journal en tours : un nouveau tour à chaque changement d'auteur ou après un événement qui clôt le tour.
 * `actor(e)` : auteur de l'événement (null = ignoré) ; `closes(e)` : l'événement termine le tour de son auteur (ex. pioche) ;
 * `render(e)` : rendu de l'action (null = pas affichée).
 */
export function groupTurns<E>(
  log: E[],
  { actor, closes, render }: { actor: (e: E) => string | null; closes?: (e: E) => boolean; render: (e: E) => React.ReactNode | null },
): HistoryTurn[] {
  const turns: (HistoryTurn & { done: boolean })[] = []
  log.forEach((e, i) => {
    const last = turns.at(-1)
    const who = actor(e)
    if (closes?.(e)) {
      if (last && last.playerId === who) last.done = true
      return
    }
    const node = render(e)
    if (!who || node == null) return
    if (!last || last.done || last.playerId !== who) turns.push({ key: i, playerId: who, entries: [{ key: i, node }], done: false })
    else last.entries.push({ key: i, node })
  })
  return turns.reverse()
}

export function PlayerName({ id }: { id: string }) {
  const { nickname, color } = useGame()
  return (
    <span className="font-black brightness-150" style={{ color: color(id) }}>
      {nickname(id)}
    </span>
  )
}

function TurnLabel({ playerId, short }: { playerId: string; short?: boolean }) {
  const t = useText()
  const { view } = useGame()
  if (playerId === view.me?.id) return <>{t(short ? "yourTurnShort" : "yourTurn")}</>
  const [before, after] = t(short ? "turnOfShort" : "turnOf").split("{name}")
  return (
    <>
      {before}
      <PlayerName id={playerId} />
      {after}
    </>
  )
}

/** Bandeau en haut à droite : à qui le tour, puis l'historique (du plus récent au plus ancien). */
export function Ticker({
  activePlayerId,
  idle,
  status,
  history,
}: {
  activePlayerId: string | null
  /** Texte quand personne n'a la main (par défaut « La partie se prépare… » / « Fin de la partie ») */
  idle?: string
  /** Informations globales sous la ligne principale (manche, jetons…) */
  status?: React.ReactNode
  history: HistoryTurn[]
}) {
  const t = useText()
  const { view } = useGame()
  const waiting = idle ?? (view.phase === "over" ? t("gameOver") : t("waiting"))
  return (
    <div className="flex max-w-lg flex-col items-end text-right text-foreground [text-shadow:0_1px_4px_rgb(0_0_0/60%)]">
      <motion.p
        key={activePlayerId ?? waiting}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="inline-flex items-center gap-1.5 font-display text-lg tracking-[0.14em] uppercase md:text-xl"
      >
        {activePlayerId ? <TurnLabel playerId={activePlayerId} /> : waiting}
      </motion.p>
      {status && <div className="mt-1 font-display text-sm tracking-[0.18em] text-foreground/60 uppercase tabular-nums">{status}</div>}
      {history.length > 0 && (
        <>
          <div className="my-3 h-px w-full min-w-64 bg-white/25" />
          <div
            className="pointer-events-auto max-h-[12.5rem] w-full overflow-y-auto pr-1 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
            }}
          >
            <ol className="flex flex-col items-end gap-5 text-lg md:text-xl">
              {history.map((turn) => (
                <motion.li
                  key={turn.key}
                  layout="position"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-end gap-2.5"
                >
                  <span className="inline-flex items-center gap-1 font-display text-xs tracking-[0.18em] text-foreground/55 uppercase md:text-sm">
                    <TurnLabel playerId={turn.playerId} short />
                  </span>
                  {turn.entries.map((entry) => (
                    <motion.div key={entry.key} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      {entry.node}
                    </motion.div>
                  ))}
                </motion.li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Écran de partie standard : la table (children) en plein écran ; en haut à gauche le logo (qui quitte la partie) avec son et règles dessous ;
 * en haut à droite le bandeau (`ticker`) sur un voile sombre ; `overlay` pour les boutons et panneaux propres au jeu.
 */
export function GameHud({
  rules,
  onLeave,
  ticker,
  overlay,
  children,
}: {
  rules: RulesContent
  onLeave: () => void
  ticker?: React.ReactNode
  overlay?: React.ReactNode
  children: React.ReactNode
}) {
  const t = useText()
  const { logo, title } = useSiteSettings()
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0">{children}</div>
      {ticker && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 z-10 h-[30rem] w-[52rem] max-w-full"
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 100% 0%, rgb(0 0 0 / 62%) 0%, rgb(0 0 0 / 40%) 35%, rgb(0 0 0 / 14%) 65%, transparent 100%)",
          }}
        />
      )}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-6 pt-5 pb-8">
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          <button type="button" className="w-40 cursor-pointer transition-transform hover:scale-105 sm:w-48" title={t("leave")} onClick={onLeave}>
            {logo ? <Logo src={logo} alt={title} /> : <span className="font-display text-2xl font-black tracking-[0.12em] uppercase">{title}</span>}
          </button>
          <div className="flex items-center justify-center gap-1">
            <SoundButton />
            <RulesButton rules={rules} />
          </div>
        </div>
        {ticker}
      </header>
      {overlay}
    </main>
  )
}

type Queued<T extends string> = { id: number; text: string; subtitle?: string; type: T; sound?: string }
let counter = 0

/**
 * File d'annonces plein écran : `announce(text, type, { subtitle, sound, replace })`, une à la fois, chacune pendant la durée de son préréglage.
 * `replace` retire de la file les annonces des types donnés (ex. « votre tour » périmé) ; `first` la place en tête.
 */
export function useAnnouncements<T extends string>(settings: Record<T, AnnouncementSettings>, { paused = false }: { paused?: boolean } = {}) {
  const [queue, setQueue] = useState<Queued<T>[]>([])
  // en pause (ex. pendant l'ouverture), la file attend sans rien afficher
  const current = paused ? null : (queue[0] ?? null)
  const announce = useCallback((text: string, type: T, options: { subtitle?: string; sound?: string; replace?: T[]; first?: boolean } = {}) => {
    const item = { id: ++counter, text, type, subtitle: options.subtitle, sound: options.sound }
    setQueue((q) => {
      const kept = options.replace ? q.filter((x) => !options.replace!.includes(x.type)) : q
      return options.first ? [item, ...kept] : [...kept, item]
    })
  }, [])
  const clear = useCallback(() => setQueue([]), [])
  const duration = current ? settings[current.type].duration : 0
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), duration * 1000)
    return () => clearTimeout(timer)
  }, [current, duration])
  const element = (
    <AnimatePresence>
      {current && <Announcement key={current.id} text={current.text} subtitle={current.subtitle} settings={settings[current.type]} sound={current.sound} />}
    </AnimatePresence>
  )
  return { announce, clear, current, element }
}
