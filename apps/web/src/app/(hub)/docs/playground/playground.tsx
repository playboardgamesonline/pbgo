"use client"

import Link from "next/link"
import { type ReactNode, useState } from "react"
import { addStrokes, bagSize, createSaveableRng, drawFromBag, drawingPoints, emptyDrawing, EngineError, restoreRng, undoStroke } from "@pbgo/engine-kit"
import { askChoice, askNumber, askText } from "@pbgo/core/components/game/prompt"
import { PromptHost } from "@pbgo/core/components/game/prompt-host"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { NavbarBrand } from "@pbgo/ui/platform/navbar"
import { Tabs, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { Choice, Knob, Option } from "../_specimens/scene/controls"
import {
  BAG_SEED,
  BAG_START,
  BET_MOST,
  BID_FACES,
  DICE_SHAPES,
  DICE_SIDES,
  type DiceShape,
  FIELD_LENGTH,
  LAYOUTS,
  PLAY_CLOCK,
  PLAY_CUP_POSES,
  PLAY_DECK,
  PLAY_GLOWS,
  PLAY_LIMITS,
  PLAY_NAMES,
  PLAY_NUMBERS,
  PLAY_PART_NAMES,
  PLAY_PIECES,
  PLAY_SKETCH,
  PLAY_STACK,
  type PlayActions,
  type PlayCard,
  type PlayPart,
  type PlayPiece,
  type PlayPlace,
  type PlayState,
  type PlayThing,
  SKETCH_BRUSHES,
  SKETCH_COLORS,
} from "../_specimens/scene/defaults"
import { SceneFrame } from "../_specimens/scene/frame"
import { PlaygroundScene, PlaygroundTuning } from "../_specimens/scene/lazy"

// The playground, a page of its own: the table fills the window and the controls are at its side. It holds what lies on the table and which parts of it are on, the controls that change them, and the tuning of every component. The table is the scene (`three/playground.tsx`), a function of this state that sends back what the pointer did
// in it. Every control has the keyboard's way to what a pointer does on the table, and nothing is saved: the playground is as it starts when the page is.

/** Where a thing is put when it is added: the first place of a grid in the middle of the table that has nothing near it. */
const SLOTS = Array.from({ length: 24 }, (_, n) => ({ x: -2.4 + (n % 4) * 1.6, z: -2.4 + Math.floor(n / 4) * 2.1 }))
const freeSlot = (things: readonly PlayThing[]) => SLOTS.find((slot) => !things.some((thing) => Math.hypot(thing.x - slot.x, thing.z - slot.z) < 1)) ?? { x: 0, z: 0 }

const rollFor = (shape: DiceShape) => Array.from({ length: PLAY_LIMITS.dice }, () => 1 + Math.floor(Math.random() * DICE_SIDES[shape]))
/** What the playground's sheet is kept under: the engine's own limits, for a palette and brushes of the specimens' sizes */
const SHEET_RULES = { colors: SKETCH_COLORS.length, widths: SKETCH_BRUSHES.length }
/** The parts that lie beyond the rest of the table: the camera backs off to at least this distance when one is switched on */
const BACK_OFF: Partial<Record<PlayPart, number>> = { seats: 28, sketch: PLAY_SKETCH.zoom, hand: 28, piles: 28, stack: 28, paper: 28 }

const freshBag = () => ({ counts: [...BAG_START], rng: createSaveableRng(BAG_SEED).save(), drawn: 0 })

/** The number the face of the k-th card drawn from the deck is painted from: the 36 numbers come once each before any returns. */
const deckCard = (k: number) => (k * 7 + 3) % 36

/** Sends card `id`, wherever it lies (the table, the hand, the discard pile), to `to`. A card that has nowhere to go, because the hand or the table is full, stays where it is. */
function sendCard(now: PlayState, id: number, to: PlayPlace, at: { x: number; z: number } = { x: 0, z: 0 }): PlayState {
  const onTable = now.things.find((one) => one.id === id && one.kind === "card")
  const inHand = now.hand.cards.find((one) => one.id === id)
  const onDiscard = now.piles.discard.find((one) => one.id === id)
  const card = onTable?.kind === "card" ? onTable.card : (inHand ?? onDiscard)?.card
  if (card === undefined) return now
  const where = onTable ? "table" : inHand ? "hand" : "discard"
  if (to === where && to !== "table") return now
  if (to === "table" && where === "table") return { ...now, things: now.things.map((one) => (one.id === id ? { ...one, x: at.x, z: at.z } : one)) }
  if (to === "hand" && now.hand.cards.length >= PLAY_DECK.hand) return now
  if (to === "table" && now.things.length >= PLAY_LIMITS.things) return now
  const entry: PlayCard = { id, card }
  const things = now.things.filter((one) => one.id !== id)
  return {
    ...now,
    things: to === "table" ? [...things, { id, kind: "card", card, x: at.x, z: at.z, face: "up" }] : things,
    selected: to === "table" || now.selected !== id ? now.selected : null,
    hand: { ...now.hand, cards: [...now.hand.cards.filter((one) => one.id !== id), ...(to === "hand" ? [entry] : [])] },
    piles: { ...now.piles, discard: [...now.piles.discard.filter((one) => one.id !== id), ...(to === "discard" ? [entry] : [])] },
  }
}

/** The top card of the draw pile is dealt: to the hand when the hand is on and has room, otherwise onto the table. */
function deal(now: PlayState): PlayState {
  if (now.piles.drawn >= PLAY_DECK.size) return now
  const id = now.nextId
  const card = deckCard(now.piles.drawn)
  // The draw pile held this many cards, which is where the card flies in from
  const from = PLAY_DECK.size - now.piles.drawn
  const piles = { ...now.piles, drawn: now.piles.drawn + 1 }
  if (now.parts.hand && now.hand.cards.length < PLAY_DECK.hand) return { ...now, nextId: id + 1, piles, hand: { ...now.hand, cards: [...now.hand.cards, { id, card, from }] } }
  if (now.things.length >= PLAY_LIMITS.things) return now
  const at = freeSlot(now.things)
  return { ...now, nextId: id + 1, piles, things: [...now.things, { id, kind: "card", card, x: at.x, z: at.z, face: "up", from }] }
}

/** The top piece of the stack is taken onto the table. */
function take(now: PlayState): PlayState {
  if (now.stack === 0 || now.things.length >= PLAY_LIMITS.things) return now
  const at = freeSlot(now.things)
  return { ...now, nextId: now.nextId + 1, stack: now.stack - 1, things: [...now.things, { id: now.nextId, kind: "piece", shape: "disc", paint: 2, x: at.x, z: at.z, fromBag: false, fromStack: now.stack }] }
}

const START: PlayState = {
  things: [
    { id: 1, kind: "card", card: 12, x: -1.6, z: -1.4, face: "up" },
    { id: 2, kind: "card", card: 21, x: 0, z: -1.4, face: "up" },
    { id: 3, kind: "card", card: 30, x: 1.6, z: -1.4, face: "down" },
    { id: 4, kind: "piece", shape: "pawn", paint: 0, x: -1.6, z: 1.6, fromBag: false },
    { id: 5, kind: "piece", shape: "cube", paint: 2, x: 0, z: 1.6, fromBag: false },
    { id: 6, kind: "piece", shape: "disc", paint: 1, x: 1.6, z: 1.6, fromBag: false },
  ],
  nextId: 12,
  selected: null,
  parts: { board: true, track: true, counter: true, stepper: true, slider: true, timer: true, bag: true, cup: true, dice: true, fields: true, sketch: false, hand: false, piles: false, stack: false, paper: false, seats: false },
  counter: 12,
  stepper: PLAY_NUMBERS.stepper.start,
  slider: PLAY_NUMBERS.slider.start,
  clock: { endsAt: null },
  marker: 0,
  cup: "covering",
  dice: { shape: "d6", count: 3, values: [3, 5, 1, 6, 2, 4], rolls: 0 },
  bag: freshBag(),
  text: "",
  bet: null,
  face: null,
  sketch: { strokes: emptyDrawing(), color: 0, width: 1 },
  glow: "halo",
  hand: {
    cards: [
      { id: 7, card: 3 },
      { id: 8, card: 9 },
      { id: 9, card: 14 },
      { id: 10, card: 18 },
      { id: 11, card: 23 },
    ],
    layout: "fan",
  },
  piles: { drawn: 0, discard: [] },
  stack: PLAY_STACK.start,
  presses: 0,
  seat: null,
  players: 4,
  above: false,
  zoom: PLAY_LIMITS.zoom.start,
  tilt: PLAY_LIMITS.tilt.start,
}

/** A part of the table with its switch, and what its controls are when it is on. */
function Part({ part, on, onChange, children }: { part: PlayPart; on: boolean; onChange: (on: boolean) => void; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <Option label={PLAY_PART_NAMES[part]} checked={on} onChange={onChange} />
      {on && children && <div className="flex flex-wrap items-end gap-x-6 gap-y-3">{children}</div>}
    </div>
  )
}

export function Playground() {
  const [state, setState] = useState<PlayState>(START)
  const [tab, setTab] = useState("things")
  const [shape, setShape] = useState<PlayPiece>("pawn")
  const set = (patch: Partial<PlayState>) => setState((now) => ({ ...now, ...patch }))

  const { things, selected, parts } = state
  const thing = things.find((one) => one.id === selected) ?? null
  const left = bagSize(state.bag.counts)
  const full = things.length >= PLAY_LIMITS.things

  const add = (make: (id: number, at: { x: number; z: number }) => PlayThing) =>
    setState((now) => (now.things.length >= PLAY_LIMITS.things ? now : { ...now, things: [...now.things, make(now.nextId, freeSlot(now.things))], nextId: now.nextId + 1 }))
  const actions: PlayActions = {
    select: (id) => set({ selected: id }),
    move: (id, x, z) => setState((now) => ({ ...now, things: now.things.map((one) => (one.id === id ? { ...one, x, z } : one)) })),
    remove: (id) => setState((now) => ({ ...now, things: now.things.filter((one) => one.id !== id), selected: now.selected === id ? null : now.selected })),
    draw: () =>
      setState((now) => {
        if (now.things.length >= PLAY_LIMITS.things) return now
        const rng = restoreRng(now.bag.rng)
        const { drawn, bag } = drawFromBag(rng, now.bag.counts, 1)
        const kind = drawn[0]
        if (kind === undefined) return now
        const at = freeSlot(now.things)
        const token: PlayThing = { id: now.nextId, kind: "piece", shape: "disc", paint: kind, x: at.x, z: at.z, fromBag: true }
        return { ...now, things: [...now.things, token], nextId: now.nextId + 1, bag: { counts: bag, rng: rng.save(), drawn: now.bag.drawn + 1 } }
      }),
    peek: () => setState((now) => ({ ...now, cup: now.cup === "covering" ? "lifted" : "covering" })),
    write: (text) => set({ text }),
    count: (stepper) => set({ stepper }),
    slide: (slider) => set({ slider }),
    bet: (value) => set({ bet: value }),
    pick: (face) => set({ face }),
    place: (id, to, at) => setState((now) => sendCard(now, id, to, at)),
    deal: () => setState(deal),
    take: () => setState(take),
    press: () => setState((now) => ({ ...now, presses: now.presses + 1 })),
    pickSeat: (seat) => set({ seat }),
    // The sheet keeps what the engine keeps: strokes that do not fit are let go, as a board that was told no would
    ink: (incoming) =>
      setState((now) => {
        try {
          return { ...now, sketch: { ...now.sketch, strokes: addStrokes(now.sketch.strokes, incoming, SHEET_RULES) } }
        } catch (error) {
          if (error instanceof EngineError) return now
          throw error
        }
      }),
  }
  const pen = (patch: Partial<PlayState["sketch"]>) => setState((now) => ({ ...now, sketch: { ...now.sketch, ...patch } }))

  // The seats stand on a ring wider than the rest of the table, and the sheet, the hand, the piles, the stack and the paper lie beyond it, so the camera backs off to see them
  const showPart = (part: PlayPart, on: boolean) => {
    const farthest = BACK_OFF[part]
    set({ parts: { ...parts, [part]: on }, ...(on && farthest !== undefined ? { zoom: Math.max(state.zoom, farthest) } : {}) })
  }
  const roll = () => setState((now) => ({ ...now, dice: { ...now.dice, values: rollFor(now.dice.shape), rolls: now.dice.rolls + 1 } }))
  const askClue = () => void askText({ title: "Your clue", description: "One word that the others will guess from.", value: state.text, placeholder: "Press to write a clue", rules: { max: FIELD_LENGTH.start, lines: 1 } }).then((text) => text !== null && set({ text }))
  const askBet = () => askNumber({ title: "Your bet", description: "How many tricks you think you will win.", value: state.bet ?? undefined, min: 0, max: BET_MOST }).then((value) => value !== null && set({ bet: value }))
  const askFace = () => askChoice({ title: "Your face", description: "The face of the die you bet on.", options: BID_FACES, value: state.face ?? undefined, instant: true }).then((value) => value !== null && set({ face: value }))

  return (
    <div className="flex h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <NavbarBrand asChild>
          <Link href="/docs" aria-label="All docs" title="All docs">
            <Logo className="h-6" />
          </Link>
        </NavbarBrand>
        <h1 className="font-heading text-xl">Playground</h1>
        <Link href="/docs/engine" className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground">
          Engine docs
        </Link>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="min-h-0 flex-1 max-lg:min-h-[45svh]">
          <SceneFrame
            fill
            label="A card table with every component of the package on it: a board of squares, a track with a marker, a counter, a stepper, a slider, an hourglass, a bag, a cup, a tray of dice, three fields to write and choose in, a sheet of paper to draw on, a hand of cards, a draw pile and a discard pile, a stack of coins, a paper button, and cards and pieces that can be dragged anywhere, onto a cell of the board or into the bin"
          >
            <PlaygroundScene state={state} actions={actions} />
          </SceneFrame>
        </main>
        <aside aria-label="Controls" className="@container w-full shrink-0 overflow-y-auto border-t p-4 max-lg:h-[45svh] lg:w-[26rem] lg:border-t-0 lg:border-l">
          <div className="flex w-full flex-col gap-5">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="things">Things</TabsTrigger>
                <TabsTrigger value="parts">Parts</TabsTrigger>
                <TabsTrigger value="view">View</TabsTrigger>
                <TabsTrigger value="tuning">Tuning</TabsTrigger>
              </TabsList>
            </Tabs>

            {tab === "things" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <Button variant="outline" size="sm" disabled={full} onClick={() => add((id, at) => ({ id, kind: "card", card: (id * 7) % 36, x: at.x, z: at.z, face: "up" }))}>
                    Add a card
                  </Button>
                  <Choice label="Piece" value={shape} options={PLAY_PIECES.map((value) => ({ value, label: value }))} onChange={setShape} />
                  <Button variant="outline" size="sm" disabled={full} onClick={() => add((id, at) => ({ id, kind: "piece", shape, paint: id % 6, x: at.x, z: at.z, fromBag: false }))}>
                    Add a {shape}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={things.length === 0} onClick={() => set({ things: [], selected: null })}>
                    Clear the table
                  </Button>
                </div>
                <div className="flex min-h-9 flex-wrap items-center gap-3">
                  {thing ? (
                    <>
                      <span className="text-sm text-muted-foreground">The {thing.kind === "card" ? "card" : thing.shape} that is picked:</span>
                      {thing.kind === "card" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setState((now) => ({ ...now, things: now.things.map((one) => (one.id === thing.id && one.kind === "card" ? { ...one, face: one.face === "up" ? "down" : "up" } : one)) }))}>
                            Turn it over
                          </Button>
                          <Choice label="Glow" value={state.glow} options={PLAY_GLOWS.map((value) => ({ value, label: value }))} onChange={(glow) => set({ glow })} />
                        </>
                      )}
                      <Button variant="outline" size="sm" onClick={() => actions.remove(thing.id)}>
                        Remove it
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => set({ selected: null })}>
                        Put it down
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Press a card or a piece on the table to pick it.</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  <span className="text-foreground tabular-nums">{things.length}</span> of {PLAY_LIMITS.things} things on the table. Drag one anywhere: let it go on a cell of the board and it takes the cell, on the bin and it is gone, and a card let go on the hand or the discard pile joins it.
                </p>
              </div>
            )}

            {tab === "parts" && (
              <div className="grid gap-3 @lg:grid-cols-2">
                <Part part="board" on={parts.board} onChange={(on) => showPart("board", on)}>
                  <p className="text-sm text-muted-foreground">Drop a card or a piece on a cell: it takes the cell.</p>
                </Part>
                <Part part="track" on={parts.track} onChange={(on) => showPart("track", on)}>
                  <Button variant="outline" size="sm" disabled={state.marker === 0} onClick={() => set({ marker: Math.max(0, state.marker - 1) })}>
                    Back a space
                  </Button>
                  <Button variant="outline" size="sm" disabled={state.marker >= PLAY_LIMITS.spaces - 1} onClick={() => set({ marker: Math.min(PLAY_LIMITS.spaces - 1, state.marker + 1) })}>
                    On a space
                  </Button>
                  <Button variant="ghost" size="sm" disabled={state.marker === 0} onClick={() => set({ marker: 0 })}>
                    Back to the start
                  </Button>
                </Part>
                <Part part="counter" on={parts.counter} onChange={(on) => showPart("counter", on)}>
                  <Button variant="outline" size="sm" disabled={state.counter === 0} onClick={() => set({ counter: Math.max(0, state.counter - 1) })}>
                    One less
                  </Button>
                  <Button variant="outline" size="sm" disabled={state.counter >= PLAY_LIMITS.counter} onClick={() => set({ counter: Math.min(PLAY_LIMITS.counter, state.counter + 1) })}>
                    One more
                  </Button>
                  <Button variant="outline" size="sm" disabled={state.counter >= PLAY_LIMITS.counter} onClick={() => set({ counter: Math.min(PLAY_LIMITS.counter, state.counter + 10) })}>
                    Ten more
                  </Button>
                </Part>
                <Part part="stepper" on={parts.stepper} onChange={(on) => showPart("stepper", on)}>
                  <Knob label="Count" value={state.stepper} min={PLAY_NUMBERS.stepper.min} max={PLAY_NUMBERS.stepper.max} step={1} onChange={actions.count} />
                </Part>
                <Part part="slider" on={parts.slider} onChange={(on) => showPart("slider", on)}>
                  <Knob label="Bet" value={state.slider} min={PLAY_NUMBERS.slider.min} max={PLAY_NUMBERS.slider.max} step={PLAY_NUMBERS.slider.step} onChange={actions.slide} />
                </Part>
                <Part part="timer" on={parts.timer} onChange={(on) => showPart("timer", on)}>
                  <Button variant="outline" size="sm" onClick={() => set({ clock: { endsAt: performance.now() + PLAY_CLOCK.seconds * 1000 } })}>
                    Start a step
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => set({ clock: { endsAt: performance.now() + 4000 } })}>
                    Run out in 4 seconds
                  </Button>
                  <Button variant="ghost" size="sm" disabled={state.clock.endsAt === null} onClick={() => set({ clock: { endsAt: null } })}>
                    Fill it again
                  </Button>
                </Part>
                <Part part="bag" on={parts.bag} onChange={(on) => showPart("bag", on)}>
                  <Button variant="outline" size="sm" disabled={left === 0 || full} onClick={actions.draw}>
                    Draw a token
                  </Button>
                  <Button variant="ghost" size="sm" disabled={state.bag.drawn === 0} onClick={() => setState((now) => ({ ...now, bag: freshBag(), things: now.things.filter((one) => !(one.kind === "piece" && one.fromBag)), selected: null }))}>
                    Put the tokens back
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    <span className="text-foreground tabular-nums">{left}</span> of {bagSize(BAG_START)} left
                  </span>
                </Part>
                <Part part="cup" on={parts.cup} onChange={(on) => showPart("cup", on)}>
                  <Choice label="Pose" value={state.cup} options={PLAY_CUP_POSES.map((value) => ({ value, label: value }))} onChange={(cup) => set({ cup })} />
                </Part>
                <Part part="dice" on={parts.dice} onChange={(on) => showPart("dice", on)}>
                  <Choice
                    label="Dice"
                    value={state.dice.shape}
                    options={DICE_SHAPES.map((value) => ({ value, label: value }))}
                    onChange={(next) => setState((now) => ({ ...now, dice: { ...now.dice, shape: next, values: rollFor(next) } }))}
                  />
                  <Knob label="How many" value={state.dice.count} min={1} max={PLAY_LIMITS.dice} step={1} onChange={(count) => setState((now) => ({ ...now, dice: { ...now.dice, count } }))} />
                  <Button variant="outline" size="sm" onClick={roll}>
                    Roll
                  </Button>
                </Part>
                <Part part="fields" on={parts.fields} onChange={(on) => showPart("fields", on)}>
                  <Button variant="outline" size="sm" onClick={askClue}>
                    Write a clue
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void askBet()}>
                    Bet
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void askFace()}>
                    Pick a face
                  </Button>
                </Part>
                <Part part="sketch" on={parts.sketch} onChange={(on) => showPart("sketch", on)}>
                  <Choice label="Colour" value={String(state.sketch.color)} options={SKETCH_COLORS.map((name, k) => ({ value: String(k), label: name, description: `${name} ink` }))} onChange={(color) => pen({ color: Number(color) })} />
                  <Choice label="Brush" value={String(state.sketch.width)} options={SKETCH_BRUSHES.map((brush, k) => ({ value: String(k), label: brush.name, description: `${brush.name} brush` }))} onChange={(width) => pen({ width: Number(width) })} />
                  <Button variant="outline" size="sm" disabled={state.sketch.strokes.length === 0} onClick={() => setState((now) => ({ ...now, sketch: { ...now.sketch, strokes: undoStroke(now.sketch.strokes) } }))}>
                    Undo a stroke
                  </Button>
                  <Button variant="ghost" size="sm" disabled={state.sketch.strokes.length === 0} onClick={() => pen({ strokes: emptyDrawing() })}>
                    Clear
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    <span className="text-foreground tabular-nums">{state.sketch.strokes.length}</span> strokes, <span className="text-foreground tabular-nums">{drawingPoints(state.sketch.strokes)}</span> points
                  </span>
                </Part>
                <Part part="hand" on={parts.hand} onChange={(on) => showPart("hand", on)}>
                  <Choice label="Layout" value={state.hand.layout} options={LAYOUTS.map((value) => ({ value, label: value }))} onChange={(layout) => set({ hand: { ...state.hand, layout } })} />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={state.hand.cards.length >= PLAY_DECK.hand}
                    onClick={() => setState((now) => ({ ...now, nextId: now.nextId + 1, hand: { ...now.hand, cards: [...now.hand.cards, { id: now.nextId, card: (now.nextId * 7) % 36 }] } }))}
                  >
                    Add a card
                  </Button>
                  <Button variant="ghost" size="sm" disabled={state.hand.cards.length === 0} onClick={() => setState((now) => ({ ...now, hand: { ...now.hand, cards: [] } }))}>
                    Empty the hand
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    <span className="text-foreground tabular-nums">{state.hand.cards.length}</span> of {PLAY_DECK.hand} cards
                  </span>
                </Part>
                <Part part="piles" on={parts.piles} onChange={(on) => showPart("piles", on)}>
                  <Button variant="outline" size="sm" disabled={state.piles.drawn >= PLAY_DECK.size} onClick={actions.deal}>
                    Deal a card
                  </Button>
                  <Button variant="ghost" size="sm" disabled={state.piles.drawn === 0 && state.piles.discard.length === 0} onClick={() => setState((now) => ({ ...now, piles: { drawn: 0, discard: [] } }))}>
                    Reshuffle
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    <span className="text-foreground tabular-nums">{PLAY_DECK.size - state.piles.drawn}</span> in the draw pile, <span className="text-foreground tabular-nums">{state.piles.discard.length}</span> in the discard pile
                  </span>
                </Part>
                <Part part="stack" on={parts.stack} onChange={(on) => showPart("stack", on)}>
                  <Knob label="Pieces" value={state.stack} min={0} max={PLAY_STACK.max} step={1} onChange={(stack) => set({ stack })} />
                  <Button variant="outline" size="sm" disabled={state.stack === 0 || full} onClick={actions.take}>
                    Take one
                  </Button>
                </Part>
                <Part part="paper" on={parts.paper} onChange={(on) => showPart("paper", on)}>
                  <Button variant="outline" size="sm" onClick={actions.press}>
                    Press it
                  </Button>
                  <Button variant="ghost" size="sm" disabled={state.presses === 0} onClick={() => set({ presses: 0 })}>
                    Start again
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    Pressed <span className="text-foreground tabular-nums">{state.presses}</span> {state.presses === 1 ? "time" : "times"}
                  </span>
                </Part>
                <Part part="seats" on={parts.seats} onChange={(on) => showPart("seats", on)}>
                  <Choice
                    label="Players"
                    value={String(state.players)}
                    options={[2, 3, 4, 5].map((count) => ({ value: String(count), label: String(count), description: `${count} players` }))}
                    onChange={(count) => set({ players: Number(count) })}
                  />
                  <Button variant="ghost" size="sm" disabled={state.seat === null} onClick={() => set({ seat: null })}>
                    Put the pick down
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    {state.seat !== null && state.seat < state.players ? (
                      <>
                        Picked: <span className="text-foreground">{PLAY_NAMES[state.seat]}</span>
                      </>
                    ) : (
                      "Press a plate to pick a player."
                    )}
                  </span>
                </Part>
              </div>
            )}

            {tab === "view" && (
              <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
                <Knob label="Distance" value={state.zoom} min={PLAY_LIMITS.zoom.min} max={PLAY_LIMITS.zoom.max} step={0.5} onChange={(zoom) => set({ zoom })} />
                <Knob label="Tilt" value={state.tilt} min={PLAY_LIMITS.tilt.min} max={PLAY_LIMITS.tilt.max} step={1} format={(value) => `${value}°`} onChange={(tilt) => set({ tilt })} />
                <Option label="Seen from above" checked={state.above} onChange={(above) => set({ above })} />
                <Button variant="ghost" size="sm" onClick={() => setState(START)}>
                  Put everything back
                </Button>
                <p className="basis-full text-sm text-muted-foreground">
                  Nothing here is saved: the table is as it starts when the page is loaded. A table seen from straight above has what is dragged under the pointer.
                </p>
              </div>
            )}

            {tab === "tuning" && <PlaygroundTuning />}
            <PromptHost />
          </div>
        </aside>
      </div>
    </div>
  )
}
