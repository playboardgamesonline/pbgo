"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { bagSize, squareBoard } from "@pbgo/engine-kit"
import {
  Bag,
  bagMouth,
  BAG_SIZE,
  Board,
  type CameraSettings,
  Card,
  type CellLook,
  ChoiceField,
  circleShape,
  Counter,
  Cup,
  defineGlows,
  DiceTray,
  Die,
  type Drop,
  DropZone,
  fan,
  grid,
  gridCells,
  inFrame,
  lineSpaces,
  NumberField,
  onTable,
  Paper,
  Piece,
  pieceModel,
  pile,
  Pile,
  type Pose,
  rectShape,
  RoadMap,
  row,
  Seat,
  seats,
  Sheet,
  shifted,
  Sketch,
  Slider,
  spacesIn,
  squareCells,
  Stack,
  Stepper,
  TableText,
  TextField,
  Timer,
  Track,
  TrackMarker,
  Zone,
} from "@pbgo/table"
import { useMemo } from "react"
import { BAG_START, BET_MOST, BID_FACES, FIELD_LENGTH, type LayoutName, PLAY_CLOCK, PLAY_DECK, PLAY_LIMITS, PLAY_NUMBERS, PLAY_SHEET, PLAY_TILES, PLAY_SKETCH, type PlayActions, type PlayCard, type PlayState, type PlayThing, PLAY_MAP, PLAY_NAMES, SKETCH_BRUSHES } from "../defaults"
import { pageFont } from "../color"
import { BOX, view } from "../landscape"
import { back, CARD_SIZE, face, inks, palette } from "./art"
import { TilesTable } from "./tiles"
import { Stage, TableLabel } from "./parts"

// Every component of the table on one table. What the visitor can move, cards and pieces, is added from the controls and dragged anywhere: let one go on a cell of the board and it takes the cell, let it go on the bin and it is gone. The parts that have a
// place of their own, the board, the track, the counter, the stepper, the slider, the timer, the bag, the cup, the dice tray, the fields, the sketch, the hand, the piles, the stack, the paper, the map, the sheet, the tiles and the seats, are on or off. Each is the component of the package as the page of its own shows it, given a place on the table and a state by the controls.

/** The view of the table: seen from where a player sits, and from straight above when the controls say so. The distance and the lean are the controls'. */
const camera = ({ zoom, above, tilt }: Pick<PlayState, "zoom" | "above" | "tilt">): CameraSettings => ({ tilt: above ? 6 : tilt, yaw: 0, distance: zoom, fov: 34, targetX: 0, targetZ: 0.5 })

const BOARD_AT = { x: -6.6, z: -0.6 }
const TRACK_AT = { x: -1, z: -5.2 }
const COUNTER_AT = { x: 4.6, z: -5.2 }
const TIMER_AT = { x: -7.4, z: -6.6 }
const SLIDER_AT = { x: -2.6, z: 3.9, length: 4 }
const STEPPER_AT = { x: 2.2, z: 3.9 }
const BAG_AT = { x: 8.4, z: -2 }
const CUP_AT = { x: 5.8, z: -1.6, yaw: 0 }
const TRAY = { x: 7, z: 2.6, width: 5.4, depth: 3.4 }
const BIN = { x: -6.6, z: 5.2, radius: 1.2 }
const FIELD_Z = 6.2
const RING = { radiusX: 10, radiusZ: 7.2 }
const BRUSHES = SKETCH_BRUSHES.map((brush) => brush.width)
/** The cards that are held and drawn from lie along the near edge of the table: the hand in the middle, the draw pile and the discard pile on each side of it. */
const HAND_AT = { x: 0, z: 9.6, width: 9.6, depth: 3.4 }
const DRAW_AT = { x: -6.6, z: 9.4 }
const DISCARD_AT = { x: 6.6, z: 9.4 }
/** The draw pile draws up to this many cards, however many its deck holds. */
const PILE_LIMIT = 24
const PILE_LOOK = { lean: "draw", leanAmplitude: 0.06 } as const
const STACK_AT = { x: 8.4, z: 7.8 }
const STACK_SIZE = 0.8
const PAPER_AT = { x: -10.4, z: 8.6, width: 3, height: 1.2 }
/** The cities of the map stand on a ring round the middle of the map. */
const CITIES = PLAY_MAP.names.map((_, i) => ({ x: PLAY_MAP.at.x + PLAY_MAP.radius * Math.cos((i * 2 * Math.PI) / PLAY_MAP.names.length - Math.PI / 2), z: PLAY_MAP.at.z + PLAY_MAP.radius * Math.sin((i * 2 * Math.PI) / PLAY_MAP.names.length - Math.PI / 2) }))

