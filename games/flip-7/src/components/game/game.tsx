"use client"

import type { PlayerView } from "@flip-7/engine"
import { button, useControls } from "leva"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAnnouncementSettings } from "@pbgo/core/components/game/announcement"
import { GameProvider, useGame } from "@pbgo/core/components/game/context"
import { DebugPanel } from "@pbgo/core/components/game/debug"
import { debugTab } from "@pbgo/core/components/game/debug-tabs"
import { winnerAnnouncement } from "@pbgo/core/components/game/game-over"
import { GameHud, Ticker, useAnnouncements } from "@pbgo/core/components/game/hud"
import { StalledTurn } from "@pbgo/core/components/game/stalled-turn"
import { useSkin, useText } from "@pbgo/core/components/skin-provider"
import type { ClientDebugCommand } from "@pbgo/core/lib/api"
import type { BoardProps } from "@pbgo/core/lib/binding"
import { useApi } from "@pbgo/core/lib/binding-context"
import { seatsOf } from "@pbgo/core/lib/seat-avatar"
import { cn } from "@pbgo/ui/utils"
import { type ClientCatalog, MISSING_CATALOG } from "../../lib/catalog"
import { type TableView, tableView } from "../../lib/view"
import { ActionBar } from "./action-bar"
import { CatalogProvider, useCatalog, useWords } from "./catalog-context"
import { Results } from "./results"
import { SeatTile } from "./seat-tile"
import { fill } from "./sentence"

/** What the Ticker prints under the turn: the round and the score to reach. */
function RoundStatus() {
  const w = useWords()
  const { view } = useGame<TableView>()
  return (
    <>
      <div>{fill(w.round, { round: view.round })}</div>
      <div className="mt-1.5 text-xs tracking-[0.12em] text-foreground/60">{fill(w.goal, { score: view.target })}</div>
    </>
  )
}

/** Flip 7's board: the platform gives the view the engine computed for this player, the catalog the server loaded from Sanity. */
export function Game({ game, data, onUpdate, onLeave }: BoardProps) {
  const view = useMemo(() => (game.view ? tableView(game.view as PlayerView) : null), [game.view])
  const table = useMemo(() => (view ? { ...game, view } : null), [game, view])
  if (!view || !table) return null
  return (
    <CatalogProvider value={(data as ClientCatalog | undefined) ?? MISSING_CATALOG}>
      <GameProvider game={table} view={view}>
        <Table onUpdate={onUpdate} onLeave={onLeave} />
      </GameProvider>
    </CatalogProvider>
  )
}

function Table({ onUpdate, onLeave }: Pick<BoardProps, "onUpdate" | "onLeave">) {
  const t = useText()
  const api = useApi()
  const w = useWords()
  const { matUrl } = useCatalog()
  const { victoryPhrases, playerColors } = useSkin()
  const { game, view } = useGame<TableView>()
  const settings = useAnnouncementSettings()
  const { announce, element: announcement, current } = useAnnouncements(settings)
  const [sending, setSending] = useState(false)
  const previous = useRef<{ phase: string; waited: string | null } | null>(null)
  const announcedRound = useRef<number | null>(null)

  const meId = view.me?.id ?? null
  const ended = view.phase === "over"
  const waited = ended ? null : (game.waitingFor[0] ?? null)
  const seatsFor = (ids: readonly string[]) => seatsOf(game.players, ids, playerColors)

  useEffect(() => {
    const before = previous.current
    previous.current = { phase: view.phase, waited }
    if (view.phase === "over") {
      announcedRound.current = null
      if (before?.phase !== "over") {
        const { phrase, detail, winners } = winnerAnnouncement(game, view, victoryPhrases, (points) => t("pointsShort", { points }))
        announce(phrase, "victory", { subtitle: detail, seats: seatsFor(winners) })
      }
      return
    }
    if ((view.phase === "turn" || view.phase === "target") && announcedRound.current !== view.round) {
      announcedRound.current = view.round
      announce(fill(w.round, { round: view.round }), "round")
    }
    if (meId && waited === meId && before?.waited !== meId) {
      announce(t("yourTurn"), "turn", { replace: ["turn"], seats: seatsFor([meId]) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phase, view.round, waited])

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
      "TURN · play the turn": button(() => runDebugCommand("turn")),
      "OVER · play to the end": button(() => runDebugCommand("over")),
      "BUST · duplicate on top": button(() => runDebugCommand("bustOnTop")),
      "FREEZE · on top": button(() => runDebugCommand("freezeOnTop")),
      "FLIP THREE · on top": button(() => runDebugCommand("flipThreeOnTop")),
      "SECOND CHANCE · on top": button(() => runDebugCommand("secondChanceOnTop")),
      "FLIP 7 · six numbers": button(() => runDebugCommand("flip7")),
    },
    [game.code],
  )
  useControls(
    "Replay",
    {
      "Round announcement": button(() => announce(fill(w.round, { round: 2 }), "round")),
      "Your turn announcement": button(() => announce(t("yourTurn"), "turn", { seats: seatsFor(meId ? [meId] : []) })),
    },
    { order: 1 },
    debugTab("TRANSITION"),
  )

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

  const index = view.players.findIndex((p) => p.id === meId)
  const mine = view.players[index] ?? null
  // The others in the order they sit after me; a spectator sees every seat in seat order.
  const others = mine ? [...view.players.slice(index + 1), ...view.players.slice(0, index)] : view.players
  // Seven opponents do not fit at full size on one screen: from five on, their tiles are narrower and their cards smaller.
  const crowded = others.length > 4

  return (
    <GameHud
      onLeave={onLeave}
      ticker={
        <Ticker
          activePlayerId={waited}
          waitingFor={ended ? undefined : game.waitingFor}
          status={!ended && <RoundStatus />}
          history={[]}
        />
      }
      overlay={
        <>
          {announcement}
          <StalledTurn onUpdate={onUpdate} />
          {ended && !current && <Results onUpdate={onUpdate} />}
          <DebugPanel />
        </>
      }
    >
      <div className="absolute inset-0 flex flex-col bg-cover bg-center" style={matUrl ? { backgroundImage: `url(${matUrl})` } : undefined}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              // The HUD sits at the top left (logo, menu) and the ticker at the top right: the tiles keep clear of both, with the room the chat takes on the right of a tall screen.
              "grid gap-3 px-4 pt-32 pb-3 md:pr-[27rem] short:pt-3 short:pr-44 short:pl-36",
              crowded
                ? "grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] short:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]"
                : "grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] short:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]",
            )}
          >
            {others.map((seat) => (
              <SeatTile key={seat.id} seat={seat} mine={false} compact={crowded} waiting={seat.id === waited} dealer={seat.id === view.dealer} />
            ))}
          </div>
        </div>
        {mine && (
          <div className="shrink-0 px-4 pb-2 md:pr-[27rem] short:pr-16">
            <SeatTile seat={mine} mine waiting={mine.id === waited} dealer={mine.id === view.dealer} />
          </div>
        )}
        <ActionBar sending={sending} onSend={send} />
      </div>
    </GameHud>
  )
}
