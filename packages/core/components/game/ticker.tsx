"use client"

import { motion } from "motion/react"
import { Fragment, useState } from "react"
import { EASE_STANDARD, fade, travel } from "../../lib/motion-preference"
import { useMotion } from "../../lib/use-motion"
import { shortName } from "../../lib/short-name"
import { useText } from "../skin-provider"
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
    // a nickname is typed by its player: session recordings show it masked (`ph-mask`)
    <span className="ph-mask font-semibold brightness-150" style={{ color: color(id) }} title={nickname(id)}>
      {shortName(nickname(id))}
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

/** The history fades out at the bottom, and at the top once it has scrolled, so that a line is never cut off sharp under the hairline */
const fadeOf = (scrolled: boolean) => `linear-gradient(to bottom, ${scrolled ? "transparent 0%, black 12%" : "black 0%"}, black 55%, transparent 100%)`

/**
 * Top-left of the screen, in the game's look: the state of the game, laid straight on the table with no card behind it (`table-ink` keeps it legible over any skin and anything the table shows there) and wide enough for a line of the history to
 * stay on one line. Whose turn it is, what the game says besides (`status`: the round, the tokens), then the history (newest first, fading out as it goes down).
 *
 * `waitingFor` (`game.waitingFor`, what the game waits for) decides the main line when it is given: "Your turn" when I am one of
 * the players, "Waiting for A, B" when several others are, that player's turn when it is one. A board that holds the
 * announcement back (Courtisans during its opening animation) leaves it out. Without it, `activePlayerId` is whose turn it is.
 * Who has played and who is still to is the list of the players' (`TablePlayers`): the panel does not list the seats.
 *
 * It is text over the table: the main line and the status let the pointer through to the table, and the history scrolls under the pointer (its box is as wide as its widest line, with no scrollbar, and it fades out at the bottom and, once scrolled, at the top), with nothing to fold. On a short
 * viewport (a phone held sideways) it has less height.
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
  const [scrolled, setScrolled] = useState(false)
  const waiting = idle ?? (game.status === "over" ? t("gameOver") : t("waiting"))
  const me = game.meId
  const mine = me && waitingFor?.includes(me) ? me : null
  const several = waitingFor && !mine && waitingFor.length > 1 ? waitingFor : null
  const turn = waitingFor ? (mine ?? (waitingFor.length === 1 ? waitingFor[0]! : null)) : activePlayerId
  const key = several ? several.join(",") : (turn ?? waiting)
  const enter = { duration: fade(motionMode, 0.25), ease: EASE_STANDARD }
  return (
    <div className="table-ink pointer-events-none flex w-full max-w-lg min-w-0 flex-col gap-2 font-sans text-foreground short:max-w-72 short:gap-1.5">
      <motion.p
        key={key}
        initial={{ opacity: 0, y: -travel(motionMode, 6) }}
        animate={{ opacity: 1, y: 0 }}
        transition={enter}
        className="font-display text-xl leading-tight tracking-[0.14em] uppercase md:text-2xl short:text-base"
      >
        {several ? <WaitingLabel playerIds={several} /> : turn ? <TurnLabel playerId={turn} /> : waiting}
      </motion.p>
      {status && <div className="font-display text-sm tracking-[0.18em] text-foreground/70 uppercase tabular-nums short:text-xs">{status}</div>}
      {history.length > 0 && (
        <>
          <div aria-hidden className="h-px w-full bg-gradient-to-r from-foreground/40 to-transparent" />
          <div
            // a region that scrolls is reached with the keyboard too
            tabIndex={0}
            role="region"
            aria-label={t("history")}
            className="pointer-events-auto max-h-56 w-fit max-w-full overflow-y-auto pb-6 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring/50 short:max-h-28 short:pb-3 [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}
            style={{ maskImage: fadeOf(scrolled), WebkitMaskImage: fadeOf(scrolled) }}
          >
            <ol className="flex flex-col items-start gap-3 text-base short:gap-2">
              {history.map((turn) => (
                <motion.li
                  key={turn.key}
                  layout="position"
                  initial={{ opacity: 0, y: -travel(motionMode, 8) }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={enter}
                  className="flex max-w-full flex-col items-start gap-1.5 short:gap-1"
                >
                  <span className="text-sm text-foreground/70">
                    <TurnLabel playerId={turn.playerId} short />
                  </span>
                  {turn.entries.map((entry) => (
                    <motion.div key={entry.key} initial={{ opacity: 0, y: -travel(motionMode, 6) }} animate={{ opacity: 1, y: 0 }} transition={enter} className="max-w-full">
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
