"use client"

import type { PlayerView } from "@love-letter/engine"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAnnouncementSettings } from "@pbgo/core/components/game/announcement"
import { GameProvider, useGame } from "@pbgo/core/components/game/context"
import { DebugSlot } from "@pbgo/core/components/game/debug-controls"
import { useDebugFolder } from "@pbgo/core/components/game/debug-folders"
import { GameOver, winnerAnnouncement } from "@pbgo/core/components/game/game-over"
import { GameHud, Ticker, useAnnouncements } from "@pbgo/core/components/game/hud"
import { StalledTurn } from "@pbgo/core/components/game/stalled-turn"
import { useSkin, useText } from "@pbgo/core/components/skin-provider"
import type { ClientDebugCommand } from "@pbgo/core/lib/api"
import { useApi } from "@pbgo/core/lib/binding-context"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import { seatsOf } from "@pbgo/core/lib/seat-avatar"
import { type ClientCatalog, MISSING_CATALOG } from "../../lib/catalog"
import { fill } from "../../lib/words"
import type { ClientAction } from "../board/turn"
import { Lens } from "./lens"

const Scene = dynamic(() => import("../board/scene").then((m) => m.Scene), { ssr: false })

/** `held` and `onLoaded` are the start screen's (PLT-107): behind it the board is drawn and loads, says so, and holds its opening (the camera's entrance, the start announcement) until the screen goes */
type Props = {
  game: PublicGame<PlayerView>
  /** What `loadGameData` of the server binding gave: the faces, the names and the texts of the characters, the back of the cards and the words of the board, from Sanity */
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

/** Under the main line of the ticker: the round and the favor tokens that win. */
function RoundStatus({ catalog }: { catalog: ClientCatalog }) {
  const { view } = useGame<PlayerView>()
  return (
    <>
      {fill(catalog.words.round, { number: view.round })} · {fill(catalog.words.tokensToWin, { count: view.target })}
    </>
  )
}

function Board({ onUpdate, onLeave, held = false, onLoaded, data }: Props) {
  const t = useText()
  const api = useApi()
  const { victoryPhrases, playerColors } = useSkin()
  const { game, view } = useGame<PlayerView>()
  // What the server sends is the catalog of Sanity; a board shown with none (the admin's preview) reads every word as missing
  const catalog = (data as ClientCatalog | undefined) ?? MISSING_CATALOG
  const { words } = catalog
  const settings = useAnnouncementSettings()
  const { announce, element: announcement, current } = useAnnouncements(settings)
  const [sending, setSending] = useState(false)
  const previous = useRef<{ round: number; turn: string | null; phase: string } | null>(null)

  const meId = view.me?.id ?? null
  const phase = view.phase
  // The player the game waits for: who plays a card (or keeps one), or deals once a round is counted; nobody once the game is over
  const turn = phase.kind === "turn" || phase.kind === "keep" ? phase.player : phase.kind === "between" ? phase.next : null
  const myTurn = !!meId && (phase.kind === "turn" || phase.kind === "keep") && phase.player === meId
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
    if (!before || before.phase === "over") announce(words.start, "start", { subtitle: fill(words.tokensToWin, { count: view.target }) })
    else if (before.round !== view.round) announce(fill(words.round, { number: view.round }), "round")
    if (myTurn && (before?.turn !== turn || before?.round !== view.round || before?.phase !== phase.kind)) announce(t("yourTurn"), "turn", { sound: "turn", replace: ["turn"], seats: seatsFor(meId ? [meId] : []) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- it says what changed since the last phase, round or turn, so it runs on those and on the start screen going, never on every new view
  }, [phase.kind, view.round, turn, held])

  function runDebugCommand(command: ClientDebugCommand) {
    api
      .debug(game.code, command)
      .then(onUpdate)
      .catch((e: Error) => toast.error(e.message))
  }

  /** What the viewer does: a card played, a card kept, the next round dealt. One move at a time: the pads wait for the answer, and a refusal is a toast */
  async function send(action: ClientAction) {
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

  // The commands of the game: a folder of the debug panel, written down here and drawn by the panel (`DebugSlot`) when it is there
  useDebugFolder(
    {
      folder: "Phases",
      tab: "GAME",
      closed: false,
      schema: ({ button }) => ({
        "START · new game": button(() => runDebugCommand("start")),
        "NEXT TURN · auto play": button(() => runDebugCommand("turn")),
        "ROUND · play to its count": button(() => runDebugCommand("round")),
        "END · play to the end": button(() => runDebugCommand("over")),
      }),
    },
    [game.code],
  )
  // The table rigged to reach a situation at once (the engine's own debug commands, which act on the turn that waits for a card): the Countess rule, a Princess, a Chancellor, the deck nearly out, every other player protected, a game nearly won
  useDebugFolder(
    {
      folder: "Rig the table",
      tab: "GAME",
      order: 1,
      closed: false,
      schema: ({ button }) => ({
        "Countess and King in hand": button(() => runDebugCommand("countessAndKing")),
        "Princess in hand": button(() => runDebugCommand("princessInHand")),
        "Chancellor in hand": button(() => runDebugCommand("chancellorInHand")),
        "Deck down to two cards": button(() => runDebugCommand("twoCardsLeft")),
        "Deck down to one card": button(() => runDebugCommand("oneCardLeft")),
        "Every other player protected": button(() => runDebugCommand("allProtected")),
        "One token short of winning": button(() => runDebugCommand("nearTarget")),
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
      "Start announcement": button(() => announce(words.start, "start", { subtitle: fill(words.tokensToWin, { count: view.target }) })),
      "Round announcement": button(() => announce(fill(words.round, { number: 2 }), "round")),
      "Your turn announcement": button(() => announce(t("yourTurn"), "turn", { seats: seatsFor(meId ? [meId] : []) })),
      "Defeat announcement": button(() => announce(t("defeatTitle"), "defeat", { subtitle: t("pointsShort", { points: 2 }) })),
    }),
  })

  return (
    <GameHud
      onLeave={onLeave}
      ticker={<Ticker activePlayerId={ended ? null : turn} waitingFor={ended ? undefined : game.waitingFor} status={!ended && <RoundStatus catalog={catalog} />} history={[]} />}
      overlay={
        <>
          {announcement}
          <Lens />
          <StalledTurn onUpdate={onUpdate} />
          {ended && !current && <GameOver onUpdate={onUpdate} history={[]} />}
          <DebugSlot />
        </>
      }
    >
      <Scene view={view} catalog={catalog} onAction={(action) => void send(action)} busy={sending} held={held} onLoaded={onLoaded} />
    </GameHud>
  )
}