/** The boxes of the sheet: a grid of cells under its title. */
const SHEET_CELLS = gridCells({ columns: PLAY_SHEET.columns, rows: PLAY_SHEET.rows, x: 0.06, y: 0.26, width: 0.88, height: 0.68, gapX: 0.014, gapY: 0.03 })

/** The glows a picked card can wear: one part each, and all four. */
const GLOWS = defineGlows({
  halo: { halo: {} },
  outline: { outline: {} },
  frame: { frame: {} },
  sparkle: { sparkle: {} },
  all: { halo: {}, outline: {}, frame: {}, sparkle: {} },
})

/** The slots of the hand in its own frame, whose middle is (0, 0): the layout helpers of the package. */
function handSlots(layout: LayoutName, n: number): Pose[] {
  const count = Math.max(n, 1)
  switch (layout) {
    case "fan":
      return fan(n, { gap: Math.min(1.1, 8 / count), y: 1.1, rise: 0.004, curve: 0.06, tilt: 0.62, roll: 0.05, scale: 1.1 })
    case "row":
      return row(n, { gap: Math.min(1.6, 8.6 / count), rise: 0.012 })
    case "pile":
      return pile(n, { face: "up", step: 0.03, lean: "hand", leanAmplitude: 0.12 })
    case "grid":
      return grid(n, { columns: 5, gapX: 1.7, gapZ: 2.2, rows: 2 })
  }
}

/** Where the top card of the draw pile lies when it holds `count` cards: where a card that was just dealt flies in from. */
function topOfDraw(count: number): Pose {
  const n = Math.max(1, Math.min(count, PILE_LIMIT))
  return inFrame(DRAW_AT, pile(n, { ...PILE_LOOK, face: "down" })[n - 1] as Pose)
}

/** Where the top of the stack is when it holds `count` pieces: where a piece that was just taken flies in from. */
const topOfStack = (count: number) => ({ x: STACK_AT.x, z: STACK_AT.z, y: count * pieceModel("disc").height * STACK_SIZE })

const CELLS = Array.from({ length: 36 }, (_, cell) => cell)
const zoneOf = (cell: number) => `cell:${cell}`

