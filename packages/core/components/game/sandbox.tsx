"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowUp01Icon, Link01Icon, PlayIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { Button } from "@pbgo/ui/platform/button"
import { Switch } from "@pbgo/ui/platform/switch"
import { cn } from "@pbgo/ui/utils"
import { ApiClientError, type GameApi } from "../../lib/api"
import { ApiOverrideProvider, useBinding } from "../../lib/binding-context"
import type { PublicGame, SavedState } from "../../lib/game-types"
import { NO_RANK_CHANGE } from "../../lib/rank-change"
import { type SandboxAnswer, type SandboxRequest, type SandboxSetup, type SandboxTable, SANDBOX_TURNS, sandboxSearch } from "../../lib/sandbox"
import { ContinueProvider } from "./continue-context"
import { BoardEntry } from "./ready-screen"

/** How long a made-up player takes to play, in milliseconds: long enough to see the move the board draws before the next one */
const BOT_DELAY_MS = 1400

/** A debug command's name as a label: `princessInHand` → "Princess in hand" */
const labelOf = (command: string) => {
  const words = command.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The preview of a game in play (`/<slug>/preview/play`, `lib/sandbox.ts`): the game's own board and the screen around it, at a made-up table that is played against the real engine with no database. Every call the board and the screen make
 * to the game's API is answered from the made-up table (`ApiOverrideProvider`): a move, a turn played for a player, a command of the debug panel, a rematch. The made-up players play by themselves (`Bots`, which can be stopped), and the bar
 * at the top picks how many sit, which seat the table is seen from, a situation to look at (the commands of `GAME.debug`) and a new deal. The address keeps the setup, so that a link opens the same table again (with its `seed`).
 */
export function SandboxClient({ initial, setup: initialSetup, data, bare }: { initial: SandboxAnswer; setup: SandboxSetup; data?: unknown; bare?: boolean }) {
  const { SLUG, GAME, Game } = useBinding()
  const [game, setGame] = useState<PublicGame>(initial.game)
  const [receivedAt, setReceivedAt] = useState(() => performance.now())
  const [setup, setSetup] = useState<SandboxSetup>({ ...initialSetup, seed: initial.table.seed })
  const [viewer, setViewer] = useState(initial.game.meId ?? initial.table.players[0]!.id)
  const [bots, setBots] = useState(true)
  // A new deal or another seat draws the board again from nothing, as a page that opens on it
  const [generation, setGeneration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const table = useRef<SandboxTable>(initial.table)
  // The seat looked from, for the calls of the API, which are made once: changed with `viewer`, by `deal` and `lookFrom`
  const viewerRef = useRef(viewer)
  // One request at a time, in order: a move of the viewer and a made-up player's turn never cross
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const send = useCallback(
    (request: SandboxRequest): Promise<PublicGame> => {
      const run = queue.current.then(async () => {
        const body = request.op === "new" ? request : { ...request, table: table.current, viewer: viewerRef.current }
        const response = await fetch(`/gamemaster/api/${SLUG}/sandbox`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
        const answer = (await response.json().catch(() => ({ error: "SERVER_ERROR" }))) as SandboxAnswer & { error?: string }
        if (!response.ok) throw new ApiClientError(answer.error ?? "SERVER_ERROR")
        table.current = answer.table
        setGame(answer.game)
        setReceivedAt(performance.now())
        setError(null)
        return answer.game
      })
      queue.current = run.catch(() => {})
      return run
    },
    [SLUG],
  )

  const apply = useCallback((next: PublicGame) => {
    setGame((current) => (next.version >= current.version ? next : current))
  }, [])

  const api = useMemo<GameApi>(() => {
    const current = () => send({ op: "view" } as SandboxRequest)
    return {
      create: current,
      read: current,
      join: current,
      leave: current,
      options: current,
      settings: current,
      start: current,
      ready: current,
      action: (_code, action) => send({ op: "action", action } as SandboxRequest),
      tick: () => send({ op: "tick" } as SandboxRequest),
      replay: () => send({ op: "debug", command: "start" } as SandboxRequest),
      rank: async () => ({ ...NO_RANK_CHANGE, recorded: true }),
      takeover: (_code, ids) => send({ op: "playFor", ids } as SandboxRequest),
      custom: () => Promise.reject(new ApiClientError("INVALID_ACTION")),
      debug: (_code, command) => send({ op: "debug", command } as SandboxRequest),
      debugState: async (): Promise<SavedState> => ({ game: SLUG, players: table.current.players.map((player) => player.id), state: table.current.state, savedAt: new Date().toISOString() }),
      debugLoad: (_code, saved) => send({ op: "load", saved } as SandboxRequest),
      chat: async (_code, body) => ({ ...body, playerId: viewerRef.current, at: Date.now() }) as never,
      link: () => window.location.href,
    }
  }, [send, SLUG])

  // The made-up players play their turns, one move at a time: everybody the game waits for but the seat looked from
  const others = game.status === "playing" ? game.waitingFor.filter((id) => id !== viewer) : []
  const othersKey = others.join(",")
  useEffect(() => {
    if (!bots || !othersKey) return
    const timer = setTimeout(() => void send({ op: "playFor", ids: othersKey.split(",") } as SandboxRequest).catch((e: Error) => setError(e.message)), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [bots, othersKey, game.version, send])

  /** A new table for this setup; the address says it, so that it opens again as it is */
  const deal = useCallback(
    async (next: SandboxSetup) => {
      try {
        const answer = await send({ op: "new", setup: next })
        const seed = table.current.seed
        const seat = table.current.players[Math.min(next.seat, table.current.players.length - 1)]!.id
        setSetup({ ...next, seed })
        viewerRef.current = seat
        setViewer(seat)
        setGeneration((g) => g + 1)
        window.history.replaceState(null, "", `${window.location.pathname}${sandboxSearch({ ...next, seed })}`)
        return answer
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [send],
  )

  const lookFrom = useCallback(
    async (id: string) => {
      viewerRef.current = id
      setViewer(id)
      const next = { ...setup, seat: Math.max(0, table.current.players.findIndex((player) => player.id === id)) }
      setSetup(next)
      window.history.replaceState(null, "", `${window.location.pathname}${sandboxSearch(next)}`)
      await send({ op: "view" } as SandboxRequest).catch((e: Error) => setError(e.message))
      setGeneration((g) => g + 1)
    },
    [send, setup],
  )

  const scenarios = Object.keys(GAME?.debug ?? {})
  if (!Game) return null

  return (
    <ApiOverrideProvider api={api}>
      <ContinueProvider value={() => void deal({ ...setup, seed: null, scenario: null, turns: SANDBOX_TURNS })}>
        <BoardEntry key={generation} game={game} receivedAt={receivedAt} reload={() => void send({ op: "view" } as SandboxRequest)} data={data} onUpdate={apply} onLeave={() => void deal({ ...setup, seed: null })} />
      </ContinueProvider>
      {!bare && (
        <SandboxBar
          game={game}
          setup={setup}
          minPlayers={GAME?.minPlayers ?? 1}
          maxPlayers={GAME?.maxPlayers ?? 1}
          viewer={viewer}
          bots={bots}
          error={error}
          scenarios={scenarios}
          onBots={setBots}
          onSeat={(id) => void lookFrom(id)}
          onDeal={(next) => void deal(next)}
          onScenario={(command) => void send({ op: "debug", command } as SandboxRequest).catch((e: Error) => setError(e.message))}
          onPlayFor={() => void send({ op: "playFor", ids: game.waitingFor } as SandboxRequest).catch((e: Error) => setError(e.message))}
        />
      )}
    </ApiOverrideProvider>
  )
}

/** The bar of the preview, folded by default to one small pill at the top of the screen, so that what is looked at is the board */
function SandboxBar({
  game,
  setup,
  minPlayers,
  maxPlayers,
  viewer,
  bots,
  error,
  scenarios,
  onBots,
  onSeat,
  onDeal,
  onScenario,
  onPlayFor,
}: {
  game: PublicGame
  setup: SandboxSetup
  minPlayers: number
  maxPlayers: number
  viewer: string
  bots: boolean
  error: string | null
  scenarios: string[]
  onBots: (on: boolean) => void
  onSeat: (id: string) => void
  onDeal: (setup: SandboxSetup) => void
  onScenario: (command: string) => void
  onPlayFor: () => void
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const me = game.players.find((player) => player.id === viewer)
  const count = game.players.length
  const fresh = (players: number) => ({ ...setup, players, seat: Math.min(setup.seat, players - 1), seed: null })

  return (
    <div className="platform pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 font-sans text-foreground">
      <div className="pointer-events-auto flex max-w-xl flex-col items-stretch gap-3 rounded-2xl border glass p-2 shadow-surface">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-2 px-2 text-sm" aria-expanded={open}>
          <span className="font-medium">Preview</span>
          <span className="text-muted-foreground">
            {me?.nickname ?? "?"} · {count} players{game.status === "over" ? " · game over" : ""}
          </span>
          <HugeiconsIcon icon={open ? ArrowUp01Icon : ArrowDown01Icon} className="size-4" />
        </button>
        {error && <p className="px-2 text-sm text-destructive">{error}</p>}
        {open && (
          <div className="flex flex-col gap-3 px-2 pb-1 text-sm">
            <Row label="Players">
              <Button size="icon-sm" variant="outline" disabled={count <= minPlayers} onClick={() => onDeal(fresh(count - 1))} aria-label="One player less">
                −
              </Button>
              <span className="w-6 text-center tabular-nums">{count}</span>
              <Button size="icon-sm" variant="outline" disabled={count >= maxPlayers} onClick={() => onDeal(fresh(count + 1))} aria-label="One player more">
                +
              </Button>
            </Row>
            <Row label="Seen by">
              {game.players.map((player) => (
                <Button key={player.id} size="xs" variant={player.id === viewer ? "default" : "outline"} onClick={() => onSeat(player.id)}>
                  {player.nickname}
                </Button>
              ))}
            </Row>
            <Row label="Bots">
              <Switch size="sm" checked={bots} onCheckedChange={onBots} aria-label="The other players play by themselves" />
              <Button size="xs" variant="outline" disabled={game.status !== "playing" || !game.waitingFor.length} onClick={onPlayFor}>
                <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
                Play their turn
              </Button>
            </Row>
            {scenarios.length > 0 && (
              <Row label="Situation">
                {scenarios.map((command) => (
                  <Button key={command} size="xs" variant="secondary" onClick={() => onScenario(command)}>
                    {labelOf(command)}
                  </Button>
                ))}
              </Row>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onDeal({ ...setup, seed: null, scenario: null, turns: SANDBOX_TURNS })}>
                <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
                New game
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.href).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  })
                }}
              >
                <HugeiconsIcon icon={Link01Icon} data-icon="inline-start" />
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
