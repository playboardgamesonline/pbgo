"use client"

import type { Target, Courtier, PlayerView, PlayZone, VisibleEvent } from "@courtisans/engine"
import { Loader2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { button, useControls } from "leva"
import { toast } from "sonner"
import { Announcement, useAnnouncementSettings } from "@pbgo/core/components/game/announcement"
import { GameProvider } from "@pbgo/core/components/game/context"
import { DebugPanel } from "@pbgo/core/components/game/debug"
import { copyButton, debugTab } from "@pbgo/core/components/game/debug-tabs"
import { GameOver, winnerAnnouncement } from "@pbgo/core/components/game/game-over"
import { GameHud, groupTurns, Ticker, useAnnouncements } from "@pbgo/core/components/game/hud"
import { StalledTurn } from "@pbgo/core/components/game/stalled-turn"
import { PrimaryButton } from "@pbgo/core/components/home/screen"
import { useSkin, useText } from "@pbgo/core/components/skin-provider"
import { api } from "@pbgo/core/lib/api"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import type { RulesContent } from "@pbgo/core/lib/rules"
import { Button } from "@pbgo/ui/game/button"
import { DEFAULT_CATALOG, type ClientCatalog } from "@/lib/catalog"
import { CourtisansProvider } from "./context"
import { renderFamilyCards } from "./score-details"
import { Message } from "./message"
import { useEndingSequence } from "../game3d/ending"
import { useGameSounds } from "../game3d/sounds"
import { useCheat } from "../game3d/cheat"
import { type Assassination, type Interaction, InteractionContext } from "./interaction"
import type { OpeningStep } from "../game3d/scene"

const Scene3D = dynamic(() => import("../game3d/scene"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center">
      <Loader2Icon className="size-8 animate-spin text-primary" />
    </div>
  ),
})

const mustRead = (view: PlayerView) => view.phase !== "over" && !!view.me && !view.players.find((j) => j.id === view.me?.id)?.missionsRead

type GameProps = { game: PublicGame; rules: RulesContent; data?: unknown; onUpdate: (p: PublicGame) => void; onLeave: () => void }

/** Plateau de Courtisans branché sur @pbgo/core (`Game` de @pbgo/binding-ui). `data` = catalogue Sanity chargé côté serveur. */
export function Game({ game, rules, data, onUpdate, onLeave }: GameProps) {
  if (!game.view) return null
  return <Board game={game} rules={rules} catalog={(data as ClientCatalog | undefined) ?? DEFAULT_CATALOG} onUpdate={onUpdate} onLeave={onLeave} />
}

