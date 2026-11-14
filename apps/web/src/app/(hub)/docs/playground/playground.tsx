"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Link01Icon, Refresh01Icon, Redo02Icon, Search01Icon, Tick02Icon, Undo02Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addStrokes, drawFromBag, EngineError, restoreRng } from "@pbgo/engine-kit"
import { PromptHost } from "@pbgo/core/components/game/prompt-host"
import { Button } from "@pbgo/ui/platform/button"
import { Input } from "@pbgo/ui/platform/input"
import { Logo } from "@pbgo/ui/platform/logo"
import { NavbarBrand } from "@pbgo/ui/platform/navbar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { Tabs, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { PLAY_LIMITS, PRESET_IDS, type PlayActions, type PlayPart, type PlayPiece, type PlayState, type PlayThing, SKETCH_BRUSHES, SKETCH_COLORS } from "../_specimens/scene/defaults"
import { SceneFrame } from "../_specimens/scene/frame"
import { BOX, lay, view } from "../_specimens/scene/landscape"
import { PlaygroundGuard, PlaygroundScene, PlaygroundTuning } from "../_specimens/scene/lazy"
import { canRedo, canUndo, type History, type Kind, record, redo, startHistory, undo } from "../_specimens/scene/play/history"
import { DEFAULT_PRESET, PRESETS, presetState } from "../_specimens/scene/play/presets"
import { isTyping, shortcutFor } from "../_specimens/scene/play/shortcuts"
import { addPoints, addThing, deal, dealRound, flip, giveTo, hit, movePiece, newCard, newPiece, nextTurn, endRound, removeThing, rollDice, sendCard, showParts, stay, take } from "../_specimens/scene/play/state"
import { runTransition, type TransitionId } from "../_specimens/scene/play/transitions"
import { decodeScene, encodeScene } from "../_specimens/scene/play/url"
import { PLAY_TILES } from "../_specimens/scene/defaults"
import type { Controls } from "./controls/context"
import { Help } from "./controls/help"
import { AddPanel, PlayPanel, ScenePanel } from "./controls/panels"
import { PartsPanel } from "./controls/parts-panel"
import { Scoreboard, Ticker } from "./controls/scoreboard"

// The playground, a page of its own: the table fills the window and the controls are at its side. It holds what lies on the table and which parts of it are on (`PlayState`, in a stack of states for the undo), the controls that change them, and the tuning of every
// component. The table is the scene (`three/playground.tsx`), a function of this state that sends back what the pointer did in it. Every change of the table is a pure function of the state (`_specimens/scene/play/`), so the buttons, the keys and the pointer do the same
// thing the same way. Every control has the keyboard's way to what a pointer does on the table. Nothing is saved: the scene is in the address (its name and what differs from it), not what lies on the table.

/** What the stack does with a change of these fields: the camera, the pick and the clock leave no entry; a slider's drags are one */
const VIEW_ONLY = new Set(["zoom", "tilt", "above", "selected", "clock", "seat"])
const CONTINUOUS = new Set(["stepper", "slider", "stack", "counter", "marker", "text", "bet", "face", "presses"])
const classify = (keys: readonly string[]): Kind => (keys.every((key) => VIEW_ONLY.has(key)) ? "ignore" : keys.length === 1 && CONTINUOUS.has(keys[0]!) ? "merge" : "push")
/** An undo or a redo gives back the table, not the camera, the pick or the clock */
const keepView = (wanted: PlayState, now: PlayState): PlayState => ({
  ...wanted,
  zoom: now.zoom,
  tilt: now.tilt,
  above: now.above,
  clock: now.clock,
  seat: now.seat,
  selected: wanted.things.some((one) => one.id === now.selected) ? now.selected : null,
})

/** The sheet keeps what the engine keeps: strokes that do not fit are let go, as a board that was told no would */
const SKETCH_RULES = { colors: SKETCH_COLORS.length, widths: SKETCH_BRUSHES.length }

const TABS = ["scene", "add", "parts", "play", "tuning"] as const
type Tab = (typeof TABS)[number]
const TAB_NAMES: Record<Tab, string> = { scene: "Scene", add: "Add", parts: "Parts", play: "Play", tuning: "Tuning" }

