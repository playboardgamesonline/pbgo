"use client"

import { ChevronDownIcon } from "lucide-react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { Fragment, useCallback, useEffect, useId, useState } from "react"
import type { OptionValues } from "@pbgo/engine-kit"
import { Separator } from "@pbgo/ui/platform/separator"
import { cn } from "@pbgo/ui/utils"
import { EASE_STANDARD, fade, travel } from "../../lib/motion-preference"
import type { SeatAvatarInput } from "../../lib/seat-avatar"
import { useMotion } from "../../lib/use-motion"
import { useText } from "../skin-provider"
import { Chat } from "./chat"
import { Announcement, type AnnouncementSettings } from "./announcement"
import { useGame } from "./context"
import { GuestDock, useGameMenu } from "./game-menu"
import { useHudDock } from "./hud-dock"
import { TableDebug } from "./table-debug"
import { TablePlayers } from "./table-players"
import { PromptHost } from "./prompt-host"

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
    // a nickname is typed by its player: session recordings show it masked (`ph-mask`)
    <span className="ph-mask font-semibold brightness-150" style={{ color: color(id) }}>
      {nickname(id)}
    </span>
  )
}

function TurnLabel({ playerId, short }: { playerId: string; short?: boolean }) {
  const t = useText()
  const { game } = useGame()
  if (playerId === game.meId) return <>{t(short ? "yourTurnShort" : "yourTurn")}</>
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
 * Top-left panel, in the platform's look: the state of the game. Whose turn it is, what the game says besides (`status`: the round, the tokens), then the history (newest first).
 *
 * `waitingFor` (`game.waitingFor`, what the game waits for) decides the main line when it is given: "Your turn" when I am one of
 * the players, "Waiting for A, B" when several others are, that player's turn when it is one. A board that holds the
 * announcement back (Courtisans during its opening animation) leaves it out. Without it, `activePlayerId` is whose turn it is.
 * Who has played and who is still to is the list of the players' (`TablePlayers`): the panel does not list the seats.
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
  const { game } = useGame()
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyId = useId()
  const waiting = idle ?? (game.status === "over" ? t("gameOver") : t("waiting"))
  const me = game.meId
  const mine = me && waitingFor?.includes(me) ? me : null
  const several = waitingFor && !mine && waitingFor.length > 1 ? waitingFor : null
  const turn = waitingFor ? (mine ?? (waitingFor.length === 1 ? waitingFor[0]! : null)) : activePlayerId
  const key = several ? several.join(",") : (turn ?? waiting)
  const enter = { duration: fade(motionMode, 0.25), ease: EASE_STANDARD }
  return (
    <div className="platform pointer-events-auto flex w-80 max-w-full flex-col gap-3 rounded-3xl border glass p-4 font-sans text-foreground shadow-surface short:w-64 short:gap-2 short:p-3">
      <motion.p
        key={key}
        initial={{ opacity: 0, y: -travel(motionMode, 6) }}
        animate={{ opacity: 1, y: 0 }}
        transition={enter}
        className="text-xl leading-tight font-strong short:text-lg"
      >
        {several ? <WaitingLabel playerIds={several} /> : turn ? <TurnLabel playerId={turn} /> : waiting}
      </motion.p>
      {status && <div className="-mt-1.5 text-sm text-muted-foreground tabular-nums short:text-xs">{status}</div>}
      {history.length > 0 && (
        <>
          <Separator />
          <button
            type="button"
            aria-expanded={historyOpen}
            aria-controls={historyId}
            onClick={() => setHistoryOpen((open) => !open)}
            className="hidden cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none short:inline-flex"
          >
            {t("history")}
            <ChevronDownIcon aria-hidden className={cn("size-3.5 transition-transform motion-reduce:transition-none", historyOpen && "rotate-180")} />
          </button>
          <div
            id={historyId}
            className={cn(
              "max-h-[12.5rem] w-full overflow-y-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "short:max-h-32 short:pb-3",
              !historyOpen && "short:hidden",
            )}
            style={{
              maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
            }}
          >
            <ol className="flex flex-col items-start gap-4 text-base short:gap-3">
              {history.map((turn) => (
                <motion.li
                  key={turn.key}
                  layout="position"
                  initial={{ opacity: 0, y: -travel(motionMode, 8) }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={enter}
                  className="flex flex-col items-start gap-2 short:gap-1.5"
                >
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
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
        </>
      )}
    </div>
  )
}

/**
 * The top right of the screen, in the platform's look: the dock of the visitor's social panel (the app's, `useHudDock`), whose picture opens the menu of the game (its sound, its language, its setup, its rules, the way out…) with the
 * pages of their account, or, when there is no dock to show, the picture alone in a bar with the same menu (`GuestDock`); then the players of the table under it, with what each has so far. The dock opens over the players, hence the stacking.
 */
function TableCorner({ gameCode, options, onLeave, className }: { gameCode: string; options: OptionValues; onLeave: () => void; className?: string }) {
  const Dock = useHudDock()
  const menu = useGameMenu({ gameCode, options, onLeave })
  const guest = <GuestDock menu={menu} />
  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      {/* eslint-disable-next-line react-hooks/static-components -- the dock is the app's component, given once by the context for the life of the page: it is not made while drawing */}
      <div className="platform relative z-20 font-sans text-foreground">{Dock ? <Dock menu={menu} fallback={guest} /> : guest}</div>
      <TablePlayers className="relative z-10" />
    </div>
  )
}

/**
 * Standard game screen: the table (children) full screen. Everything the platform says around it is in the platform's look and in the corners, so that the cards keep the middle and the bottom: top left the state of the game (`ticker`:
 * whose turn it is, the round, the history), top right the social dock with the settings and the way out, and the players of the table with their scores under it, bottom right the chat of the table, which only shows when it has something to say.
 * `overlay` is for the game's own buttons and panels. The table is as tall as the window and the cookie banner floats over it; the HUD and the overlay stand above the banner's room, so a bottom-anchored button keeps its distance from the card.
 *
 * `MotionConfig` makes every `motion` component below it follow the visitor's `prefers-reduced-motion`.
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
  const { game } = useGame()
  // The table fills the whole screen, under the consent banner, which floats over it (`AnalyticsProvider floating`): a canvas that shrank with the banner would reflow the scene. The HUD and the game's overlays are in a layer that
  // ends above the banner (`--consent-h`, set on <body>; 0px without a banner), so what is anchored to the bottom is never under the card. The layer lets the pointer through to the table, and `contents` keeps the overlay's own pointer events
  return (
    <MotionConfig reducedMotion="user">
      <main className="group/hud relative h-dvh w-full overflow-clip bg-background text-foreground">
        <div className="absolute inset-0">{children}</div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100dvh-var(--consent-h,0px))]">
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-8 pl-[max(1.5rem,env(safe-area-inset-left))] short:gap-2 short:pt-[max(0.75rem,env(safe-area-inset-top))] short:pr-[max(1rem,env(safe-area-inset-right))] short:pl-[max(1rem,env(safe-area-inset-left))]">
            {ticker}
            <TableCorner className="ml-auto" gameCode={game.code} options={game.options} onLeave={onLeave} />
          </header>
          <div className="pointer-events-auto contents">{overlay}</div>
        </div>
        <Chat />
        <TableDebug />
        <PromptHost />
      </main>
    </MotionConfig>
  )
}

type Queued<T extends string> = { id: number; text: string; subtitle?: string; type: T; sound?: string; seats?: SeatAvatarInput[] }
let counter = 0

/**
 * Queue of full-screen announcements: `announce(text, type, { subtitle, sound, seats, replace })`, one at a time, each for its preset's duration.
 * `seats` are the players shown with it (`seatsOf` in `lib/seat-avatar`): the viewer for "your turn", the winners for a victory.
 * `replace` drops the queued announcements of the given types (e.g. a stale "your turn"); `first` puts it at the front.
 * The current one is also read out in a polite live region, for visitors who do not see the screen.
 */
export function useAnnouncements<T extends string>(settings: Record<T, AnnouncementSettings>, { paused = false }: { paused?: boolean } = {}) {
  const [queue, setQueue] = useState<Queued<T>[]>([])
  // paused (e.g. during the opening), the queue waits without showing anything
  const current = paused ? null : (queue[0] ?? null)
  const announce = useCallback((text: string, type: T, options: { subtitle?: string; sound?: string; seats?: SeatAvatarInput[]; replace?: T[]; first?: boolean } = {}) => {
    const item = { id: ++counter, text, type, subtitle: options.subtitle, sound: options.sound, seats: options.seats }
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
      <div role="status" aria-live="polite" className="ph-mask sr-only">
        {current && [current.text, current.subtitle].filter(Boolean).join(". ")}
      </div>
      <AnimatePresence>
        {current && (
          <Announcement key={current.id} text={current.text} subtitle={current.subtitle} settings={settings[current.type]} sound={current.sound} seats={current.seats} live={false} />
        )}
      </AnimatePresence>
    </>
  )
  return { announce, clear, current, element }
}