function Board({
  game,
  rules,
  catalog,
  onUpdate,
  onLeave,
}: {
  game: PublicGame
  rules: RulesContent
  catalog: ClientCatalog
  onUpdate: (p: PublicGame) => void
  onLeave: () => void
}) {
  const t = useText()
  const { victoryPhrases } = useSkin()
  const nicknameOf = useCallback((id: string) => game.players.find((j) => j.id === id)?.nickname ?? "?", [game.players])
  const view = useCheat(game.view as PlayerView, nicknameOf)
  const gameView = useMemo(() => ({ ...game, view }), [game, view])
  const [scoresOpen, setScoresOpen] = useState(true)
  const [rawSelection, setSelection] = useState<Courtier | null>(null)
  const [assassination, setAssassination] = useState<Assassination | null>(null)
  const [sending, setSending] = useState(false)
  const [missionFocus, setMissionFocus] = useState<string | null>(null)
  const { ending, skip } = useEndingSequence(view)
  const [openingStep, setOpeningStep] = useState<OpeningStep>(() => (mustRead(view) ? "unroll" : null))
  const [showMissionsButton, setShowMissionsButton] = useState(false)
  const [marker, setMarker] = useState(`${view.phase}:${view.activePlayerId}:${mustRead(view) ? 1 : 0}`)
  const announcementSettings = useAnnouncementSettings()
  const { announce, clear: clearAnnouncements, element: announcementElement } = useAnnouncements(announcementSettings, { paused: openingStep !== null })
  const currentMarker = `${view.phase}:${view.activePlayerId}:${mustRead(view) ? 1 : 0}`
  if (marker !== currentMarker) {
    const [prevPhase, prevActive, prevRead] = marker.split(":")
    setMarker(currentMarker)
    const turnChanged = prevPhase !== view.phase || prevActive !== String(view.activePlayerId)
    if (view.phase === "playing" && prevPhase === "missions") announce(catalog.banquetStartText, "start", { sound: "victory", first: true })
    if (turnChanged && view.phase === "playing" && view.me && view.activePlayerId === view.me.id)
      announce(t("yourTurn"), "turn", { sound: "turn", replace: ["turn"] })
    if (mustRead(view) && prevRead !== "1") {
      setShowMissionsButton(false)
      setOpeningStep("unroll")
    }
  }
  const intro = openingStep === "missions"
  const shownTurn =
    openingStep === "unroll" || openingStep === "deal"
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
      "Your turn announcement": button(() => announce(t("yourTurn"), "turn", { sound: "turn" })),
      "Victory announcement": button(() => {
        const { phrase, detail } = winnerAnnouncement(game, view, victoryPhrases)
        announce(phrase || "Toute la cour s'incline devant", "victory", { subtitle: detail || "Oré · 9 pts", sound: "victory" })
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
    if (!ready) return
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
  }, [openingStep, playerCount, ready, openingSettings])

  const meId = view.me?.id
  const myTurn = view.phase === "playing" && !!meId && view.activePlayerId === meId
  const selection = rawSelection && view.me?.hand.some((c) => c.id === rawSelection.id) && myTurn ? rawSelection : null
  useGameSounds(view, ending, selection?.id ?? null, missionFocus)

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

  function finishIntro() {
    setShowMissionsButton(false)
    setOpeningStep(null)
    announce(catalog.banquetStartText, "start", { sound: "victory", first: true, replace: ["start", "turn"] })
    if (view.phase === "playing" && view.me && view.activePlayerId === view.me.id) announce(t("yourTurn"), "turn", { sound: "turn" })
    void markMissionsRead()
  }

  // Tous les joueurs valident l'ouverture presque en même temps : le serveur réessaie déjà, on retente aussi côté client
  async function markMissionsRead(attempt = 0): Promise<void> {
    try {
      onUpdate(await api.action(game.code, { type: "readMissions" }))
    } catch {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700 * (attempt + 1)))
        return markMissionsRead(attempt + 1)
      }
    }
  }

  const interaction = useMemo<Interaction>(() => {
    async function send(cardId: string, target: Target, victimId?: string) {
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
  }, [myTurn, selection, assassination, sending, view, onUpdate, game.code])

  const history = useMemo(
    () =>
      groupTurns<VisibleEvent>(view.log, {
        actor: (e) => (e.type === "gameOver" ? null : e.playerId),
        closes: (e) => e.type === "draw",
        render: (e) => (e.type === "cardPlayed" || e.type === "cardEliminated" ? <Message event={e} className="justify-end" /> : null),
      }),
    [view.log],
  )
  const victory = ending?.text && !ending.scoreboard ? winnerAnnouncement(game, view, victoryPhrases) : null

  return (
    <GameProvider game={gameView} view={view}>
      <CourtisansProvider catalog={catalog} game={gameView} view={view}>
        <InteractionContext.Provider value={interaction}>
          <GameHud
            rules={rules}
            onLeave={onLeave}
            ticker={<Ticker activePlayerId={shownTurn} history={history} />}
            overlay={
              <>
                {intro && showMissionsButton && (
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 160, damping: 20 }}
                    className="absolute inset-x-0 bottom-[14%] z-20 flex justify-center"
                  >
                    <PrimaryButton onClick={finishIntro} className="w-auto max-w-none px-10">
                      {catalog.missionsButtonText}
                    </PrimaryButton>
                  </motion.div>
                )}

                {announcementElement}

                <StalledTurn activePlayerId={view.activePlayerId} onUpdate={onUpdate} />

                <DebugPanel />

                <AnimatePresence>
                  {assassination && (
                    <motion.div
                      initial={{ y: 80, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 80, opacity: 0 }}
                      className="absolute inset-x-0 bottom-8 z-30 mx-auto w-fit"
                    >
                      <Button
                        size="lg"
                        disabled={sending}
                        onClick={() => interaction.eliminate(null)}
                        className="h-12 rounded-full border border-[#ff4d4d]/70 bg-[#3a0d12] px-8 font-display text-base text-foreground shadow-[0_0_24px_rgb(255_77_77/35%)] hover:bg-[#5a1219]"
                      >
                        Ne pas assassiner
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {victory && (
                    <Announcement key="victory" text={victory.phrase} subtitle={victory.detail} sound="victory" settings={announcementSettings.victory} />
                  )}
                </AnimatePresence>
                {ending && !ending.scoreboard && (
                  <button
                    type="button"
                    className="absolute right-6 bottom-6 z-40 h-10 cursor-pointer rounded-xl bg-foreground px-6 font-display text-base tracking-wide text-background shadow-[0_10px_30px_rgb(0_0_0/55%),0_0_28px_color-mix(in_oklab,var(--foreground)_30%,transparent)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
                    onClick={skip}
                  >
                    Passer
                  </button>
                )}
                {ending?.scoreboard && (
                  <GameOver onUpdate={onUpdate} isOpen={scoresOpen} onToggle={() => setScoresOpen((o) => !o)} renderDetail={renderFamilyCards} />
                )}
              </>
            }
          >
            <Scene3D
              openingStep={openingStep}
              onReady={sceneReady}
              settings={openingSettings}
              missionFocus={missionFocus}
              ending={ending}
              onMission={(id) => setMissionFocus((f) => (f === id ? null : id))}
              onEmpty={() => {
                setMissionFocus(null)
                if (!assassination) setSelection(null)
              }}
            />
          </GameHud>
        </InteractionContext.Provider>
      </CourtisansProvider>
    </GameProvider>
  )
}