export function Playground() {
  const [history, setHistory] = useState<History<PlayState>>(() => startHistory(presetState(DEFAULT_PRESET)))
  const [tab, setTab] = useState<Tab>("scene")
  const [shape, setShape] = useState<PlayPiece>("pawn")
  const [query, setQuery] = useState("")
  const [helpOpen, setHelpOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [last, setLast] = useState<TransitionId | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const guard = useRef<{ restore: () => void } | null>(null)
  const state = history.present

  // The change of the table: one function of the state, put on the stack
  const update = useCallback((change: (now: PlayState) => PlayState) => setHistory((h) => record(h, change(h.present), classify)), [])
  const set = useCallback((patch: Partial<PlayState>) => update((now) => ({ ...now, ...patch })), [update])
  const things = state.things
  const full = things.length >= PLAY_LIMITS.things

  const startFrom = useCallback((id: PlayState["scene"]) => update(() => presetState(id)), [update])
  const run = useCallback(
    (id: TransitionId) => {
      setLast(id)
      update((now) => runTransition(now, id))
    },
    [update],
  )
  const doUndo = useCallback(() => setHistory((h) => undo(h, keepView)), [])
  const doRedo = useCallback(() => setHistory((h) => redo(h, keepView)), [])
  // Replay takes the last change back and gives it again, a moment apart: the same state arrives twice, so the table shows the same motion twice
  const replay = useCallback(() => {
    if (!canUndo(history)) return
    doUndo()
    window.setTimeout(doRedo, 700)
  }, [history, doUndo, doRedo])
  const reset = useCallback(() => {
    guard.current?.restore()
    update(() => presetState(state.scene))
  }, [update, state.scene])

  const showPart = useCallback((part: PlayPart, on: boolean) => update((now) => showParts(now, [part], on)), [update])

  const actions: PlayActions = useMemo(
    () => ({
      select: (id) => update((now) => ({ ...now, selected: id })),
      move: (id, x, z) => update((now) => ({ ...now, things: now.things.map((one) => (one.id === id ? { ...one, x, z } : one)) })),
      remove: (id) => update((now) => removeThing(now, id)),
      draw: () =>
        update((now) => {
          if (now.things.length >= PLAY_LIMITS.things) return now
          const rng = restoreRng(now.bag.rng)
          const { drawn, bag } = drawFromBag(rng, now.bag.counts, 1)
          const kind = drawn[0]
          if (kind === undefined) return now
          const placed = addThing(now, (id, at): PlayThing => ({ id, kind: "piece", shape: "disc", paint: kind, x: at.x, z: at.z, fromBag: true }))
          return { ...placed, bag: { counts: bag, rng: rng.save(), drawn: now.bag.drawn + 1 } }
        }),
      peek: () => update((now) => ({ ...now, cup: now.cup === "covering" ? "lifted" : "covering" })),
      write: (text) => set({ text }),
      count: (stepper) => set({ stepper }),
      slide: (slider) => set({ slider }),
      bet: (value) => set({ bet: value }),
      pick: (face) => set({ face }),
      place: (id, to, at) => update((now) => sendCard(now, id, to, at)),
      deal: () => update(deal),
      take: () => update(take),
      press: () => update((now) => ({ ...now, presses: now.presses + 1 })),
      pickSeat: (seat) => set({ seat }),
      claim: (road) => update((now) => ({ ...now, map: { ...now.map, claimed: now.map.claimed.map((held, i) => (i === road ? !held : held)) } })),
      visit: (city) => update((now) => ({ ...now, map: { ...now.map, city } })),
      layTile: (place) =>
        update((now) => {
          const here = view(now.tiles.laid, BOX, now.tiles.index, now.tiles.spin, PLAY_TILES.table)
          const at = here.spots[place]
          if (!here.name || !at || !here.fits.includes(place)) return now
          const next = lay(now.tiles.laid, BOX, now.tiles.index, at, here.turns, PLAY_TILES.table)
          return { ...now, tiles: { laid: next.laid, index: next.index, spin: 0 } }
        }),
      turnTile: () => update((now) => (view(now.tiles.laid, BOX, now.tiles.index, now.tiles.spin, PLAY_TILES.table).options.length > 1 ? { ...now, tiles: { ...now.tiles, spin: now.tiles.spin + 1 } } : now)),
      mark: (box) => update((now) => ({ ...now, sheet: { ...now.sheet, marks: now.sheet.marks.map((had, at) => (at === box ? (had === now.sheet.mark ? null : now.sheet.mark) : had)) } })),
      ink: (incoming) =>
        update((now) => {
          try {
            return { ...now, sketch: { ...now.sketch, strokes: addStrokes(now.sketch.strokes, incoming, SKETCH_RULES) } }
          } catch (error) {
            if (error instanceof EngineError) return now
            throw error
          }
        }),
      give: (seat) => update((now) => giveTo(now, seat)),
      hit: () => update(hit),
      stay: () => update(stay),
      dealRound: () => update(dealRound),
      hop: () => update(movePiece),
      addCard: () => update((now) => addThing(now, newCard)),
      addPiece: (kind) => update((now) => addThing(now, newPiece(kind))),
      flip: () => update(flip),
    }),
    [update, set],
  )
  const controls: Controls = { state, set, update, actions, full }

  // The scene is in the address: what differs from the scene it began as, a moment after the last change
  const loaded = useRef(false)
  useEffect(() => {
    // The address is outside the page's state: the table it names replaces the first one once the page is in the browser (the server drew the default)
    const found = decodeScene(window.location.hash)
    if (found) queueMicrotask(() => setHistory(startHistory(found.state)))
    loaded.current = true
  }, [])
  const hash = useMemo(() => encodeScene(state), [state])
  useEffect(() => {
    if (!loaded.current) return
    const timer = window.setTimeout(() => window.history.replaceState(window.history.state, "", `#${hash}`), 300)
    return () => window.clearTimeout(timer)
  }, [hash])
  const share = () => {
    void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#${hash}`).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  const focusSearch = useCallback(() => {
    setTab((now) => (now === "tuning" ? now : "parts"))
    window.setTimeout(() => search.current?.focus(), 0)
  }, [])

  // The keyboard: the shortcuts of the list in `play/shortcuts.ts`, not while the visitor types in a field, a menu or a dialog
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const found = shortcutFor(event)
      if (!found) return
      const target = event.target as HTMLElement | null
      // Undo and redo are the page's even in the search box? No: a field has its own, which the browser gives it
      if (isTyping(target) || document.querySelector('[role="dialog"][data-state="open"]')) return
      event.preventDefault()
      if (typeof found === "object") return startFrom(found.scene)
      const transition = (["deal", "flip", "move", "playCard", "discard", "pass"] as const).includes(found as never) ? (found as TransitionId) : null
      if (transition) return run(transition)
      switch (found) {
        case "undo":
          return doUndo()
        case "redo":
          return doRedo()
        case "reset":
          return reset()
        case "nextTurn":
          return update(nextTurn)
        case "point":
          return update((now) => addPoints(now, now.turn, 1))
        case "endRound":
          return update(endRound)
        case "roll":
          return update(rollDice)
        case "addCard":
          return actions.addCard()
        case "addPiece":
          return actions.addPiece(shape)
        case "remove":
          return state.selected !== null ? actions.remove(state.selected) : undefined
        case "putDown":
          return set({ selected: null })
        case "above":
          return set({ above: !state.above })
        case "search":
          return focusSearch()
        case "help":
          return setHelpOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [actions, doRedo, doUndo, focusSearch, reset, run, set, shape, startFrom, state.above, state.selected, update])

  const searchable = tab === "parts" || tab === "tuning"

  return (
    <div className="flex h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-4">
        <NavbarBrand asChild>
          <Link href="/docs" aria-label="All docs" title="All docs">
            <Logo className="h-6" />
          </Link>
        </NavbarBrand>
        <h1 className="font-heading text-xl max-sm:sr-only">Playground</h1>
        <Select value={state.scene} onValueChange={(id) => startFrom(id as PlayState["scene"])}>
          <SelectTrigger aria-label="Scene" className="ml-1 h-9 w-40 sm:ml-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {PRESETS[id].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!canUndo(history)} onClick={doUndo}>
            <HugeiconsIcon icon={Undo02Icon} strokeWidth={2} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" disabled={!canRedo(history)} onClick={doRedo}>
            <HugeiconsIcon icon={Redo02Icon} strokeWidth={2} />
          </Button>
          <Button variant="ghost" size="sm" onClick={reset} title="Put the scene and the tuning back as they start (Shift R)">
            <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} data-icon="inline-start" />
            Reset
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={share} title="Copy a link to this scene">
            <HugeiconsIcon icon={copied ? Tick02Icon : Link01Icon} strokeWidth={2} data-icon="inline-start" />
            {copied ? "Copied" : "Share"}
          </Button>
          <Help open={helpOpen} onOpenChange={setHelpOpen} />
          <Link href="/docs/engine" className="ml-1 hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline">
            Engine docs
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="relative min-h-0 flex-1 max-lg:min-h-[45svh]">
          <SceneFrame
            fill
            label="A card table with every component of the package on it: a ring of seats with their plates, a draw pile and a discard pile, floor buttons, a hand of cards in the bottom left, a board of squares, hexagons or a ring, a track with a marker, a counter, a stepper, a slider, an hourglass, a bag, a cup, a tray of dice, fields to write and choose in, a sheet of paper to draw on, a stack of coins, a paper button, a map of cities and roads, a sheet of boxes to tick, a table of tiles, and cards and pieces that can be dragged anywhere, onto a cell of the board or into the bin"
          >
            <PlaygroundScene state={state} actions={actions} />
          </SceneFrame>
          {state.parts.scoreboard && (
            <>
              <Scoreboard state={state} onPick={(seat) => actions.pickSeat(state.seat === seat ? null : seat)} />
              <Ticker line={state.log[0]} />
            </>
          )}
        </main>
        <aside aria-label="Controls" className="@container flex w-full shrink-0 flex-col border-t max-lg:h-[45svh] lg:w-[26rem] lg:border-t-0 lg:border-l">
          <div className="flex flex-col gap-3 border-b p-4 pb-3">
            <Tabs
              value={tab}
              onValueChange={(next) => {
                setTab(next as Tab)
              }}
            >
              <TabsList className="w-full">
                {TABS.map((name) => (
                  <TabsTrigger key={name} value={name} className="flex-1 px-2">
                    {TAB_NAMES[name]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {searchable && (
              <div className="relative">
                <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={search}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Escape" && (setQuery(""), event.currentTarget.blur())}
                  placeholder={tab === "parts" ? "Search the parts: hand, dice, hex, score…" : "Search the settings: glide, shadow, flight…"}
                  aria-label={tab === "parts" ? "Search the parts" : "Search the settings"}
                  className="pr-9 pl-9"
                />
                {query && (
                  <Button variant="ghost" size="icon-xs" aria-label="Clear the search" className="absolute top-1/2 right-1.5 -translate-y-1/2" onClick={() => setQuery("")}>
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                  </Button>
                )}
              </div>
            )}
          </div>
          <div key={tab} className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "scene" && <ScenePanel controls={controls} onScene={startFrom} />}
            {tab === "add" && <AddPanel controls={controls} shape={shape} onShape={setShape} />}
            {tab === "parts" && <PartsPanel controls={controls} query={query} onShow={showPart} />}
            {tab === "play" && <PlayPanel controls={controls} onRun={run} last={last} onReplay={replay} canReplay={canUndo(history)} />}
            {tab === "tuning" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">A slider for every number a component reads on every frame.</p>
                  <Button variant="ghost" size="sm" onClick={() => guard.current?.restore()}>
                    Put the settings back
                  </Button>
                </div>
                <PlaygroundTuning query={query} />
              </div>
            )}
            <PromptHost />
          </div>
        </aside>
      </div>
      <PlaygroundGuard apiRef={guard} />
    </div>
  )
}
