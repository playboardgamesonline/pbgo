"use client"

import type { GameEvent } from "@game/engine"
import { button, useControls } from "leva"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAnnouncementSettings } from "@pgo/core/components/game/announcement"
import { GameProvider, useGame } from "@pgo/core/components/game/context"
import { DebugPanel } from "@pgo/core/components/game/debug"
import { debugTab } from "@pgo/core/components/game/debug-tabs"
import { GameOver, winnerAnnouncement } from "@pgo/core/components/game/game-over"
import { GameHud, groupTurns, Ticker, useAnnouncements } from "@pgo/core/components/game/hud"
import { useSkin, useText } from "@pgo/core/components/skin-provider"
import { api, type ClientDebugCommand } from "@pgo/core/lib/api"
import type { PublicGame } from "@pgo/core/lib/game-types"
import type { RulesContent } from "@pgo/core/lib/rules"

const Scene = dynamic(() => import("@/components/game3d/scene").then((m) => m.Scene), { ssr: false })

type Props = { game: PublicGame; rules: RulesContent; onUpdate: (p: PublicGame) => void; onLeave: () => void }

export function Game(props: Props) {
  const view = props.game.view
  if (!view) return null
  return (
    <GameProvider game={props.game} view={view}>
      <Table {...props} />
    </GameProvider>
  )
}

function eventText(e: GameEvent) {
  if (e.type === "cardPlayed") return `joue ${e.card.value}`
  if (e.type === "trickWon") return "remporte le pli"
  return null
}

function Table({ rules, onUpdate, onLeave }: Props) {
  const t = useText()
  const { victoryPhrases } = useSkin()
  const { game, view, color } = useGame()
  const settings = useAnnouncementSettings()
  const { announce, element: announcement, current } = useAnnouncements(settings)
  const [scoresOpen, setScoresOpen] = useState(true)
  const [sending, setSending] = useState(false)
  const previous = useRef<{ round: number; active: string | null; phase: string } | null>(null)

  const meId = view.me?.id ?? null
  const myTurn = view.phase === "playing" && !!meId && view.activePlayerId === meId
  const ended = view.phase === "over"

  useEffect(() => {
    const before = previous.current
    previous.current = { round: view.round, active: view.activePlayerId, phase: view.phase }
    if (view.phase === "over") {
      if (before?.phase !== "over") {
        const { phrase, detail } = winnerAnnouncement(game, view, victoryPhrases)
        announce(phrase, "victory", { subtitle: detail, sound: "victory" })
        setScoresOpen(true)
      }
      return
    }
    if (!before || before.phase === "over") announce("C'est parti !", "start", { subtitle: `${view.options.rounds} manche${view.options.rounds > 1 ? "s" : ""}` })
    else if (before.round !== view.round) announce(`Manche ${view.round}`, "start")
    if (myTurn && (before?.active !== view.activePlayerId || before?.round !== view.round)) announce(t("yourTurn"), "turn", { sound: "turn", replace: ["turn"] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phase, view.round, view.activePlayerId])

  function runDebugCommand(command: ClientDebugCommand) {
    api
      .debug(game.code, command)
      .then(onUpdate)
      .catch((e: Error) => toast.error(e.message))
  }

  useControls(
    "Phases",
    {
      "START · new game": button(() => runDebugCommand("start")),
      "NEXT TURN · auto play": button(() => runDebugCommand("turn")),
      "END · play to the end": button(() => runDebugCommand("over")),
    },
    [game.code],
  )
  useControls(
    "Replay",
    {
      "Start announcement": button(() => announce("C'est parti !", "start", { subtitle: "3 manches" })),
      "Your turn announcement": button(() => announce(t("yourTurn"), "turn")),
      "Victory announcement": button(() => announce("Victoire de", "victory", { subtitle: "Oré · 9 pts" })),
    },
    { order: 1 },
    debugTab("TRANSITION"),
  )

  async function play(cardId: string) {
    if (!myTurn || sending || !meId) return
    setSending(true)
    try {
      onUpdate(await api.action(game.code, { type: "playCard", cardId }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const history = useMemo(
    () =>
      groupTurns(view.log, {
        actor: (e) => (e.type === "newRound" ? null : e.playerId),
        closes: (e) => e.type === "trickWon",
        render: eventText,
      }),
    [view.log],
  )

  return (
    <GameHud
      rules={rules}
      onLeave={onLeave}
      ticker={
        <Ticker
          activePlayerId={ended ? null : view.activePlayerId}
          status={!ended && `Manche ${view.round}/${view.options.rounds}${view.options.inverse ? " · la plus basse gagne" : ""}`}
          history={history}
        />
      }
      overlay={
        <>
          {announcement}
          {ended && !current && <GameOver onUpdate={onUpdate} isOpen={scoresOpen} onToggle={() => setScoresOpen((o) => !o)} />}
          <DebugPanel />
        </>
      }
    >
      <Scene view={view} color={color} myTurn={myTurn && !sending} onPlay={play} />
    </GameHud>
  )
}
