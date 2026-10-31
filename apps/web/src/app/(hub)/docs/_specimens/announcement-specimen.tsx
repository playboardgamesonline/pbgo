"use client"

import { useEffect, useMemo, useState } from "react"
import { AnnouncementPresence } from "@pbgo/core/components/game/announcement-view"
import { ANNOUNCEMENT_PRESETS, announcementSettings } from "@pbgo/core/lib/announcement-settings"
import { resolveMotion } from "@pbgo/core/lib/motion-preference"
import { seatTheme } from "@pbgo/core/lib/ui-theme"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { Button } from "@pbgo/ui/platform/button"
import { Label } from "@pbgo/ui/platform/label"
import { Switch } from "@pbgo/ui/platform/switch"
import { Tabs, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { Crown, GameScope, TABLE_BACKDROP, type GameLook } from "./game-scope"
import { Stage } from "./scaled"

const KINDS = ["start", "round", "turn", "victory"] as const
type Kind = (typeof KINDS)[number]

/** The same neutral copy on every game, so only the look differs from one side to the other */
const COPY: Record<Kind, { text: string; subtitle?: string }> = {
  start: { text: "Game on", subtitle: "Four players at the table" },
  round: { text: "Round 2", subtitle: "Second of five" },
  turn: { text: "Your turn" },
  victory: { text: "Winner", subtitle: "Ana" },
}

/** The seat an announcement shows: the winner of a victory, the player of a turn (the other kinds show none) */
const NICKNAME = "Ana"

/** One announcement on one game's stage: it is there on mount, plays, and leaves after its own duration unless it is held */
function Player({ look, kind, reduce, hold }: { look: GameLook; kind: Kind; reduce: boolean; hold: boolean }) {
  const [shown, setShown] = useState(true)
  const prefersReduced = usePrefersReducedMotion()
  const settings = useMemo(() => announcementSettings(ANNOUNCEMENT_PRESETS[kind], look.ui?.announcement), [kind, look])
  useEffect(() => {
    if (hold) return
    const id = setTimeout(() => setShown(false), settings.duration * 1000)
    return () => clearTimeout(id)
  }, [hold, settings.duration])
  return (
    <AnnouncementPresence
      show={shown}
      text={COPY[kind].text}
      subtitle={COPY[kind].subtitle}
      settings={settings}
      motion={resolveMotion(prefersReduced || reduce, look.ui?.motion)}
      seats={[{ nickname: NICKNAME, color: look.playerColors[0] }]}
      seatTheme={seatTheme(look.ui?.seat)}
      crown={<Crown className="size-[1em]" />}
    />
  )
}

/** The four announcements of every game, two games side by side: pick one, replay it, hold it on screen, or ask for reduced motion */
export function AnnouncementSpecimen({ looks }: { looks: readonly GameLook[] }) {
  const [kind, setKind] = useState<Kind>("start")
  const [reduce, setReduce] = useState(false)
  const [hold, setHold] = useState(false)
  const [run, setRun] = useState(0)
  // They only start once they are on screen, or they would be over before anyone scrolls here
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!root) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { threshold: 0.3 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [root])

  return (
    <div ref={setRoot} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Tabs value={kind} onValueChange={(value) => setKind(value as Kind)}>
          <TabsList>
            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k} className="capitalize">
                {k}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
          Replay
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="announcement-reduce" size="sm" checked={reduce} onCheckedChange={setReduce} />
          <Label htmlFor="announcement-reduce">Reduce motion</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="announcement-hold" size="sm" checked={hold} onCheckedChange={setHold} />
          <Label htmlFor="announcement-hold">Hold</Label>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {looks.map((look) => (
          <div key={look.slug} className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {look.name} · {look.ui?.motion ?? "calm"} motion
            </p>
            <GameScope look={look} className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <Stage>
                <div className="absolute inset-0" style={{ background: TABLE_BACKDROP }} />
                {visible && <Player key={`${kind}-${run}-${reduce}`} look={look} kind={kind} reduce={reduce} hold={hold} />}
              </Stage>
            </GameScope>
          </div>
        ))}
      </div>
    </div>
  )
}
