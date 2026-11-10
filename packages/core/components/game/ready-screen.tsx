"use client"

import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DURATION, EASE_STANDARD } from "@pbgo/ui/motion"
import { Button } from "@pbgo/ui/platform/button"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { ApiClientError } from "../../lib/api"
import type { BoardProps } from "../../lib/binding"
import { useApi, useBinding } from "../../lib/binding-context"
import type { PublicGame } from "../../lib/game-types"
import { checkWords, collectiveProgress, type CurtainState, curtainState, type LoadingRow, loadingRows, READY_LOAD_GRACE_MS, secondsLeft } from "../../lib/ready-curtain"
import { useDeadline } from "../../lib/use-deadline"
import { type LoadingProgress, openLoading } from "../../lib/realtime"
import { StartScreen } from "./start-screen"

/** Tries to say "I'm ready" this many times before leaving it to the next change of the table */
const READY_ATTEMPTS = 3

/**
 * The board of a table that has started, behind the start screen (PLT-107). The board is drawn from the first moment, from the view the table gives the player, and loads its pictures behind the screen (`held`, `onLoaded` and `onProgress` of
 * `BoardProps`); the screen is the platform's (`StartScreen`) and shows one collective bar, how far every board of the table is, a row for each player and a button, "I'm here", which every player presses to say they are there: the host who started
 * the table included, and the player who took its last seat, since a table that is full begins by itself and must not draw an absent player into a game. Nothing is automatic. A player is ready when they have pressed it and their board is loaded: the
 * table is told (`POST …/ready`) when both are true, and a press made before the board is loaded is kept until it is. While the table is `starting` the screen stays up for everybody, loaded or not, until the last player is ready and the game begins;
 * then it goes, for each player, and the board plays its opening from then on. A player who has not pressed when the time is up is unseated by the table. A player who comes back to a game under way gets the same screen with their own bar only, no
 * button and no barrier: it goes as soon as their board is loaded.
 */
