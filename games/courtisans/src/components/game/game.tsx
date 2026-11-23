"use client"

import type { CourtisansEvent, Courtier, PlayerView, PlayZone, Target } from "@courtisans/engine"
import { Loader2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Announcement, useAnnouncementSettings } from "@pbgo/core/components/game/announcement"
import { GameProvider } from "@pbgo/core/components/game/context"
import { button, copyButton, debugTab, DebugSlot, useControls, useDebugTools } from "@pbgo/core/components/game/debug-controls"
import { GameOver, winnerAnnouncement } from "@pbgo/core/components/game/game-over"
import { GameHud, groupTurns, Ticker, useAnnouncements } from "@pbgo/core/components/game/hud"
import { StalledTurn } from "@pbgo/core/components/game/stalled-turn"
import { useLogSounds } from "@pbgo/core/components/game/use-log-sounds"
import { PrimaryButton } from "@pbgo/core/components/home/screen"
import { useSkin, useText } from "@pbgo/core/components/skin-provider"
import { useApi } from "@pbgo/core/lib/binding-context"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import { seatsOf } from "@pbgo/core/lib/seat-avatar"
import { MISSING_CATALOG, type ClientCatalog } from "../../lib/catalog"
import { CourtisansProvider, useCourtisans } from "./context"
import { renderFamilyCards } from "./score-details"
import { Message } from "./message"
import { useEndingSequence } from "../board/ending"
import { cuesOf, useBoardSounds } from "../board/sounds"
import { useCheat } from "../board/cheat"
import { type Assassination, type Interaction, InteractionContext } from "./interaction"
import type { OpeningStep } from "../board/scene"

const Scene3D = dynamic(() => import("../board/scene"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center">
      <Loader2Icon className="size-8 animate-spin text-primary" />
    </div>
  ),
})

const noop = () => {}

const mustRead = (view: PlayerView) => view.phase !== "over" && !!view.me && !view.players.find((j) => j.id === view.me?.id)?.missionsRead

type GameProps = {
  game: PublicGame
  data?: unknown
  onUpdate: (p: PublicGame) => void
  onLeave: () => void
  held?: boolean
  onLoaded?: () => void
  onProgress?: (progress: number) => void
}

/**
 * Courtisans board plugged into @pbgo/core (`Game` of the game's UI binding). `data` = Sanity catalog loaded on the server. `held`, `onLoaded` and `onProgress` are the start screen's (PLT-107): behind it the board is drawn, loads its pictures, says how far it is
 * and when it is done, and holds its opening (the camera's entrance, the mat, the deal) until the screen goes.
 */
export function Game({ game, data, onUpdate, onLeave, held = false, onLoaded, onProgress }: GameProps) {
  // Leva is loaded on demand (debug mode only): the board remounts once with the real controls.
  const debugTools = useDebugTools()
  if (!game.view) return null
  return (
    <Board
      key={debugTools ? "debug" : "play"}
      game={game}
      catalog={(data as ClientCatalog | undefined) ?? MISSING_CATALOG}
      onUpdate={onUpdate}
      onLeave={onLeave}
      held={held}
      onLoaded={onLoaded}
      onProgress={onProgress}
    />
  )
}

type BoardProps = {
  game: PublicGame
  catalog: ClientCatalog
  onUpdate: (p: PublicGame) => void
  onLeave: () => void
  held: boolean
  onLoaded?: () => void
  onProgress?: (progress: number) => void
}

/** The providers of the table: the game and its view (the debug tool that makes a winner changes the view), the game's catalog. The screen is `BoardContent`, which reads them and the log of the table. */
function Board(props: BoardProps) {
  const { game, catalog } = props
  const nicknameOf = useCallback((id: string) => game.players.find((j) => j.id === id)?.nickname ?? "?", [game.players])
  const view = useCheat(game.view as PlayerView, nicknameOf)
  const gameView = useMemo(() => ({ ...game, view }), [game, view])
  return (
    <GameProvider game={gameView} view={view}>
      <CourtisansProvider catalog={catalog} game={gameView} view={view}>
        <BoardContent {...props} view={view} />
      </CourtisansProvider>
    </GameProvider>
  )
}