export function PlaygroundScene({ state, actions }: { state: PlayState; actions: PlayActions }) {
  const colors = palette()
  const font = pageFont()
  const cardBack = back()
  const paints = [colors.marks[0], colors.marks[1], colors.marks[2], colors.ivory, colors.muted, colors.navy]
  const { things, selected, parts } = state
  const tiles = useMemo(() => view(state.tiles.laid, BOX, state.tiles.index, state.tiles.spin, PLAY_TILES.table), [state.tiles])
  const cells = useMemo(() => squareCells(squareBoard({ columns: 6, rows: 6 }).coords, { size: 0.95, gap: 0.05, at: BOARD_AT }), [])
  const line = useMemo(() => spacesIn(TRACK_AT, lineSpaces(PLAY_LIMITS.spaces, { gap: 1.1 })), [])
  const ring = seats(state.players, { ...RING, me: 0 })
  const fill = bagSize(BAG_START) === 0 ? 0 : bagSize(state.bag.counts) / bagSize(BAG_START)
  const cellLook = (cell: number): CellLook => ({ color: ((cell % 6) + Math.floor(cell / 6)) % 2 === 0 ? colors.ivory : colors.marks[2] })
  const spaceLook = (index: number) => (index === PLAY_LIMITS.spaces - 1 ? { label: String(index), color: colors.marks[2], ink: colors.ink } : { label: String(index) })

  // What a thing does when it is let go: on a cell it takes the cell, on the bin it is gone, anywhere else it lies where it is
  const letGo = (thing: PlayThing) => (drop: Drop) => {
    if (drop.target === "bin") return actions.remove(thing.id)
    // A card joins the hand or the discard pile it is let go on; a piece lies where it was let go
    if (thing.kind === "card" && (drop.target === "hand" || drop.target === "discard")) return actions.place(thing.id, drop.target)
    if (typeof drop.target === "string" && drop.target.startsWith("cell:")) {
      const cell = cells[Number(drop.target.slice(5))]
      if (cell) return actions.move(thing.id, cell.x, cell.z)
    }
    actions.move(thing.id, drop.position.x, drop.position.z)
  }
  // What a card of the hand does when it is let go: on the hand it goes back to its slot, on the bin it is gone, on the discard pile it joins it, anywhere else it lies on the table
  const letGoCard = (entry: PlayCard) => (drop: Drop) => {
    if (drop.target === "hand") return
    if (drop.target === "bin") return actions.place(entry.id, "gone")
    if (drop.target === "discard") return actions.place(entry.id, "discard")
    if (typeof drop.target === "string" && drop.target.startsWith("cell:")) {
      const cell = cells[Number(drop.target.slice(5))]
      if (cell) return actions.place(entry.id, "table", { x: cell.x, z: cell.z })
    }
    actions.place(entry.id, "table", { x: drop.position.x, z: drop.position.z })
  }
  const choose = (thing: PlayThing) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    actions.select(selected === thing.id ? null : thing.id)
  }

  return (
    <Stage id="scene-playground" camera={camera(state)} playIntro={false}>
      {/* What the visitor moves */}
      {things.map((thing) => {
        const chosen = selected === thing.id
        if (thing.kind === "card") {
          const pose = onTable(thing.x, thing.z, { face: thing.face, yaw: 0.18 * Math.sin(thing.id * 2.3) })
          return (
            <Card
              key={thing.id}
              id={`thing-${thing.id}`}
              target={chosen ? shifted(pose, { y: 0.25 }) : pose}
              front={face(thing.card)}
              back={cardBack}
              size={CARD_SIZE}
              from={thing.from !== undefined ? topOfDraw(thing.from) : undefined}
              glow={chosen && state.glow !== "none" ? GLOWS[state.glow] : null}
              draggable
              onDrop={letGo(thing)}
              onClick={choose(thing)}
            />
          )
        }
        return (
          <Piece
            key={thing.id}
            id={`thing-${thing.id}`}
            model={thing.shape}
            size={0.85}
            color={paints[thing.paint % paints.length]}
            at={{ x: thing.x, z: thing.z, yaw: 0.2 * Math.sin(thing.id * 1.7) }}
            from={thing.fromBag ? bagMouth(BAG_AT, BAG_SIZE, fill) : thing.fromStack !== undefined ? topOfStack(thing.fromStack) : undefined}
            lift={chosen ? 0.3 : 0}
            halo={chosen ? colors.text : null}
            draggable
            onDrop={letGo(thing)}
            onClick={choose(thing)}
          />
        )
      })}
      <DropZone id="bin" shape={circleShape(BIN.x, BIN.z, BIN.radius)} show="always" />
      <TableLabel text="Bin" x={BIN.x} z={BIN.z - BIN.radius - 0.5} height={0.4} tone="muted" />

      {parts.board && (
        <>
          <Board cells={cells} look={cellLook} drops={CELLS} dropId={zoneOf} />
          <TableLabel text="Board" x={BOARD_AT.x} z={BOARD_AT.z + 3.4} height={0.45} tone="muted" />
        </>
      )}
      {parts.track && (
        <>
          <Track spaces={line} look={spaceLook} />
          <TrackMarker id="playground-marker" spaces={line} space={state.marker} model="pawn" size={0.6} color={colors.marks[0]} />
          <TableLabel text="Track" x={TRACK_AT.x} z={TRACK_AT.z - 1.1} height={0.45} tone="muted" />
        </>
      )}
      {parts.counter && (
        <>
          <Counter value={state.counter} at={COUNTER_AT} height={1.2} />
          <TableLabel text="Counter" x={COUNTER_AT.x} z={COUNTER_AT.z + 1.4} height={0.45} tone="muted" />
        </>
      )}
      {parts.stepper && (
        <>
          <Stepper value={state.stepper} onChange={actions.count} min={PLAY_NUMBERS.stepper.min} max={PLAY_NUMBERS.stepper.max} at={STEPPER_AT} size={0.8} color={colors.marks[2]} />
          <TableLabel text="Stepper" x={STEPPER_AT.x} z={STEPPER_AT.z + 1.3} height={0.45} tone="muted" />
        </>
      )}
      {parts.slider && (
        <>
          <Slider value={state.slider} onChange={actions.slide} min={PLAY_NUMBERS.slider.min} max={PLAY_NUMBERS.slider.max} step={PLAY_NUMBERS.slider.step} at={SLIDER_AT} length={SLIDER_AT.length} size={0.9} fill={colors.marks[2]} />
          <TableLabel text="Slider" x={SLIDER_AT.x} z={SLIDER_AT.z + 1.5} height={0.45} tone="muted" />
        </>
      )}
      {parts.timer && (
        <>
          <Timer endsAt={state.clock.endsAt} seconds={PLAY_CLOCK.seconds} at={TIMER_AT} size={2} />
          <TableLabel text="Timer" x={TIMER_AT.x} z={TIMER_AT.z + 2.1} height={0.45} tone="muted" />
        </>
      )}
      {parts.bag && (
        <>
          <Bag at={BAG_AT} fill={fill} shake={state.bag.drawn} halo={fill > 0 ? colors.text : null} onClick={fill > 0 ? (event) => (event.stopPropagation(), actions.draw()) : undefined} />
          <TableLabel text="Bag" x={BAG_AT.x} z={BAG_AT.z + 1.7} height={0.45} tone="muted" />
        </>
      )}
      {parts.cup && (
        <>
          <Cup at={CUP_AT} pose={state.cup} color={colors.marks[1]} onClick={(event) => (event.stopPropagation(), actions.peek())} />
          <TableLabel text="Cup" x={CUP_AT.x} z={CUP_AT.z + 1.7} height={0.45} tone="muted" />
        </>
      )}
      {parts.dice && (
        <>
          <mesh rotation-x={-Math.PI / 2} position={[TRAY.x, 0.006, TRAY.z]} renderOrder={1} raycast={() => null}>
            <planeGeometry args={[TRAY.width, TRAY.depth]} />
            <meshBasicMaterial color={colors.ink} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
          </mesh>
          <DiceTray area={TRAY}>
            {Array.from({ length: state.dice.count }, (_, i) => (
              <Die
                key={`${state.dice.shape}-${i}`}
                id={`playground-die-${i}`}
                model={state.dice.shape}
                size={0.8}
                value={state.dice.values[i] ?? 1}
                roll={state.dice.rolls === 0 ? undefined : state.dice.rolls}
                at={{ x: TRAY.x + (i - (state.dice.count - 1) / 2) * 0.9, z: TRAY.z }}
              />
            ))}
          </DiceTray>
          <TableLabel text="Dice tray" x={TRAY.x} z={TRAY.z + TRAY.depth / 2 + 0.6} height={0.45} tone="muted" />
        </>
      )}
      {parts.fields && (
        <>
          <TextField
            value={state.text}
            onChange={actions.write}
            label="Your clue"
            hint="One word that the others will guess from."
            placeholder="Press to write a clue"
            rules={{ max: FIELD_LENGTH.start, lines: 1 }}
            at={{ x: -2.2, z: FIELD_Z }}
            width={3.2}
          />
          <NumberField
            value={state.bet}
            onChange={actions.bet}
            label="Your bet"
            hint="How many tricks you think you will win."
            placeholder="Press to bet"
            min={0}
            max={BET_MOST}
            format={(value) => `${value} ${value === 1 ? "trick" : "tricks"}`}
            at={{ x: 1.6, z: FIELD_Z }}
            width={2.6}
          />
          <ChoiceField value={state.face} options={BID_FACES} onChange={actions.pick} instant label="Your face" hint="The face of the die you bet on." placeholder="Press to pick" at={{ x: 5, z: FIELD_Z }} width={2.6} />
        </>
      )}
      {parts.sketch && (
        <>
          <Sketch
            strokes={state.sketch.strokes}
            onStrokes={actions.ink}
            at={{ x: PLAY_SKETCH.x, z: PLAY_SKETCH.z }}
            width={PLAY_SKETCH.width}
            height={PLAY_SKETCH.height}
            colors={inks()}
            widths={BRUSHES}
            pen={{ color: state.sketch.color, width: state.sketch.width }}
            paper={colors.ivory}
          />
          <TableLabel text="Sketch" x={PLAY_SKETCH.x} z={PLAY_SKETCH.z + PLAY_SKETCH.height / 2 + 0.6} height={0.45} tone="muted" />
        </>
      )}
      {parts.hand && (
        <>
          <DropZone id="hand" shape={rectShape(HAND_AT.x, HAND_AT.z, HAND_AT.width, HAND_AT.depth)} />
          <Zone
            frame={{ x: HAND_AT.x, z: HAND_AT.z }}
            layout={handSlots(state.hand.layout, state.hand.cards.length)}
            size={CARD_SIZE}
            cards={state.hand.cards.map((entry) => ({
              key: entry.id,
              id: `thing-${entry.id}`,
              front: face(entry.card),
              back: cardBack,
              draggable: true,
              onDrop: letGoCard(entry),
              ...(entry.from !== undefined ? { from: topOfDraw(entry.from) } : {}),
            }))}
          />
          <TableLabel text="Hand" x={HAND_AT.x} z={HAND_AT.z + HAND_AT.depth / 2 + 0.5} height={0.45} tone="muted" />
        </>
      )}
      {parts.piles && (
        <>
          <Pile frame={DRAW_AT} count={PLAY_DECK.size - state.piles.drawn} size={CARD_SIZE} back={cardBack} {...PILE_LOOK} limit={PILE_LIMIT} top={{ id: "draw-top", onClick: (event) => (event.stopPropagation(), actions.deal()) }} />
          <TableLabel text="Draw pile" x={DRAW_AT.x} z={DRAW_AT.z + 2.1} height={0.45} tone="muted" />
          <DropZone id="discard" shape={rectShape(DISCARD_AT.x, DISCARD_AT.z, 2.4, 3.2)} show="always" />
          <Zone
            frame={DISCARD_AT}
            layout={pile(state.piles.discard.length, { face: "up", step: 0.03, lean: "discard", leanAmplitude: 0.12 })}
            size={CARD_SIZE}
            cards={state.piles.discard.map((entry) => ({ key: entry.id, id: `thing-${entry.id}`, front: face(entry.card), back: cardBack }))}
          />
          <TableLabel text="Discard pile" x={DISCARD_AT.x} z={DISCARD_AT.z + 2.4} height={0.45} tone="muted" />
        </>
      )}
      {parts.stack && (
        <>
          <Stack id="supply" count={state.stack} model="disc" size={STACK_SIZE} at={STACK_AT} color={colors.marks[2]} onClick={state.stack > 0 ? (event) => (event.stopPropagation(), actions.take()) : undefined} />
          <TableText text={String(state.stack)} style={{ color: colors.text }} height={0.6} position={[STACK_AT.x + 1.5, 0.02, STACK_AT.z]} />
          <TableLabel text="Stack" x={STACK_AT.x} z={STACK_AT.z + 1.2} height={0.45} tone="muted" />
        </>
      )}
      {parts.paper && (
        <>
          <Paper text="End the turn" at={{ x: PAPER_AT.x, z: PAPER_AT.z }} width={PAPER_AT.width} height={PAPER_AT.height} onPress={actions.press} />
          <TableText text={`Turn ${state.presses + 1}`} style={{ color: colors.text }} height={0.6} position={[PAPER_AT.x, 0.02, PAPER_AT.z - 1.2]} />
        </>
      )}
      {parts.map && (
        <>
          <RoadMap
            places={CITIES}
            roads={PLAY_MAP.roads}
            placeLook={(city) => ({ label: PLAY_MAP.names[city]!.slice(0, 1), color: state.map.city === city ? colors.marks[2] : colors.ivory, ink: colors.ink })}
            roadLook={(road) => (state.map.claimed[road] ? { color: colors.marks[0] } : {})}
            placeSize={0.7}
            onPlace={(city) => actions.visit(state.map.city === city ? null : city)}
            onRoad={actions.claim}
          />
          <TableLabel text="Map" x={PLAY_MAP.at.x} z={PLAY_MAP.at.z + PLAY_MAP.radius + 1.3} height={0.45} tone="muted" />
        </>
      )}
      {parts.sheet && (
        <>
          <Sheet
            at={{ x: PLAY_SHEET.x, z: PLAY_SHEET.z }}
            width={PLAY_SHEET.width}
            height={PLAY_SHEET.height}
            cells={SHEET_CELLS}
            font={font}
            paper={colors.ivory}
            ink={colors.ink}
            accent={colors.marks[2]}
            printed={(g, { width, height }) => {
              g.fillStyle = colors.ink
              g.textBaseline = "middle"
              g.textAlign = "left"
              g.font = `900 ${height * 0.1}px ${font}`
              g.fillText("MARK A BOX", width * 0.06, height * 0.13)
            }}
            look={(box) => ({ text: String(box + 1), color: colors.marks[Math.floor(box / PLAY_SHEET.columns) % colors.marks.length], mark: state.sheet.marks[box] ?? undefined })}
            onCell={actions.mark}
          />
          <TableLabel text="Sheet" x={PLAY_SHEET.x} z={PLAY_SHEET.z + PLAY_SHEET.height / 2 + 0.6} height={0.45} tone="muted" />
        </>
      )}
      {parts.tiles && (
        <TilesTable
          laid={state.tiles.laid}
          hand={tiles.name ? { tile: tiles.name, spin: state.tiles.spin } : null}
          spots={tiles.spots}
          fits={tiles.fits}
          done={tiles.score.tiles}
          turnable={tiles.options.length > 1}
          onSpot={actions.layTile}
          onTurn={actions.turnTile}
          origin={PLAY_TILES.origin}
          handAt={PLAY_TILES.hand}
        />
      )}
      {parts.seats &&
        ring.slice(0, state.players).map((spot, i) => (
          <Seat
            key={i}
            nickname={PLAY_NAMES[i] ?? `Player ${i + 1}`}
            color={paints[i % paints.length]!}
            theme={DEFAULT_SEAT_THEME}
            spot={spot}
            viewer={i === 0}
            active={i === 1}
            waiting={state.seat === i}
            line={`${(i + 1) * 3} pts`}
            status={state.seat === i ? "Picked" : undefined}
          />
        ))}
    </Stage>
  )
}
