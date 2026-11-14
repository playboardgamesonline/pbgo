"use client"

import { type ReactNode } from "react"
import { askChoice, askNumber, askText } from "@pbgo/core/components/game/prompt"
import { bagSize, drawingPoints, emptyDrawing, graph, longestTrail, undoStroke } from "@pbgo/engine-kit"
import { Button } from "@pbgo/ui/platform/button"
import { Choice, Knob, Option } from "../../_specimens/scene/controls"
import {
  BAG_START,
  BET_MOST,
  BID_FACES,
  BOARD_SHAPES,
  DICE_SHAPES,
  FIELD_LENGTH,
  HAND_PLACES,
  LAYOUTS,
  PILE_PLACES,
  PLAY_CLOCK,
  PLAY_CUP_POSES,
  PLAY_DECK,
  PLAY_LIMITS,
  PLAY_MAP,
  PLAY_MARKS,
  PLAY_NAMES,
  PLAY_NUMBERS,
  PLAY_PLAYERS,
  PLAY_STACK,
  PLAY_TILES,
  SKETCH_BRUSHES,
  SKETCH_COLORS,
  type PlayPart,
} from "../../_specimens/scene/defaults"
import { cellAt, cellCentres, planOf, ringZoom } from "../../_specimens/scene/play/geometry"
import { addPoints, endRound, freshBag, nextTurn, reshapeBoard, resetScores, rollDice, rollFor } from "../../_specimens/scene/play/state"
import { BOX, lay, nextFitting, START as FIRST_TILE, view } from "../../_specimens/scene/landscape"
import type { Controls } from "./context"

const Note = ({ children }: { children: ReactNode }) => (
  <span className="text-sm text-muted-foreground" aria-live="polite">
    {children}
  </span>
)
const N = ({ children }: { children: ReactNode }) => <span className="text-foreground tabular-nums">{children}</span>

