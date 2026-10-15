"use client"

import { ChevronDownIcon } from "lucide-react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { Fragment, useCallback, useEffect, useId, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { useBinding } from "../../lib/binding-context"
import { EASE_STANDARD, fade, travel } from "../../lib/motion-preference"
import { hudStyle } from "../../lib/ui-theme"
import { useMotion } from "../../lib/use-motion"
import { useSiteSettings } from "../settings-provider"
import { useText } from "../skin-provider"
import { Toolbar } from "../toolbar"
import { Chat } from "./chat"
import { Announcement, type AnnouncementSettings } from "./announcement"
import { useGame } from "./context"
import { HUD_TRANSITION, HudPanel, readableColor } from "./hud-ui"
import { PlayersStrip } from "./players-strip"

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

/** A player's nickname in their color, lightened to stay readable on the dark panels (`readableColor`) */
export function PlayerName({ id }: { id: string }) {
  const { nickname, color } = useGame()
  return <span style={{ color: readableColor(color(id)) }}>{nickname(id)}</span>
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
 * Top-right panel: whose turn it is, the global status, who a simultaneous step still waits for, then the history (newest first).
 *
 * `waitingFor` (`game.waitingFor`, what the game waits for) decides the main line when it is given: "Your turn" when I am one of
 * the players, "Waiting for A, B" when several others are, that player's turn when it is one. A board that holds the
 * announcement back (Courtisans during its opening animation) leaves it out. Without it, `activePlayerId` is whose turn it is.
 * When the game waits for two players or more, the panel also lists every seat (`PlayersStrip`): done, still waiting, away.
 *
 * On a short viewport (a phone held sideways) the history sits behind a toggle.
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
  const motionMode = useMotion()
  const { view } = useGame()
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyId = useId()
  const waiting = idle ?? (view.phase === "over" ? t("gameOver") : t("waiting"))
  const me = view.me?.id
  const mine = me && waitingFor?.includes(me) ? me : null
  const several = waitingFor && !mine && waitingFor.length > 1 ? waitingFor : null
  const turn = waitingFor ? (mine ?? (waitingFor.length === 1 ? waitingFor[0]! : null)) : activePlayerId
  const key = several ? several.join(",") : (turn ?? waiting)
  const enter = { duration: fade(motionMode, 0.25), ease: EASE_STANDARD }
  return (
    <HudPanel className="pointer-events-auto flex w-96 max-w-full flex-col items-end gap-1.5 rounded-xl p-4 text-right short:w-80 short:gap-1 short:p-3">
      <motion.p
        key={key}
        initial={{ opacity: 0, y: -travel(motionMode, 6) }}
        animate={{ opacity: 1, y: 0 }}
        transition={enter}
        className="text-lg leading-snug text-balance short:text-base"
      >
        {several ? <WaitingLabel playerIds={several} /> : turn ? <TurnLabel playerId={turn} /> : waiting}
      </motion.p>
      {status && <div className="text-sm text-hud-muted tabular-nums short:text-xs">{status}</div>}
      {waitingFor && <PlayersStrip waitingFor={waitingFor} className="mt-0.5" />}
      {history.length > 0 && (
        <div className="mt-1.5 flex w-full flex-col items-end border-t border-hud-border pt-3 short:mt-1 short:pt-2">
          <button
            type="button"
            aria-expanded={historyOpen}
            aria-controls={historyId}
            onClick={() => setHistoryOpen((open) => !open)}
            className={cn(HUD_TRANSITION, "hidden cursor-pointer items-center gap-1 text-xs text-hud-muted hover:text-hud-foreground short:inline-flex")}
          >
            {t("history")}
            <ChevronDownIcon aria-hidden className={cn("size-3.5 transition-transform duration-fast ease-standard motion-reduce:transition-none", historyOpen && "rotate-180")} />
          </button>
          <div
            id={historyId}
            className={cn(
              "max-h-48 w-full overflow-y-auto pr-1 pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-1rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "short:mt-2 short:max-h-32",
              !historyOpen && "short:hidden",
            )}
          >
            <ol className="flex flex-col items-end gap-3 text-base short:gap-2 short:text-sm">
              {history.map((turn) => (
                <motion.li
                  key={turn.key}
                  layout="position"
                  initial={{ opacity: 0, y: -travel(motionMode, 8) }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={enter}
                  className="flex flex-col items-end gap-1.5"
                >
                  <span className="text-xs text-hud-muted">
                    <TurnLabel playerId={turn.playerId} short />
                  </span>
                  {turn.entries.map((entry) => (
                    <motion.div key={entry.key} initial={{ opacity: 0, y: -travel(motionMode, 6) }} animate={{ opacity: 1, y: 0 }} transition={enter}>
                      {entry.node}
                    </motion.div>
                  ))}
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </HudPanel>
  )
}

/**
 * Standard game screen: the table (children) full screen; top left the logo (which leaves the game) with sound and rules below it;
 * top right the panel (`ticker`); `overlay` for the game's own buttons and panels.
 *
 * The root is the `.hud` scope (`@pbgo/ui/styles/hud.css`): everything in it reads the `--hud-*` variables, tuned by the game's
 * `UI_THEME`. `MotionConfig` makes every `motion` component below it follow the visitor's `prefers-reduced-motion`.
 *
 * The root clips (`overflow-clip`), it does not hide: a board may run past the screen on purpose (Courtisans' hand peeks from the
 * bottom), and an `overflow-hidden` box is still a scroll container, so focusing a card or a `scrollIntoView` would scroll the
 * whole table, HUD included, out of view. A clipped box cannot be scrolled.
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
  const { Logo, UI_THEME } = useBinding()
  const { game } = useGame()
  const { logo, title } = useSiteSettings()
  return (
    <MotionConfig reducedMotion="user">
      <main className="hud relative h-dvh w-full overflow-clip bg-background text-foreground" style={hudStyle(UI_THEME)}>
        <div className="absolute inset-0">{children}</div>
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-8 pl-[max(1.5rem,env(safe-area-inset-left))] short:gap-2 short:pt-[max(0.75rem,env(safe-area-inset-top))] short:pr-[max(1rem,env(safe-area-inset-right))] short:pl-[max(1rem,env(safe-area-inset-left))]">
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <button
              type="button"
              className={cn("w-40 cursor-pointer transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:w-48 short:w-28")}
              title={t("leave")}
              onClick={onLeave}
            >
              {logo ? <Logo src={logo} alt={title} /> : <span className="font-display text-2xl font-black tracking-[0.12em] uppercase">{title}</span>}
            </button>
            <Toolbar gameCode={game.code} options={game.options} />
          </div>
          {ticker}
        </header>
        {overlay}
        <Chat />
      </main>
    </MotionConfig>
  )
}

type Queued<T extends string> = { id: number; text: string; subtitle?: string; type: T; sound?: string }
let counter = 0

/**
 * Queue of full-screen announcements: `announce(text, type, { subtitle, sound, replace })`, one at a time, each for its preset's duration.
 * `replace` drops the queued announcements of the given types (e.g. a stale "your turn"); `first` puts it at the front.
 * The current one is also read out in a polite live region, for visitors who do not see the screen.
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
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {current && [current.text, current.subtitle].filter(Boolean).join(". ")}
      </div>
      <AnimatePresence>
        {current && <Announcement key={current.id} text={current.text} subtitle={current.subtitle} settings={settings[current.type]} sound={current.sound} live={false} />}
      </AnimatePresence>
    </>
  )
  return { announce, clear, current, element }
}