function BoardContent({
  game,
  view,
  catalog,
  onUpdate,
  onLeave,
  held,
  onLoaded,
  onProgress,
}: BoardProps & { view: PlayerView }) {
  const t = useText()
  const api = useApi()
  const { victoryPhrases, playerColors } = useSkin()
  // What happened at the table, as the platform keeps it for this player: the state and the view hold no log
  const { log } = useCourtisans()
  // The players shown with an announcement (the viewer for "your turn", the winners for the victory)
  const seatsFor = (ids: readonly string[]) => seatsOf(game.players, ids, playerColors)
  const [rawSelection, setSelection] = useState<Courtier | null>(null)
  const [assassination, setAssassination] = useState<Assassination | null>(null)
  const [sending, setSending] = useState(false)
  const [missionFocus, setMissionFocus] = useState<string | null>(null)
  const { ending, skip } = useEndingSequence(view)
  const [openingStep, setOpeningStep] = useState<OpeningStep>(() => (mustRead(view) ? "unroll" : null))
  const [showMissionsButton, setShowMissionsButton] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [marker, setMarker] = useState(`${view.phase}:${view.activePlayerId}:${mustRead(view) ? 1 : 0}`)
  const announcementSettings = useAnnouncementSettings()
  const { announce, clear: clearAnnouncements, element: announcementElement } = useAnnouncements(announcementSettings, { paused: openingStep !== null || held })
  const currentMarker = `${view.phase}:${view.activePlayerId}:${mustRead(view) ? 1 : 0}`
  if (marker !== currentMarker) {
    const [prevPhase, prevActive, prevRead] = marker.split(":")
    setMarker(currentMarker)
    const turnChanged = prevPhase !== view.phase || prevActive !== String(view.activePlayerId)
    if (view.phase === "playing" && prevPhase === "missions") {
      // the server received the reading of EVERY player: the banquet starts for everyone at the same time
      setShowMissionsButton(false)
      setOpeningStep(null)
      announce(catalog.banquetStartText, "start", { sound: "victory", first: true, replace: ["start", "turn"] })
    } else if (view.phase === "playing" && prevRead === "1" && !mustRead(view)) {
      // game already started (saved before the banquet waited for everyone): my reading has nobody to wait for
      setShowMissionsButton(false)
      setOpeningStep(null)
    }
    if (turnChanged && view.phase === "playing" && view.me && view.activePlayerId === view.me.id)
      announce(t("yourTurn"), "turn", { sound: "turn", replace: ["turn"], seats: seatsFor([view.me.id]) })
    if (mustRead(view) && prevRead !== "1") {
      setShowMissionsButton(false)
      setOpeningStep("unroll")
    }
  }
  const intro = openingStep === "missions"
  const readCount = view.players.filter((j) => j.missionsRead).length
  const iAmReady = !!view.me && !!view.players.find((j) => j.id === view.me?.id)?.missionsRead
  const waitingOthers = view.phase === "missions" && iAmReady
  // the unroll and the deal hold the announcement back: no turn is shown until the missions can be read
  const openingHolds = openingStep === "unroll" || openingStep === "deal"
  const shownTurn = openingHolds
    ? null
    : view.phase === "playing"
      ? view.activePlayerId
      : view.phase === "missions"
        ? (view.firstPlayerId ?? null)
        : null
  const playerCount = view.players.length

  const [openingSettings] = useControls(
    "Opening",
    () => ({
      matDuration: { value: 3.2, min: 0.3, max: 6, step: 0.05, label: "mat unroll (s)" },
      dealStep: { value: 0.4, min: 0.05, max: 0.6, step: 0.01, label: "deal step (s)" },
      buttonDelay: { value: 1.6, min: 0, max: 5, step: 0.1, label: "button delay (s)" },
      ...copyButton("TRANSITION", "Opening"),
    }),
    { order: 0 },
    debugTab("TRANSITION"),
  )
  useControls(
    "Replay",
    {
      "Full opening": button(() => {
        setShowMissionsButton(false)
        setOpeningStep("unroll")
      }),
      "Banquet announcement": button(() => announce(catalog.banquetStartText, "start", { sound: "victory" })),
      "Your turn announcement": button(() => announce(t("yourTurn"), "turn", { sound: "turn", seats: seatsFor(view.me ? [view.me.id] : []) })),
      "Victory announcement": button(() => {
        const { phrase, detail, winners } = winnerAnnouncement(game, view, victoryPhrases, (points) => t("pointsShort", { points }))
        announce(phrase || t("winnerTitle"), "victory", {
          subtitle: detail || `${game.players[0]?.nickname ?? "?"} · 9 pts`,
          sound: "victory",
          seats: seatsFor(winners.length ? winners : game.players.slice(0, 1).map((p) => p.id)),
        })
      }),
    },
    { order: 1 },
    debugTab("TRANSITION"),
    [catalog.banquetStartText],
  )
  useControls(
    "Phases",
    {
      "START · new game": button(() => debugCommand("start")),
      "MISSIONS · everyone read": button(() => debugCommand("missions")),
      "NEXT TURN · play 3 cards": button(() => debugCommand("turn")),
      "END · play to the end": button(() => debugCommand("over")),
    },
    [game.code],
  )
  const [ready, setReady] = useState(false)
  const sceneReady = useCallback(() => setReady(true), [])
  useEffect(() => {
    // The start screen holds the opening: it starts the moment the screen goes
    if (!ready || held) return
    if (openingStep === "unroll") {
      const t = setTimeout(() => setOpeningStep("deal"), (openingSettings.matDuration + 0.3) * 1000)
      return () => clearTimeout(t)
    }
    if (openingStep === "deal") {
      const t = setTimeout(() => setOpeningStep("missions"), (0.1 + playerCount * 3 * openingSettings.dealStep) * 1000 + 1300)
      return () => clearTimeout(t)
    }
    if (openingStep === "missions") {
      const t = setTimeout(() => setShowMissionsButton(true), openingSettings.buttonDelay * 1000)
      return () => clearTimeout(t)
    }
  }, [openingStep, playerCount, ready, held, openingSettings])

  const meId = view.me?.id
  const myTurn = view.phase === "playing" && !!meId && view.activePlayerId === meId
  const selection = rawSelection && view.me?.hand.some((c) => c.id === rawSelection.id) && myTurn ? rawSelection : null
  useLogSounds<CourtisansEvent>({ cues: cuesOf })
  useBoardSounds(ending, missionFocus)

  function debugCommand(command: "start" | "missions" | "turn" | "over") {
    api
      .debug(game.code, command)
      .then((p) => {
        onUpdate(p)
        if (command === "start") {
          setShowMissionsButton(false)
          clearAnnouncements()
          setOpeningStep("unroll")
        }
      })
      .catch((e: Error) => toast.error(e.message))
  }

  // The click does not start the banquet: it records my reading. The server moves the game from "missions" to "playing"
  // when the last player has confirmed, and this phase change, received by all, closes the opening and triggers the announcement (see the marker).
  async function confirmMissions() {
    if (confirming) return
    setConfirming(true)
    try {
      await markMissionsRead()
    } finally {
      setConfirming(false)
    }
  }

  // Every player confirms the opening at almost the same time: the server already retries, the client retries too.
  // If the reading is still not recorded, the player sees it and can click again (otherwise the table would wait for nothing).
  async function markMissionsRead(attempt = 0): Promise<void> {
    try {
      onUpdate(await api.action(game.code, { type: "readMissions" }))
    } catch (e) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700 * (attempt + 1)))
        return markMissionsRead(attempt + 1)
      }
      toast.error((e as Error).message)
    }
  }

  const interaction = useMemo<Interaction>(() => {
    async function send(cardId: number, target: Target, victimId?: number) {
      setSending(true)
      try {
        onUpdate(
          await api.action(game.code, {
            type: "playCard",
            cardId,
            target,
            victimId,
          }),
        )
        setSelection(null)
        setAssassination(null)
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setSending(false)
      }
    }
    return {
      myTurn,
      selection,
      select: setSelection,
      assassination,
      sending,
      canPlay: (zone: PlayZone) => myTurn && view.availableZones.includes(zone),
      originOf: () => null,
      play: (target) => {
        if (!selection) return
        if (selection.role === "assassin") {
          const cards = target.zone === "table" ? view.table.map((p) => p.card) : (view.players.find((j) => j.id === target.playerId)?.domain ?? [])
          const candidates = cards.filter((c) => c.role !== "guard").map((c) => c.id)
          if (candidates.length > 0) {
            setAssassination({ cardId: selection.id, target, candidates })
            return
          }
        }
        send(selection.id, target)
      },
      eliminate: (cardId) => {
        if (assassination) send(assassination.cardId, assassination.target, cardId ?? undefined)
      },
    }
  }, [myTurn, selection, assassination, sending, view, onUpdate, game.code, api])

  const history = useMemo(
    () =>
      groupTurns<CourtisansEvent>(
        log.map((line) => line.event),
        {
          actor: (e) => (e.type === "gameOver" ? null : e.playerId),
          closes: (e) => e.type === "draw",
          render: (e) => (e.type === "cardPlayed" || e.type === "cardEliminated" ? <Message event={e} className="justify-start" /> : null),
        },
      ),
    [log],
  )
  const victory = ending?.text && !ending.scoreboard ? winnerAnnouncement(game, view, victoryPhrases, (points) => t("pointsShort", { points })) : null

  return (
    <InteractionContext.Provider value={interaction}>
      <GameHud
        onLeave={onLeave}
        ticker={<Ticker activePlayerId={shownTurn} waitingFor={openingHolds ? undefined : game.waitingFor} history={history} sentences />}
        overlay={
          <>
            {(waitingOthers || (intro && showMissionsButton)) && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 20 }}
                className="absolute inset-x-0 bottom-[14%] z-20 flex justify-center"
              >
                <PrimaryButton onClick={confirmMissions} busy={confirming} waiting={waitingOthers} className="w-auto max-w-none px-10 whitespace-nowrap">
                  {waitingOthers ? t("missionsWaiting", { read: readCount, total: playerCount }) : catalog.missionsButtonText}
                </PrimaryButton>
              </motion.div>
            )}

            {announcementElement}

            <StalledTurn
              onUpdate={onUpdate}
              labels={view.phase === "missions" ? { prompt: t("missionsSkipPrompt"), button: t("missionsSkipButton") } : undefined}
            />

            <DebugSlot />

            <AnimatePresence>
              {victory && (
                <Announcement
                  key="victory"
                  text={victory.phrase}
                  subtitle={victory.detail}
                  sound="victory"
                  seats={seatsFor(victory.winners)}
                  settings={announcementSettings.victory}
                />
              )}
            </AnimatePresence>
            {ending?.scoreboard && <GameOver onUpdate={onUpdate} renderDetail={renderFamilyCards} history={history} sentences />}
          </>
        }
      >
        <Scene3D
          openingStep={openingStep}
          onReady={sceneReady}
          held={held}
          onLoaded={onLoaded ?? noop}
          onProgress={onProgress ?? noop}
          settings={openingSettings}
          missionFocus={missionFocus}
          ending={ending}
          onSkip={skip}
          onMission={(id) => setMissionFocus((f) => (f === id ? null : id))}
          onEmpty={() => {
            setMissionFocus(null)
            if (!assassination) setSelection(null)
          }}
        />
      </GameHud>
    </InteractionContext.Provider>
  )
}
