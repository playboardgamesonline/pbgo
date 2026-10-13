"use client"

import type { GameEvent, PlayerView } from "@template/engine"
import { button, useControls } from "leva"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAnnouncementSettings } from "@pbgo/core/components/game/announcement"
import { GameProvider, useGame } from "@pbgo/core/components/game/context"
import { DebugPanel } from "@pbgo/core/components/game/debug"
import { debugTab } from "@pbgo/core/components/game/debug-tabs"
import { GameOver, winnerAnnouncement } from "@pbgo/core/components/game/game-over"
import { GameHud, groupTurns, PlayerName, Ticker, useAnnouncements } from "@pbgo/core/components/game/hud"
import { useSeatTheme } from "@pbgo/core/components/game/seat-label"
import { StalledTurn } from "@pbgo/core/components/game/stalled-turn"
import { useSkin, useText } from "@pbgo/core/components/skin-provider"
import type { ClientDebugCommand } from "@pbgo/core/lib/api"
import { useApi } from "@pbgo/core/lib/binding-context"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import { Button } from "@pbgo/ui/game/button"

const Scene = dynamic(() => import("../game3d/scene").then((m) => m.Scene), { ssr: false })

type Props = { game: PublicGame<PlayerView>; data?: unknown; onUpdate: (p: PublicGame) => void; onLeave: () => void }

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

/**
 * The simultaneous step: everybody announces their number of tricks at the same time, in any order. A player who has bid
 * can still change their mind until the last one has, so the buttons stay on. Who has bid and who is still to is not shown here:
 * the ticker lists every seat for a step the game waits several players for (`game.waitingFor`).
 */
function BidPanel({ sending, onBid }: { sending: boolean; onBid: (amount: number) => void }) {
  const { view } = useGame<PlayerView>()
  const me = view.me
  if (view.phase !== "bidding" || !me) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[32%] z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-col items-center gap-3 rounded-2xl bg-black/60 px-6 py-4 text-center text-foreground shadow-lg backdrop-blur">
        <p className="font-display text-lg tracking-[0.14em] uppercase">Combien de plis allez-vous remporter ?</p>
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: me.hand.length + 1 }, (_, amount) => (
            <Button key={amount} size="icon-lg" variant={me.bid === amount ? "default" : "secondary"} aria-pressed={me.bid === amount} disabled={sending} onClick={() => onBid(amount)}>
              {amount}
            </Button>
          ))}
        </div>
        {me.bid !== null && <p className="text-xs text-foreground/60">Vous pouvez encore changer votre annonce.</p>}
      </div>
    </div>
  )
}

/** Under the main line of the ticker: the round, and once the bids are revealed what each player won out of what they announced. */
function RoundStatus() {
  const { view } = useGame<PlayerView>()
  const revealed = view.phase === "playing" && view.players.some((p) => p.bid !== null)
  return (
    <>
      {`Manche ${view.round}/${view.options.rounds}${view.options.inverse ? " · la plus basse gagne" : ""}`}
      {revealed && (
        <div className="mt-1.5 flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1 text-xs tracking-[0.12em]">
          <span className="text-foreground/50">Plis / annonces</span>
          {view.players.map((p) => (
            <span key={p.id} className="inline-flex items-baseline gap-1.5">
              <PlayerName id={p.id} />
              <span>
                {p.pointsPerRound.at(-1) ?? 0}/{p.bid}
              </span>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function Table({ onUpdate, onLeave }: Props) {
  const t = useText()
  const api = useApi()
  const { victoryPhrases, hostIcon } = useSkin()
  const { game, view, color, avatarUrl } = useGame<PlayerView>()
  const seat = useSeatTheme()
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
        const { phrase, detail } = winnerAnnouncement(game, view, victoryPhrases, (points) => t("pointsShort", { points }))
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

  async function send(action: { type: string } & Record<string, unknown>) {
    setSending(true)
    try {
      onUpdate(await api.action(game.code, action))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function play(cardId: string) {
    if (myTurn && !sending) await send({ type: "playCard", cardId })
  }

  async function bid(amount: number) {
    if (view.phase === "bidding" && meId && !sending) await send({ type: "bid", amount })
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
      onLeave={onLeave}
      ticker={
        <Ticker
          activePlayerId={ended ? null : view.activePlayerId}
          waitingFor={ended ? undefined : game.waitingFor}
          status={!ended && <RoundStatus />}
          history={history}
        />
      }
      overlay={
        <>
          {announcement}
          <BidPanel sending={sending} onBid={bid} />
          <StalledTurn onUpdate={onUpdate} />
          {ended && !current && <GameOver onUpdate={onUpdate} isOpen={scoresOpen} onToggle={() => setScoresOpen((o) => !o)} />}
          <DebugPanel />
        </>
      }
    >
      <Scene view={view} color={color} avatarUrl={avatarUrl} seat={seat} crownIcon={hostIcon} myTurn={myTurn && !sending} onPlay={play} />
    </GameHud>
  )
}
