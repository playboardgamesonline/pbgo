"use client"

import type { GameEvent } from "@game/engine"
import { button, useControls } from "leva"
import { LogOutIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Announcement, type AnnouncementType, useAnnouncementSettings } from "@/components/game3d/announcement"
import { DebugPanel } from "@/components/game3d/debug"
import { debugTab } from "@/components/game3d/debug-tabs"
import { RulesButton } from "@pgo/core/components/rules"
import { api, type ClientDebugCommand } from "@pgo/core/lib/api"
import type { PublicGame } from "@pgo/core/lib/game-types"
import type { RulesContent } from "@pgo/core/lib/rules"
import { useSiteSettings } from "@pgo/core/components/settings-provider"
import { cn } from "@/lib/utils"
import { GameProvider, useGame } from "@pgo/core/components/game/context"
import { winnerAnnouncement, GameOver } from "@pgo/core/components/game/game-over"

const Scene = dynamic(() => import("@/components/game3d/scene").then((m) => m.Scene), { ssr: false })

let announcementCounter = 0

type QueuedAnnouncement = { id: number; text: string; subtitle?: string; type: AnnouncementType }

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

function eventText(e: GameEvent, nickname: (id: string) => string) {
  if (e.type === "cardPlayed") return `${nickname(e.playerId)} joue ${e.card.value}`
  if (e.type === "trickWon") return `${nickname(e.playerId)} remporte le pli`
  return `Manche ${e.round}`
}

function Table({ rules, onUpdate, onLeave }: Props) {
  const { title } = useSiteSettings()
  const { game, view, nickname, color } = useGame()
  const settings = useAnnouncementSettings()
  const [announcements, setAnnouncements] = useState<QueuedAnnouncement[]>([])
  const [scoresOpen, setScoresOpen] = useState(true)
  const [sending, setSending] = useState(false)
  const previous = useRef<{ round: number; active: string | null; phase: string } | null>(null)

  const meId = view.me?.id ?? null
  const myTurn = view.phase === "playing" && !!meId && view.activePlayerId === meId
  const ended = view.phase === "over"

  function announce(text: string, type: AnnouncementType, subtitle?: string) {
    const id = ++announcementCounter
    setAnnouncements((l) => [...l, { id, text, subtitle, type }])
  }

  useEffect(() => {
    const before = previous.current
    previous.current = { round: view.round, active: view.activePlayerId, phase: view.phase }
    if (view.phase === "over") {
      if (before?.phase !== "over") {
        const { phrase, detail } = winnerAnnouncement(game, view)
        announce(phrase, "victory", detail)
        setScoresOpen(true)
      }
      return
    }
    if (!before || before.phase === "over") announce("C'est parti !", "start", `${view.options.rounds} manche${view.options.rounds > 1 ? "s" : ""}`)
    else if (before.round !== view.round) announce(`Manche ${view.round}`, "start")
    if (myTurn && (before?.active !== view.activePlayerId || before?.round !== view.round)) announce("C'est votre tour", "turn")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phase, view.round, view.activePlayerId])

  const announcement = announcements[0] ?? null
  useEffect(() => {
    if (!announcement) return
    const t = setTimeout(() => setAnnouncements((l) => l.slice(1)), settings[announcement.type].duration * 1000)
    return () => clearTimeout(t)
  }, [announcement, settings])

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
      "Start announcement": button(() => announce("C'est parti !", "start", "3 manches")),
      "Your turn announcement": button(() => announce("C'est votre tour", "turn")),
      "Victory announcement": button(() => announce("Victoire de", "victory", "Oré · 9 pts")),
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

  const latest = view.log.slice(-4).reverse()

  return (
    <div className="game-bg fixed inset-0 overflow-hidden text-foreground">
      <div className="absolute inset-0">
        <Scene view={view} color={color} myTurn={myTurn && !sending} onPlay={play} />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto flex items-center gap-3">
          <p className="font-display text-xl font-black tracking-[0.14em] uppercase">{title}</p>
          <RulesButton rules={rules} />
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="pointer-events-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-foreground/75 transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <LogOutIcon className="size-4" />
          Quitter
        </button>
      </header>

      {!ended && (
        <div className="pointer-events-none absolute top-16 left-4 z-20 flex flex-col items-start gap-0.5">
          <p className="font-display text-sm tracking-[0.2em] text-foreground/55 uppercase tabular-nums">
            Manche {view.round}/{view.options.rounds}
            {view.options.inverse && " · la plus basse gagne"}
          </p>
          <p
            className={cn("font-display text-xl font-black tracking-[0.12em] uppercase", myTurn && "text-accent-game")}
            style={myTurn || !view.activePlayerId ? undefined : { color: color(view.activePlayerId) }}
          >
            {myTurn ? "À vous de jouer" : view.activePlayerId ? `Tour de ${nickname(view.activePlayerId)}` : ""}
          </p>
        </div>
      )}

      {!ended && latest.length > 0 && (
        <ol className="pointer-events-none absolute right-4 bottom-4 z-20 flex flex-col items-end gap-1 text-sm">
          {latest.map((e, i) => (
            <li key={view.log.length - i} className="rounded-md bg-black/35 px-2.5 py-1 text-foreground/80" style={{ opacity: 1 - i * 0.2 }}>
              {eventText(e, nickname)}
            </li>
          ))}
        </ol>
      )}

      <AnimatePresence>{announcement && <Announcement key={announcement.id} text={announcement.text} subtitle={announcement.subtitle} settings={settings[announcement.type]} />}</AnimatePresence>

      {ended && !announcement && <GameOver onUpdate={onUpdate} isOpen={scoresOpen} onToggle={() => setScoresOpen((o) => !o)} />}

      <DebugPanel />
    </div>
  )
}