export function BoardEntry({
  game,
  receivedAt,
  reload,
  data,
  onUpdate,
  onLeave,
}: {
  game: PublicGame
  /** When `game` arrived, in `performance.now()` terms: the time left of the check is measured from then */
  receivedAt: number
  reload: () => void
  data?: unknown
  onUpdate: BoardProps["onUpdate"]
  onLeave: () => void
}) {
  const { Game, SLUG } = useBinding()
  const api = useApi()
  const starting = game.status === "starting"
  const meId = game.meId

  // How far this player's board is: it reports it, and it is loaded when it says so, or when a board that does not is no longer waited for
  const [reported, setReported] = useState(0)
  const [boardLoaded, setBoardLoaded] = useState(false)
  const [graceOver, setGraceOver] = useState(false)
  const onLoaded = useCallback(() => setBoardLoaded(true), [])
  const onProgress = useCallback((share: number) => setReported((value) => Math.max(value, Math.min(1, share))), [])
  useEffect(() => {
    const timer = setTimeout(() => setGraceOver(true), READY_LOAD_GRACE_MS)
    return () => clearTimeout(timer)
  }, [])
  const loaded = boardLoaded || graceOver
  const own = loaded ? 1 : reported

  // The player said they are there: nothing is sent before, whatever the board is doing. The table has them down as ready, or knew it when the page opened (back during the check): it stays so when the game begins and the table forgets the marks
  const [confirmed, setConfirmed] = useState(false)
  const [sent, setSent] = useState(false)
  const [knownReady, setKnownReady] = useState(false)
  if (!knownReady && meId && game.ready.includes(meId)) setKnownReady(true)
  const marked = knownReady || sent

  // A player is ready when they said they are there and their board is loaded; a press made before the board is loaded is sent when it is. The table decides, once everybody is
  useEffect(() => {
    if (!starting || !confirmed || !loaded || marked) return
    let stopped = false
    void (async () => {
      for (let attempt = 1; attempt <= READY_ATTEMPTS && !stopped; attempt++) {
        try {
          onUpdate(await api.ready(game.code))
          if (!stopped) setSent(true)
          return
        } catch (error) {
          // Unseated while the board loaded (the check ended): the table says so when it is asked, and the page leaves it
          if (error instanceof ApiClientError && error.code === "UNKNOWN_PLAYER") return reload()
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
        }
      }
      // The table could not be told: the button is theirs again, to press once the line is back, instead of a wait for nothing
      if (!stopped) setConfirmed(false)
    })()
    return () => {
      stopped = true
    }
  }, [starting, confirmed, loaded, marked, api, game.code, onUpdate, reload])

  // How far the others are: what the boards of the table tell each other, while the check lasts
  const [others, setOthers] = useState<LoadingProgress>({})
  const channel = useRef<ReturnType<typeof openLoading>>(null)
  useEffect(() => {
    if (!starting || !meId) return
    const open = openLoading(SLUG, game.code, meId, setOthers)
    channel.current = open
    return () => {
      open?.close()
      channel.current = null
    }
  }, [starting, meId, SLUG, game.code])
  // What this board has loaded is said again whenever it changes and to a channel that has just opened (this effect runs after the one that opens it)
  useEffect(() => {
    channel.current?.report(own)
  }, [own, starting, meId, SLUG, game.code])

  // The deadline of a game with a clock: counted down here for every board, and the table asked to play it when it ends
  const deadlineAt = useDeadline(game, receivedAt, async () => onUpdate(await api.tick(game.code)))

  // The time left, measured from the moment the table said it; when it is up the table is asked at once, and again until it answers: the first look at it ends the check
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!starting) return
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [starting])
  const left = secondsLeft(game.readyInMs, receivedAt, now)
  const timeUp = starting && left === 0
  useEffect(() => {
    if (!timeUp) return
    reload()
    const timer = setInterval(reload, 1500)
    return () => clearInterval(timer)
  }, [timeUp, reload])

  const state = curtainState({ status: game.status, confirmed, marked, loaded })
  const lifted = state === "lifted"
  const rows = useMemo(() => loadingRows({ players: game.players, ready: game.ready, reported: others, meId, own }), [game.players, game.ready, others, meId, own])
  if (!Game) return null
  const ready = rows.filter((row) => row.ready).length

  return (
    <>
      {/* Nothing under the screen can be reached by the keyboard either */}
      <div className="contents" inert={!lifted}>
        <Game game={game} data={data} onUpdate={onUpdate} onLeave={onLeave} held={!lifted} deadlineAt={deadlineAt} onLoaded={onLoaded} onProgress={onProgress} />
      </div>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {!lifted && (
            <motion.div
              key="start-screen"
              // Over the board and its HUD, below the wall of the narrow screens and the cookie banner. It covers the whole window, as the board does, so that none of the board shows under the banner; the screen inside keeps the banner's room (`--consent-h`)
              className="fixed inset-x-0 top-0 z-[45] h-dvh bg-background"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: "none" }}
              transition={{ duration: DURATION.slow, ease: EASE_STANDARD }}
            >
              {starting ? (
                <CheckScreen state={state} onConfirm={() => setConfirmed(true)} progress={collectiveProgress(rows)} caption={`${ready} of ${rows.length} players ready`} seconds={left} rows={rows} />
              ) : (
                <StartScreen title="Loading the table" progress={own} caption={`${Math.round(own * 100)}%`} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </>
  )
}

/**
 * The start screen of a table in its ready check: the words for where the player stands, the bar and a row for each player, and the button. The button is theirs to press until they do: it takes the focus when the screen comes up, so that Enter or Space
 * presses it, and from the press on it is disabled, with a spinner, and says that the others are awaited.
 */
function CheckScreen({
  state,
  onConfirm,
  progress,
  caption,
  seconds,
  rows,
}: {
  state: Exclude<CurtainState, "lifted">
  onConfirm: () => void
  progress: number
  caption: string
  seconds: number | null
  rows: readonly LoadingRow[]
}) {
  const words = checkWords(state)
  const pressed = state !== "confirm"
  return (
    <StartScreen title={words.title} subtitle={words.subtitle} progress={progress} caption={caption} seconds={seconds} rows={rows}>
      <Button size="xl" className="min-w-64" autoFocus disabled={pressed} onClick={onConfirm}>
        {pressed && <Spinner data-icon="inline-start" />}
        {words.button}
      </Button>
    </StartScreen>
  )
}
