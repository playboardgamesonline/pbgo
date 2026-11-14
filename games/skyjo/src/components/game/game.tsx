"use client"

import type { PlayerView, SkyjoEvent } from "@skyjo/engine"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAnnouncementSettings } from "@pbgo/core/components/game/announcement"
import { GameProvider, useGame, useGameLog } from "@pbgo/core/components/game/context"
import { DebugSlot } from "@pbgo/core/components/game/debug-controls"
import { useDebugFolder } from "@pbgo/core/components/game/debug-folders"
import { GameOver, winnerAnnouncement } from "@pbgo/core/components/game/game-over"
import { GameHud, groupTurns, Ticker, useAnnouncements } from "@pbgo/core/components/game/hud"
import { StalledTurn } from "@pbgo/core/components/game/stalled-turn"
import { useSkin, useText } from "@pbgo/core/components/skin-provider"
import type { ClientDebugCommand } from "@pbgo/core/lib/api"
import { useApi } from "@pbgo/core/lib/binding-context"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import { seatsOf } from "@pbgo/core/lib/seat-avatar"
import { useMotion } from "@pbgo/core/lib/use-motion"
import { timelineOf } from "../board/pacing"
import { type ClientCatalog, MISSING_CATALOG } from "../../lib/catalog"
import { actorsOf, sentenceOf } from "../../lib/history"
import { fill } from "../../lib/words"

const Scene = dynamic(() => import("../board/scene").then((m) => m.Scene), { ssr: false })

/** No card waits for its turn to come in: the cards of a table that was just opened are where they lie */
const NO_ENTRANCES: ReturnType<typeof timelineOf>["entrances"] = new Map()
const NO_COLUMNS: ReturnType<typeof timelineOf>["columns"] = []

/** `held` and `onLoaded` are the start screen's (PLT-107): behind it the board is drawn and loads, says so, and holds its opening (the camera's entrance, the start announcement) until the screen goes */
type Props = {
  game: PublicGame<PlayerView>
  /** What `loadGameData` of the server binding gave: the pictures of the cards and the words of the board, from Sanity */
  data?: unknown
  onUpdate: (p: PublicGame) => void
  onLeave: () => void
  held?: boolean
  onLoaded?: () => void
}

export function Game(props: Props) {
  const view = props.game.view
  if (!view) return null
  return (
    <GameProvider game={props.game} view={view}>
      <Board {...props} />
    </GameProvider>
  )
}

/** Under the main line of the ticker: the round and the score that ends the game. */
function RoundStatus({ catalog }: { catalog: ClientCatalog }) {
  const { view } = useGame<PlayerView>()
  return (
    <>
      {fill(catalog.words.round, { number: view.round })} · {fill(catalog.words.endsAt, { points: view.target })}
    </>
  )
}

/** The player of the turn, once the round has begun: nobody while it opens, since every player turns their cards over at once */
const turnOf = (phase: PlayerView["phase"]) => (phase.kind === "choose" || phase.kind === "place" || phase.kind === "flip" ? phase.player : null)

