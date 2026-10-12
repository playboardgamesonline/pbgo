"use client"

import { AnimatePresence, motion } from "motion/react"
import { Fragment, useCallback, useEffect, useState } from "react"
import { useBinding } from "../../lib/binding-context"
import { useSiteSettings } from "../settings-provider"
import { useText } from "../skin-provider"
import { Toolbar } from "../toolbar"
import { Chat } from "./chat"
import { Announcement, type AnnouncementSettings } from "./announcement"
import { useGame } from "./context"

/** One turn of the history: its author and the actions shown (each action is rendered by the game). */
export type HistoryTurn = { key: string | number; playerId: string; entries: { key: string | number; node: React.ReactNode }[] }

/**
 * Groups a log into turns: a new turn on each change of author or after an event that ends the turn.
 * `actor(e)`: author of the event (null = ignored); `closes(e)`: the event ends its author's turn (e.g. a draw);
 * `render(e)`: rendering of the action (null = not shown).
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

/** "Waiting for A, B": several players are expected at once (a simultaneous step), each name in its player's color. */
function WaitingLabel({ playerIds }: { playerIds: readonly string[] }) {
  const t = useText()
  const [before, after] = t("waitingFor").split("{names}")
  return (
    <>
      {before}
      {playerIds.map((id, i) => (
        <Fragment key={id}>
          {i > 0 && ", "}
          <PlayerName id={id} />
        </Fragment>
      ))}
      {after}
    </>
  )
}

/**
 * Top-right banner: whose turn it is, then the history (newest first).
 *
 * `waitingFor` (`game.waitingFor`, what the game waits for) decides the main line when it is given: "Your turn" when I am one of
 * the players, "Waiting for A, B" when several others are, that player's turn when it is one. A board that holds the
 * announcement back (Courtisans during its opening animation) leaves it out. Without it, `activePlayerId` is whose turn it is.
 */
export function Ticker({
  activePlayerId,
  waitingFor,
  idle,
  status,
  history,
}: {
  activePlayerId: string | null
  waitingFor?: readonly string[]
  /** Text when nobody has to play (default: the "waiting" / "game over" labels) */
  idle?: string
  /** Global information under the main line (round, tokens…) */
  status?: React.ReactNode
  history: HistoryTurn[]
}) {
  const t = useText()
  const { view } = useGame()
  const waiting = idle ?? (view.phase === "over" ? t("gameOver") : t("waiting"))
  const me = view.me?.id
  const mine = me && waitingFor?.includes(me) ? me : null
  const several = waitingFor && !mine && waitingFor.length > 1 ? waitingFor : null
  const turn = waitingFor ? (mine ?? (waitingFor.length === 1 ? waitingFor[0]! : null)) : activePlayerId
  const key = several ? several.join(",") : (turn ?? waiting)
  return (
    <div className="flex max-w-lg flex-col items-end text-right text-foreground [text-shadow:0_1px_4px_rgb(0_0_0/60%)]">
      <motion.p
        key={key}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="inline-flex items-center gap-1.5 font-display text-lg tracking-[0.14em] uppercase md:text-xl"
      >
        {several ? <WaitingLabel playerIds={several} /> : turn ? <TurnLabel playerId={turn} /> : waiting}
      </motion.p>
      {status && <div className="mt-1 font-display text-sm tracking-[0.18em] text-foreground/60 uppercase tabular-nums">{status}</div>}
      <div className="my-3 h-px w-full min-w-64 bg-white/25" />
      {history.length > 0 && (
        <>
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
 * Standard game screen: the table (children) full screen; top left the logo (which leaves the game) with sound and rules below it;
 * top right the banner (`ticker`) on a dark veil; `overlay` for the game's own buttons and panels.
 */
export function GameHud({
  onLeave,
  ticker,
  overlay,
  children,
}: {
  onLeave: () => void
  ticker?: React.ReactNode
  overlay?: React.ReactNode
  children: React.ReactNode
}) {
  const t = useText()
  const { Logo } = useBinding()
  const { game } = useGame()
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
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <button type="button" className="w-40 cursor-pointer transition-transform hover:scale-105 sm:w-48" title={t("leave")} onClick={onLeave}>
            {logo ? <Logo src={logo} alt={title} /> : <span className="font-display text-2xl font-black tracking-[0.12em] uppercase">{title}</span>}
          </button>
          <Toolbar gameCode={game.code} options={game.options} />
        </div>
        {ticker}
      </header>
      {overlay}
      <Chat />
    </main>
  )
}

type Queued<T extends string> = { id: number; text: string; subtitle?: string; type: T; sound?: string }
let counter = 0

/**
 * Queue of full-screen announcements: `announce(text, type, { subtitle, sound, replace })`, one at a time, each for its preset's duration.
 * `replace` drops the queued announcements of the given types (e.g. a stale "your turn"); `first` puts it at the front.
 */
export function useAnnouncements<T extends string>(settings: Record<T, AnnouncementSettings>, { paused = false }: { paused?: boolean } = {}) {
  const [queue, setQueue] = useState<Queued<T>[]>([])
  // paused (e.g. during the opening), the queue waits without showing anything
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