/** The controls of one part of the table, shown under its switch when it is on. A control of the table's state is one entry of the undo stack. */
export function PartControls({ part, controls }: { part: PlayPart; controls: Controls }) {
  const { state, set, update, actions, full } = controls
  const left = bagSize(state.bag.counts)
  const tiles = view(state.tiles.laid, BOX, state.tiles.index, state.tiles.spin, PLAY_TILES.table)
  const pen = (patch: Partial<typeof state.sketch>) => update((now) => ({ ...now, sketch: { ...now.sketch, ...patch } }))
  const layNow = (way: { at: readonly [number, number]; turns: number }) =>
    update((now) => {
      const here = view(now.tiles.laid, BOX, now.tiles.index, now.tiles.spin, PLAY_TILES.table)
      if (!here.name) return now
      const next = lay(now.tiles.laid, BOX, now.tiles.index, way.at, way.turns, PLAY_TILES.table)
      return { ...now, tiles: { laid: next.laid, index: next.index, spin: 0 } }
    })

  switch (part) {
    case "board": {
      const plan = planOf(state.board)
      const centres = cellCentres(plan)
      const cells = new Set(state.things.map((one) => cellAt(centres, one, plan.size * 0.45)).filter((cell) => cell >= 0))
      return (
        <>
          <Choice label="Shape" value={state.board.shape} options={BOARD_SHAPES.map((value) => ({ value, label: value === "loop" ? "ring" : value, description: value === "grid" ? "Squares" : value === "hex" ? "Hexagons" : "A ring of 16 spaces" }))} onChange={(shape) => update((now) => reshapeBoard(now, { shape }))} />
          <Choice
            label="Place"
            value={state.board.centre ? "centre" : "side"}
            options={[
              { value: "centre", label: "middle", description: "In the middle of the table, larger" },
              { value: "side", label: "side", description: "At the left side of the table" },
            ]}
            onChange={(place) => update((now) => reshapeBoard(now, { centre: place === "centre" }))}
          />
          <Button variant="outline" size="sm" disabled={!state.things.some((one) => one.kind === "piece")} onClick={() => actions.hop()}>
            Move a piece
          </Button>
          <Note>
            <N>{cells.size}</N> of <N>{centres.length}</N> cells taken. Drop a card or a piece on a cell: it takes the cell.
          </Note>
        </>
      )
    }
    case "track":
      return (
        <>
          <Button variant="outline" size="sm" disabled={state.marker === 0} onClick={() => set({ marker: Math.max(0, state.marker - 1) })}>
            Back a space
          </Button>
          <Button variant="outline" size="sm" disabled={state.marker >= PLAY_LIMITS.spaces - 1} onClick={() => set({ marker: Math.min(PLAY_LIMITS.spaces - 1, state.marker + 1) })}>
            On a space
          </Button>
          <Button variant="ghost" size="sm" disabled={state.marker === 0} onClick={() => set({ marker: 0 })}>
            Back to the start
          </Button>
        </>
      )
    case "counter":
      return (
        <>
          <Button variant="outline" size="sm" disabled={state.counter === 0} onClick={() => set({ counter: Math.max(0, state.counter - 1) })}>
            One less
          </Button>
          <Button variant="outline" size="sm" disabled={state.counter >= PLAY_LIMITS.counter} onClick={() => set({ counter: Math.min(PLAY_LIMITS.counter, state.counter + 1) })}>
            One more
          </Button>
          <Button variant="outline" size="sm" disabled={state.counter >= PLAY_LIMITS.counter} onClick={() => set({ counter: Math.min(PLAY_LIMITS.counter, state.counter + 10) })}>
            Ten more
          </Button>
        </>
      )
    case "stepper":
      return <Knob label="Count" value={state.stepper} min={PLAY_NUMBERS.stepper.min} max={PLAY_NUMBERS.stepper.max} step={1} onChange={actions.count} />
    case "slider":
      return <Knob label="Bet" value={state.slider} min={PLAY_NUMBERS.slider.min} max={PLAY_NUMBERS.slider.max} step={PLAY_NUMBERS.slider.step} onChange={actions.slide} />
    case "timer":
      return (
        <>
          <Button variant="outline" size="sm" onClick={() => set({ clock: { endsAt: performance.now() + PLAY_CLOCK.seconds * 1000 } })}>
            Start a step
          </Button>
          <Button variant="outline" size="sm" onClick={() => set({ clock: { endsAt: performance.now() + 4000 } })}>
            Run out in 4 seconds
          </Button>
          <Button variant="ghost" size="sm" disabled={state.clock.endsAt === null} onClick={() => set({ clock: { endsAt: null } })}>
            Fill it again
          </Button>
        </>
      )
    case "bag":
      return (
        <>
          <Button variant="outline" size="sm" disabled={left === 0 || full} onClick={actions.draw}>
            Draw a token
          </Button>
          <Button variant="ghost" size="sm" disabled={state.bag.drawn === 0} onClick={() => update((now) => ({ ...now, bag: freshBag(), things: now.things.filter((one) => !(one.kind === "piece" && one.fromBag)), selected: null }))}>
            Put the tokens back
          </Button>
          <Note>
            <N>{left}</N> of {bagSize(BAG_START)} left
          </Note>
        </>
      )
    case "cup":
      return <Choice label="Pose" value={state.cup} options={PLAY_CUP_POSES.map((value) => ({ value, label: value }))} onChange={(cup) => set({ cup })} />
    case "dice":
      return (
        <>
          <Choice label="Dice" value={state.dice.shape} options={DICE_SHAPES.map((value) => ({ value, label: value }))} onChange={(next) => update((now) => ({ ...now, dice: { ...now.dice, shape: next, values: rollFor(next) } }))} />
          <Knob label="How many" value={state.dice.count} min={1} max={PLAY_LIMITS.dice} step={1} onChange={(count) => update((now) => ({ ...now, dice: { ...now.dice, count } }))} />
          <Button variant="outline" size="sm" onClick={() => update(rollDice)}>
            Roll
          </Button>
        </>
      )
    case "fields": {
      const askClue = () => void askText({ title: "Your clue", description: "One word that the others will guess from.", value: state.text, placeholder: "Press to write a clue", rules: { max: FIELD_LENGTH.start, lines: 1 } }).then((text) => text !== null && set({ text }))
      const askBet = () => askNumber({ title: "Your bet", description: "How many tricks you think you will win.", value: state.bet ?? undefined, min: 0, max: BET_MOST }).then((value) => value !== null && set({ bet: value }))
      const askFace = () => askChoice({ title: "Your face", description: "The face of the die you bet on.", options: BID_FACES, value: state.face ?? undefined, instant: true }).then((value) => value !== null && set({ face: value }))
      return (
        <>
          <Button variant="outline" size="sm" onClick={askClue}>
            Write a clue
          </Button>
          <Button variant="outline" size="sm" onClick={() => void askBet()}>
            Bet
          </Button>
          <Button variant="outline" size="sm" onClick={() => void askFace()}>
            Pick a face
          </Button>
        </>
      )
    }
    case "sketch":
      return (
        <>
          <Choice label="Colour" value={String(state.sketch.color)} options={SKETCH_COLORS.map((name, k) => ({ value: String(k), label: name, description: `${name} ink` }))} onChange={(color) => pen({ color: Number(color) })} />
          <Choice label="Brush" value={String(state.sketch.width)} options={SKETCH_BRUSHES.map((brush, k) => ({ value: String(k), label: brush.name, description: `${brush.name} brush` }))} onChange={(width) => pen({ width: Number(width) })} />
          <Button variant="outline" size="sm" disabled={state.sketch.strokes.length === 0} onClick={() => pen({ strokes: undoStroke(state.sketch.strokes) })}>
            Undo a stroke
          </Button>
          <Button variant="ghost" size="sm" disabled={state.sketch.strokes.length === 0} onClick={() => pen({ strokes: emptyDrawing() })}>
            Clear
          </Button>
          <Note>
            <N>{state.sketch.strokes.length}</N> strokes, <N>{drawingPoints(state.sketch.strokes)}</N> points
          </Note>
        </>
      )
    case "hand":
      return (
        <>
          <Choice label="Layout" value={state.hand.layout} options={LAYOUTS.map((value) => ({ value, label: value }))} onChange={(layout) => set({ hand: { ...state.hand, layout } })} />
          <Choice
            label="Place"
            value={state.layout.hand}
            options={HAND_PLACES.map((value) => ({ value, label: value === "edge" ? "near edge" : "bottom left", description: value === "edge" ? "Along the near edge of the table" : "In the bottom left corner of the screen" }))}
            onChange={(hand) => update((now) => ({ ...now, layout: { ...now.layout, hand }, zoom: hand === "edge" ? Math.max(now.zoom, 26) : now.zoom }))}
          />
          <Button variant="outline" size="sm" disabled={state.hand.cards.length >= PLAY_DECK.hand} onClick={() => update((now) => ({ ...now, nextId: now.nextId + 1, hand: { ...now.hand, cards: [...now.hand.cards, { id: now.nextId, card: (now.nextId * 7) % 36 }] } }))}>
            Add a card
          </Button>
          <Button variant="ghost" size="sm" disabled={state.hand.cards.length === 0} onClick={() => update((now) => ({ ...now, hand: { ...now.hand, cards: [] } }))}>
            Empty the hand
          </Button>
          <Note>
            <N>{state.hand.cards.length}</N> of {PLAY_DECK.hand} cards. Drag one out onto the table, a cell or the discard pile, and a card of the table back in.
          </Note>
        </>
      )
    case "piles":
      return (
        <>
          <Choice
            label="Place"
            value={state.layout.piles}
            options={PILE_PLACES.map((value) => ({ value, label: value === "edge" ? "near edge" : "middle", description: value === "edge" ? "Along the near edge of the table" : "In the middle of the table" }))}
            onChange={(piles) => update((now) => ({ ...now, layout: { ...now.layout, piles }, zoom: piles === "edge" ? Math.max(now.zoom, 26) : now.zoom }))}
          />
          <Button variant="outline" size="sm" disabled={state.piles.drawn >= PLAY_DECK.size} onClick={actions.deal}>
            Deal a card
          </Button>
          <Button variant="ghost" size="sm" disabled={state.piles.drawn === 0 && state.piles.discard.length === 0} onClick={() => update((now) => ({ ...now, piles: { drawn: 0, discard: [] } }))}>
            Reshuffle
          </Button>
          <Note>
            <N>{PLAY_DECK.size - state.piles.drawn}</N> in the draw pile, <N>{state.piles.discard.length}</N> in the discard pile
          </Note>
        </>
      )
    case "floor":
      return (
        <>
          <Option label="A zone at each seat" checked={state.floor.zones} onChange={(zones) => set({ floor: { ...state.floor, zones } })} />
          <Option label="Disabled" checked={state.floor.disabled} onChange={(disabled) => set({ floor: { ...state.floor, disabled } })} />
          <Note>Move the pointer over a pad to lift its rim, or Tab through them. Hit gives the seat whose turn it is a card and a point, Stay banks its points, Deal gives every seat a card, a zone gives its seat a card.{!state.parts.seats && " The zones need the seats."}</Note>
        </>
      )
    case "stack":
      return (
        <>
          <Knob label="Pieces" value={state.stack} min={0} max={PLAY_STACK.max} step={1} onChange={(stack) => set({ stack })} />
          <Button variant="outline" size="sm" disabled={state.stack === 0 || full} onClick={actions.take}>
            Take one
          </Button>
        </>
      )
    case "paper":
      return (
        <>
          <Button variant="outline" size="sm" onClick={actions.press}>
            Press it
          </Button>
          <Button variant="ghost" size="sm" disabled={state.presses === 0} onClick={() => set({ presses: 0 })}>
            Start again
          </Button>
          <Note>
            Pressed <N>{state.presses}</N> {state.presses === 1 ? "time" : "times"}
          </Note>
        </>
      )
    case "map":
      return (
        <>
          <Button variant="ghost" size="sm" disabled={state.map.city === null && !state.map.claimed.some(Boolean)} onClick={() => set({ map: { claimed: PLAY_MAP.roads.map(() => false), city: null } })}>
            Clear the map
          </Button>
          <Note>
            {state.map.city === null ? "No city picked" : <>City: <span className="text-foreground">{PLAY_MAP.names[state.map.city]}</span></>}. Longest route:{" "}
            <N>{longestTrail(graph(PLAY_MAP.names.length, PLAY_MAP.roads), state.map.claimed.flatMap((held, road) => (held ? [road] : [])))}</N>
          </Note>
        </>
      )
    case "sheet":
      return (
        <>
          <Choice label="Mark" value={state.sheet.mark} options={PLAY_MARKS.map((mark) => ({ value: mark, label: mark, description: `A press writes a ${mark}` }))} onChange={(mark) => set({ sheet: { ...state.sheet, mark } })} />
          <Button variant="ghost" size="sm" disabled={!state.sheet.marks.some(Boolean)} onClick={() => set({ sheet: { ...state.sheet, marks: state.sheet.marks.map(() => null) } })}>
            Clear the sheet
          </Button>
          <Note>
            <N>{state.sheet.marks.filter(Boolean).length}</N> of {state.sheet.marks.length} boxes marked
          </Note>
        </>
      )
    case "tiles":
      return (
        <>
          <Button variant="outline" size="sm" disabled={tiles.options.length < 2} onClick={actions.turnTile}>
            Turn the tile
          </Button>
          <Button variant="outline" size="sm" disabled={!tiles.ways[0]} onClick={() => tiles.spots.length > 0 && tiles.ways[0] && layNow(tiles.ways[0])}>
            Lay it for me
          </Button>
          <Button variant="ghost" size="sm" disabled={state.tiles.laid.length === 1 && state.tiles.spin === 0} onClick={() => set({ tiles: { laid: [FIRST_TILE], index: nextFitting([FIRST_TILE], BOX, 0, PLAY_TILES.table), spin: 0 } })}>
            Clear the table
          </Button>
          <Note>
            {tiles.name ? (
              <>
                The tile fits on <N>{tiles.fits.length}</N> {tiles.fits.length === 1 ? "cell" : "cells"} as it is turned.
              </>
            ) : (
              "The box is empty."
            )}{" "}
            <N>{state.tiles.laid.length}</N> {state.tiles.laid.length === 1 ? "tile" : "tiles"} laid, <N>{tiles.score.points}</N> {tiles.score.points === 1 ? "point" : "points"} closed.
          </Note>
        </>
      )
    case "seats":
      return (
        <>
          <Knob label="Players" value={state.players} min={PLAY_PLAYERS.min} max={PLAY_PLAYERS.max} step={1} onChange={(players) => update((now) => ({ ...now, players, turn: now.turn % players, held: now.held.filter((one) => one.seat < players), zoom: Math.max(now.zoom, ringZoom(players)) }))} />
          <Button variant="outline" size="sm" onClick={() => update(nextTurn)}>
            Next turn
          </Button>
          <Button variant="ghost" size="sm" disabled={state.seat === null} onClick={() => set({ seat: null })}>
            Put the pick down
          </Button>
          <Note>
            {state.seat !== null && state.seat < state.players ? (
              <>
                Picked: <span className="text-foreground">{PLAY_NAMES[state.seat]}</span>.{" "}
              </>
            ) : (
              "Press a plate to pick a player. "
            )}
            The crown is on <span className="text-foreground">{PLAY_NAMES[state.turn]}</span>.
          </Note>
        </>
      )
    case "scoreboard":
      return (
        <Note>
          The list at the top right of the table, the points on the plates and the round written in the middle follow the scores. Add points and read the ticker in the Play tab.{" "}
          <Button variant="link" size="xs" className="h-auto p-0" onClick={() => update((now) => addPoints(now, now.turn, 1))}>
            A point for {PLAY_NAMES[state.turn]}
          </Button>
          {" · "}
          <Button variant="link" size="xs" className="h-auto p-0" onClick={() => update(endRound)}>
            End the round
          </Button>
          {" · "}
          <Button variant="link" size="xs" className="h-auto p-0" onClick={() => update(resetScores)}>
            Reset the scores
          </Button>
        </Note>
      )
  }
}