function Board({ onUpdate, onLeave, held = false, onLoaded, data }: Props) {
  const t = useText()
  const api = useApi()
  const { victoryPhrases, playerColors } = useSkin()
  const { game, view, nickname } = useGame<PlayerView>()
  // What the server sends is the catalog of Sanity; a board shown with none (the admin's preview) reads every word as missing
  const catalog = (data as ClientCatalog | undefined) ?? MISSING_CATALOG
  const { words } = catalog
  // What happened, as the platform keeps it for the table and sends it to this player: the state and the view hold no log
  const log = useGameLog<SkyjoEvent>()
  // How long the last move takes to play out (`timelineOf`). The board draws the view at once; what it holds back waits for that time: the cards that come in one after the other, the announcements and the words that say how the move ended.
  // A table that is opened, or reloaded, is drawn as it is and plays nothing (`openedAt`), but for the deal, which is drawn when the start screen goes
  const motion = useMotion()
  const seatIds = view.players.map((player) => player.id)
  const key = seatIds.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the ids
  const timeline = useMemo(() => timelineOf(log, seatIds, motion === "reduced"), [log, key, motion])
  const [openedAt] = useState(() => (held ? 0 : timeline.v))
  const [playedV, setPlayedV] = useState(openedAt)
  const busyUntil = useRef(0)
  const busy = playedV < timeline.v
  useEffect(() => {
    // behind the start screen the cards of the deal are not drawn: the clock of the deal starts when the screen goes
    if (held || timeline.v <= playedV) return
    // a move that comes while another plays out waits for both
    busyUntil.current = Math.max(busyUntil.current, Date.now() + timeline.settle * 1000)
    const timer = setTimeout(() => setPlayedV(timeline.v), Math.max(0, busyUntil.current - Date.now()))
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a move that was taken note of is not timed again: only a newer version of the log, or the start screen going, starts a timer
  }, [timeline.v, held])
  const settings = useAnnouncementSettings()
  const { announce, element: announcement, current } = useAnnouncements(settings, { paused: busy })
  const [sending, setSending] = useState(false)
  const previous = useRef<{ round: number; turn: string | null; phase: string } | null>(null)
  const played = useRef<number | null>(null)

  const meId = view.me
  const phase = view.phase
  const turn = turnOf(phase)
  const myTurn = !!meId && turn === meId
  const ended = phase.kind === "over"
  // The players shown with an announcement: the viewer for "your turn", the winners for the victory
  const seatsFor = (ids: readonly string[]) => seatsOf(game.players, ids, playerColors)

  useEffect(() => {
    // The start screen holds the start of the game: its announcement comes when the screen goes
    if (held) return
    const before = previous.current
    previous.current = { round: view.round, turn, phase: phase.kind }
    if (phase.kind === "over") {
      if (before?.phase !== "over") {
        const { phrase, detail, winners, kind } = winnerAnnouncement(game, view, victoryPhrases, (points) => t("pointsShort", { points }), t("defeatTitle"))
        announce(phrase, kind, { subtitle: detail, sound: kind === "victory" ? "victory" : undefined, seats: seatsFor(winners) })
      }
      return
    }
    if (!before || before.phase === "over") announce(words.start, "start", { subtitle: fill(words.endsAt, { points: view.target }) })
    else if (before.round !== view.round) announce(fill(words.round, { number: view.round }), "round")
    if (myTurn && (before?.turn !== turn || before?.round !== view.round)) announce(t("yourTurn"), "turn", { sound: "turn", replace: ["turn"], seats: seatsFor(meId ? [meId] : []) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- it says what changed since the last phase, round or turn, so it runs on those and on the start screen going, never on every new view
  }, [phase.kind, view.round, turn, held])

  // The last turn is announced when the log says it: the lines that came since the last ones the board has seen (the first reading of the log is the history of a game joined late, and says nothing)
  useEffect(() => {
    const latest = log.at(-1)?.v ?? 0
    const seen = played.current
    played.current = latest
    if (held || seen === null) return
    for (const line of log) {
      if (line.v > seen && line.event.kind === "last") announce(words.lastTurnAnnouncement, "round", { subtitle: nickname(line.event.by), seats: seatsFor([line.event.by]) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- it reads the lines that came since the last time, so it runs when the log grows or the start screen goes, not whenever `announce` is made again
  }, [log, held])

  function runDebugCommand(command: ClientDebugCommand) {
    api
      .debug(game.code, command)
      .then(onUpdate)
      .catch((e: Error) => toast.error(e.message))
  }

  // The commands of the game and the replay of its announcements: folders of the debug panel, written down here and drawn by the panel (`DebugSlot`) when it is there
  useDebugFolder(
    {
      folder: "Phases",
      tab: "GAME",
      closed: false,
      schema: ({ button }) => ({
        "START · new game": button(() => runDebugCommand("start")),
        "NEXT TURN · auto play": button(() => runDebugCommand("turn")),
        "ROUND · play to the count": button(() => runDebugCommand("round")),
        "END · play to the end": button(() => runDebugCommand("over")),
      }),
    },
    [game.code],
  )
  // The table rigged to reach a situation at once (the engine's own debug commands, which act when a player has to choose where to draw from)
  useDebugFolder(
    {
      folder: "Rig the table",
      tab: "GAME",
      order: 1,
      closed: false,
      schema: ({ button }) => ({
        "Last card to turn over": button(() => runDebugCommand("lastCard")),
        "Column of three on the next move": button(() => runDebugCommand("columnOnTop")),
        "Lowest card on top of the pile": button(() => runDebugCommand("lowOnTop")),
        "Highest card on top of the pile": button(() => runDebugCommand("highOnTop")),
        "Score near the end of the game": button(() => runDebugCommand("nearTarget")),
      }),
    },
    [game.code],
  )
  useDebugFolder({
    folder: "Replay",
    tab: "TRANSITION",
    order: 1,
    closed: false,
    schema: ({ button }) => ({
      "Start announcement": button(() => announce(words.start, "start", { subtitle: fill(words.endsAt, { points: view.target }) })),
      "Round announcement": button(() => announce(fill(words.round, { number: 2 }), "round")),
      "Last turn announcement": button(() => announce(words.lastTurnAnnouncement, "round", { seats: seatsFor(game.players.slice(0, 1).map((p) => p.id)) })),
      "Your turn announcement": button(() => announce(t("yourTurn"), "turn", { seats: seatsFor(meId ? [meId] : []) })),
      "Defeat announcement": button(() => announce(t("defeatTitle"), "defeat", { subtitle: t("pointsShort", { points: 12 }) })),
    }),
  })

  async function send(action: { type: string } & Record<string, unknown>) {
    if (sending) return
    setSending(true)
    try {
      onUpdate(await api.action(game.code, action))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const history = useMemo(() => {
    const events = log.map((line) => line.event)
    const actors = actorsOf(events)
    const context = { words: catalog.words }
    return groupTurns(
      events.map((event, i) => ({ event, actor: actors[i] ?? null })),
      { actor: (entry) => entry.actor, render: (entry) => sentenceOf(entry.event, context) },
    )
  }, [log, catalog])

  return (
    <GameHud
      onLeave={onLeave}
      ticker={<Ticker activePlayerId={ended ? null : turn} waitingFor={ended ? undefined : game.waitingFor} status={!ended && <RoundStatus catalog={catalog} />} history={history} />}
      overlay={
        <>
          {announcement}
          <StalledTurn onUpdate={onUpdate} />
          {ended && !current && !busy && <GameOver onUpdate={onUpdate} />}
          <DebugSlot />
        </>
      }
    >
      <Scene
        view={view}
        catalog={catalog}
        pointsText={(points) => t("pointsShort", { points })}
        onReveal={(position) => void send({ type: "reveal", position })}
        onTake={() => void send({ type: "take" })}
        onDraw={() => void send({ type: "draw" })}
        onPlace={(position) => void send({ type: "place", position })}
        onThrow={() => void send({ type: "discard" })}
        onFlip={(position) => void send({ type: "flip", position })}
        onDeal={() => void send({ type: "deal" })}
        entrances={timeline.v > openedAt ? timeline.entrances : NO_ENTRANCES}
        columns={timeline.v > openedAt ? timeline.columns : NO_COLUMNS}
        busy={busy}
        held={held}
        onLoaded={onLoaded}
      />
    </GameHud>
  )
}
