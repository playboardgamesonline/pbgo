"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { bagSize } from "@pbgo/engine-kit"
import {
  Bag,
  bagMouth,
  BAG_SIZE,
  Board,
  type CameraSettings,
  Card,
  type CellLook,
  centreOf,
  ChoiceField,
  circleShape,
  Counter,
  Cup,
  defineGlows,
  DiceTray,
  Die,
  type Drop,
  DropZone,
  effectiveState,
  fan,
  FloorButton,
  frameBoxOfPoses,
  grainTexture,
  grid,
  gridCells,
  HandShadow,
  heldFan,
  heldShadow,
  heldYaw,
  hexCells,
  Hotspot,
  inFrame,
  outOfFrame,
  joinBoxes,
  lineSpaces,
  LightPool,
  loopSpaces,
  NO_TOUCH,
  NumberField,
  onTable,
  Paper,
  Piece,
  pieceModel,
  pile,
  Pile,
  plateAbove,
  plateBoxOf,
  pointInFrame,
  type Pose,
  rectShape,
  RoadMap,
  row,
  SCREEN_HAND_SETTINGS,
  ScreenHand,
  screenHandLayout,
  Seat,
  seats,
  Sheet,
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
  type Touch,
  Zone,
} from "@pbgo/table"
import { useEffect, useMemo, useState } from "react"
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from "three"
import { BAG_START, BET_MOST, BID_FACES, FIELD_LENGTH, type LayoutName, PLAY_CLOCK, PLAY_DECK, PLAY_LIMITS, PLAY_NUMBERS, PLAY_SHEET, PLAY_TILES, PLAY_SKETCH, type PlayActions, type PlayCard, type PlayState, type PlayThing, PLAY_MAP, PLAY_FLOOR_TONES, PLAY_NAMES, PLAY_SEAT_COLORS, PLAY_TABLE, SKETCH_BRUSHES } from "../defaults"
import { cssColor, pageFont } from "../color"
import { cellAt, cellCentres, coordsOf, floorPads, heldFrame, LOOP_CELLS, PILE_PLACES_AT, planOf, ringOf, ringRadius } from "../play/geometry"
import { leader, nameOf } from "../play/state"
import { BOX, view } from "../landscape"
import { back, CARD_SIZE, face, inks, palette } from "./art"
import { TilesTable } from "./tiles"
import { Stage, TableLabel } from "./parts"

// Every component of the table on one table. What the visitor can move, cards and pieces, is added from the controls and dragged anywhere: let one go on a cell of the board and it takes the cell, let it go on the bin and it is gone. The parts that have a
// place of their own, the board, the track, the counter, the stepper, the slider, the timer, the bag, the cup, the dice tray, the fields, the sketch, the hand, the piles, the stack, the paper, the map, the sheet, the tiles and the seats, are on or off. Each is the component of the package as the page of its own shows it, given a place on the table and a state by the controls.

/** The view of the table: seen from where a player sits, and from straight above when the controls say so. The distance and the lean are the controls'. */
const camera = ({ zoom, above, tilt }: Pick<PlayState, "zoom" | "above" | "tilt">): CameraSettings => ({ tilt: above ? 6 : tilt, yaw: 0, distance: zoom, fov: 34, targetX: 0, targetZ: 0.5 })

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
const BRUSHES = SKETCH_BRUSHES.map((brush) => brush.width)
/** The cards that are held and drawn from lie along the near edge of the table: the hand in the middle, the draw pile and the discard pile on each side of it. */
const HAND_AT = { x: 0, z: 9.6, width: 9.6, depth: 3.4 }
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
function slotsOf(layout: LayoutName, n: number): Pose[] {
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
function topOfDraw(count: number, draw: { x: number; z: number }): Pose {
  const n = Math.max(1, Math.min(count, PILE_LIMIT))
  return inFrame(draw, pile(n, { ...PILE_LOOK, face: "down" })[n - 1] as Pose)
}

/** The most cards drawn at a seat: two when the ring is crowded. The plate of a seat stands above the room of that many, so it does not move as cards are dealt. */
const heldLimit = (players: number) => (players > 5 ? 2 : 3)

/** The frame of the cards held at a seat: at the seat, turned toward the viewer (`heldYaw`), so that their backs show and they can be counted. The plate stays in the frame of the seat, which faces the middle. */
const handFrameOf = (spot: { x: number; z: number; yaw: number }) => ({ ...heldFrame(spot), yaw: heldYaw(spot.yaw) })
/** The shadow under a hand: small, and it grows with the cards. */
const HELD_SHADOW = heldShadow()

/** Where the top of the stack is when it holds `count` pieces: where a piece that was just taken flies in from. */
/** The hand held at the bottom left of the screen, as Courtisans holds its own (`ScreenHand` of the kit): its numbers, with the room it may take stopped short of the middle of the picture. */
const CORNER_HAND = { ...SCREEN_HAND_SETTINGS, room: 0.45 }
/** Where the bin lies when the hand is held at the bottom left of the screen: in the bottom right of the table, the hand's counterpart. */
const CORNER_BIN = { x: 6.8, z: 4.8 }

/** The felt of the card scenes: Flip 7's table colour with the kit's grain, and the pool of light in the middle added to it (additive, so the grain shows through). One texture of each, made once and let go with the scene */
const GRAIN_TILE = 2
const MAT_SIZE = 44
function useFelt() {
  const grain = useMemo(() => grainTexture({ base: PLAY_TABLE.surfaceDark, strength: 0.3 }), [])
  const mat = useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 256
    const g = canvas.getContext("2d")!
    const channel = (hex: string, at: number) => parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16)
    const [r, gr, b] = [0, 1, 2].map((i) => Math.max(0, channel(PLAY_TABLE.surface, i) - channel(PLAY_TABLE.surfaceDark, i)))
    const gradient = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, `rgb(${r},${gr},${b})`)
    gradient.addColorStop(0.3, `rgb(${r},${gr},${b})`)
    gradient.addColorStop(1, "rgb(0,0,0)")
    g.fillStyle = gradient
    g.fillRect(0, 0, 256, 256)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [])
  useEffect(() => () => (grain.dispose(), mat.dispose()), [grain, mat])
  return { grain, mat }
}

const topOfStack = (count: number) => ({ x: STACK_AT.x, z: STACK_AT.z, y: count * pieceModel("disc").height * STACK_SIZE })

const zoneOf = (cell: number) => `cell:${cell}`

export function PlaygroundScene({ state, actions }: { state: PlayState; actions: PlayActions }) {
  const colors = palette()
  const felt = useFelt()
  const font = pageFont()
  const cardBack = back()
  const paints = [colors.marks[0], colors.marks[1], colors.marks[2], colors.ivory, colors.muted, colors.navy]
  const { things, selected, parts } = state
  // The card scenes (a ring of seats) are on Flip 7's teal; the others keep the specimens' felt
  const teal = parts.seats || parts.floor
  const tealSurface = useMemo(() => ({ color: PLAY_TABLE.surfaceDark, map: felt.grain, tile: GRAIN_TILE }), [felt.grain])
  const tiles = useMemo(() => view(state.tiles.laid, BOX, state.tiles.index, state.tiles.spin, PLAY_TILES.table), [state.tiles])
  const { shape, centre } = state.board
  const plan = useMemo(() => planOf({ shape, centre }), [shape, centre])
  const cells = useMemo(() => {
    const gap = plan.size * 0.05
    if (plan.shape === "grid") return squareCells(coordsOf("grid"), { size: plan.size, gap, at: plan.at })
    if (plan.shape === "hex") return hexCells(coordsOf("hex"), { size: plan.size, gap, at: plan.at })
    // A ring of squares: the spaces of a loop, each a cell with the corners of a square
    const half = plan.size * 0.4
    const corners = [[-half, -half], [half, -half], [half, half], [-half, half]] as const
    return loopSpaces(LOOP_CELLS, { radiusX: ringRadius(plan.size) }).map((space) => ({ ...space, yaw: 0, corners }))
  }, [plan])
  const centres = useMemo(() => cellCentres(plan), [plan])
  const dropCells = useMemo(() => cells.map((_, cell) => cell), [cells])
  // The cells that have something on them
  const taken = useMemo(() => new Set(things.map((one) => cellAt(centres, one, plan.size * 0.45)).filter((cell) => cell >= 0)), [things, centres, plan.size])
  const [draw, discard] = [PILE_PLACES_AT[state.layout.piles].draw, PILE_PLACES_AT[state.layout.piles].discard]
  // The discard pile draws its last cards only: a card under three others is never seen, and each card is a mesh with its own shadow and shine
  const discardShown = state.piles.discard.slice(-4)
  const seatColors = PLAY_SEAT_COLORS.map((expression) => cssColor(expression))
  const players = Math.min(state.players, PLAY_NAMES.length)
  const ringLine = ringOf(players)
  const line = useMemo(() => spacesIn(TRACK_AT, lineSpaces(PLAY_LIMITS.spaces, { gap: 1.1 })), [])
  const ring = seats(players, { ...ringLine, me: 0 })
  // Choosing a player: the cards of every seat glow while a card can be given, brighter under the pointer and while pressed, and the areas that take the press are invisible
  const [touches, setTouches] = useState<Partial<Record<number, Touch>>>({})
  // The card of the hand held at the bottom left that the pointer is over: it advances over its neighbours
  const [hovered, setHovered] = useState<number | null>(null)
  const giving = !state.floor.disabled && state.piles.drawn < PLAY_DECK.size
  const choosing = parts.floor && parts.seats && state.floor.zones
  const heldState = (seat: number) => (choosing ? (giving ? effectiveState("interactive", touches[seat] ?? NO_TOUCH) : "disabled") : undefined)
  // The room of a seat's cards in the frame of the seat, as the camera sees it, and the plate that stands above it on the side that faces the middle
  const roomOf = (spot: { x: number; z: number; yaw: number }) => {
    const hand = handFrameOf(spot)
    const plate = heldFrame(spot)
    return frameBoxOfPoses(heldFan(heldLimit(players), hand.yaw, CARD_SIZE).map((pose) => outOfFrame(plate, inFrame(hand, pose))), CARD_SIZE, plate, { tilt: state.above ? 6 : state.tilt })!
  }
  const fill = bagSize(BAG_START) === 0 ? 0 : bagSize(state.bag.counts) / bagSize(BAG_START)
  // A chequer for squares, three shades for hexagons so that no two neighbours match, a ring that alternates with its corners numbered; a cell with something on it takes the gold
  const cellLook = (cell: number): CellLook => {
    const base = shape === "grid" ? (((cell % 6) + Math.floor(cell / 6)) % 2 === 0 ? colors.ivory : colors.muted) : shape === "hex" ? [colors.ivory, colors.muted, colors.marks[1]][(cell * 7) % 3]! : cell % 2 === 0 ? colors.ivory : colors.muted
    return { color: taken.has(cell) ? colors.marks[2] : base, ...(shape === "loop" ? { label: String(cell + 1), ink: colors.ink } : {}) }
  }
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

  // The bin takes what is let go on it. With the hand in the bottom left it lies in the bottom right of the screen, the hand's counterpart
  const binView = (at: { x: number; z: number }) => (
    <>
      <DropZone id="bin" shape={circleShape(at.x, at.z, BIN.radius)} show="always" />
      <TableLabel text="Bin" x={at.x} z={at.z - BIN.radius - 0.5} height={0.4} tone="muted" />
    </>
  )
  // The hand along the near edge of the table, and the zone that takes the cards let go on it
  const handView = (frame: { x: number; z: number; width: number; depth: number }) => (
    <>
      <DropZone id="hand" shape={rectShape(frame.x, frame.z, frame.width, frame.depth)} />
      <Zone
        frame={{ x: frame.x, z: frame.z }}
        layout={slotsOf(state.hand.layout, state.hand.cards.length)}
        size={CARD_SIZE}
        cards={state.hand.cards.map((entry) => ({
          key: entry.id,
          id: `thing-${entry.id}`,
          front: face(entry.card),
          back: cardBack,
          draggable: true,
          onDrop: letGoCard(entry),
          ...(entry.from !== undefined ? { from: topOfDraw(entry.from, draw) } : {}),
        }))}
      />
      <TableLabel text="Hand" x={frame.x} z={frame.z + frame.depth / 2 + 0.5} height={0.45} tone="muted" />
    </>
  )

  // The hand held at the bottom left of the screen: a fan on the frame of the camera, Courtisans' own. Its cards are pressed, since a drag goes over the table and the hand is not on it: a press sends the card to the discard pile
  const screenHand = () => (
    <ScreenHand settings={CORNER_HAND}>
      {(screen) => (
        <Zone
          layout={screenHandLayout(state.hand.cards.length, screen, CARD_SIZE, CORNER_HAND, state.hand.cards.findIndex((entry) => entry.id === hovered))}
          size={CARD_SIZE}
          cards={state.hand.cards.map((entry) => ({
            key: entry.id,
            id: `thing-${entry.id}`,
            front: face(entry.card),
            back: cardBack,
            state: "interactive" as const,
            ariaLabel: "Play the card to the discard pile",
            onPress: () => actions.place(entry.id, "discard"),
            onHover: (over: boolean) => setHovered((now) => (over ? entry.id : now === entry.id ? null : now)),
            ...(entry.from !== undefined ? { from: screen.local(topOfDraw(entry.from, draw)) } : {}),
          }))}
        />
      )}
    </ScreenHand>
  )

  return (
    <Stage id="scene-playground" camera={camera(state)} playIntro={false} surface={teal ? tealSurface : undefined}>
      {teal && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.001} renderOrder={-1} raycast={() => null}>
          <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
          <meshBasicMaterial map={felt.mat} blending={AdditiveBlending} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {/* What the visitor moves */}
      {things.map((thing) => {
        const chosen = selected === thing.id
        if (thing.kind === "card") {
          const pose = onTable(thing.x, thing.z, { face: thing.face, yaw: 0.18 * Math.sin(thing.id * 2.3) })
          return (
            <Card
              key={thing.id}
              id={`thing-${thing.id}`}
              target={pose}
              front={face(thing.card)}
              back={cardBack}
              size={CARD_SIZE}
              from={thing.from !== undefined ? topOfDraw(thing.from, draw) : undefined}
              // The table raises and lights a picked card; `glow` adds one of the parts of a glow on top, for the panel's choice
              state={chosen ? "selected" : "interactive"}
              ariaLabel={`Card ${thing.card}`}
              onPress={() => actions.select(chosen ? null : thing.id)}
              glow={chosen && state.glow !== "none" ? GLOWS[state.glow] : null}
              draggable
              onDrop={letGo(thing)}
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
      {binView(parts.hand && state.layout.hand === "corner" ? CORNER_BIN : BIN)}

      {parts.board && (
        <>
          <Board key={shape} cells={cells} look={cellLook} drops={dropCells} dropId={zoneOf} />
          <TableLabel text={`Board · ${shape === "loop" ? "ring" : shape}`} x={plan.at.x} z={Math.max(...centres.map((cell) => cell.z)) + plan.size * 0.5 + 1.1} height={0.45} tone="muted" />
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
      {parts.hand && (state.layout.hand === "corner" ? screenHand() : handView({ ...HAND_AT }))}
      {parts.piles && (
        <>
          <Pile frame={draw} count={PLAY_DECK.size - state.piles.drawn} size={CARD_SIZE} back={cardBack} {...PILE_LOOK} limit={state.layout.piles === "middle" ? 6 : PILE_LIMIT} top={{ id: "draw-top", state: "interactive", ariaLabel: "Deal a card", onPress: actions.deal }} />
          <TableLabel text="Draw pile" x={draw.x} z={draw.z + 2.1} height={0.45} tone="muted" />
          <DropZone id="discard" shape={rectShape(discard.x, discard.z, 2.4, 3.2)} show="always" />
          <Zone
            frame={discard}
            layout={pile(discardShown.length, { face: "up", step: 0.03, lean: "discard", leanAmplitude: 0.12 })}
            size={CARD_SIZE}
            cards={discardShown.map((entry) => ({ key: entry.id, id: `thing-${entry.id}`, front: face(entry.card), back: cardBack }))}
          />
          <TableLabel text="Discard pile" x={discard.x} z={discard.z + 2.4} height={0.45} tone="muted" />
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
        ring.map((spot, i) => {
          const points = state.score.points[i] ?? 0
          const heldAll = state.held.filter((one) => one.seat === i)
          // Few cards are drawn for a seat that holds many (two when the ring is crowded): the rest are a count in the plate's trailing slot, not a mesh each
          const heldHere = heldAll.slice(-(players > 5 ? 2 : 3))
          const top = leader(state) === i
          const mark = `${top ? "★ " : ""}${i > 0 && heldAll.length > heldHere.length ? `×${heldAll.length}` : ""}`.trim()
          const frame = heldFrame(spot)
          const hand = handFrameOf(spot)
          return (
            <group key={i}>
              <Seat
                nickname={nameOf(i)}
                color={seatColors[i % seatColors.length]!}
                theme={DEFAULT_SEAT_THEME}
                frame={i > 0 ? frame : undefined}
                above={i > 0 ? roomOf(spot) : undefined}
                spot={spot}
                viewer={i === 0}
                active={state.turn === i}
                line={`${state.score.total[i] ?? 0} pts`}
                trailing={mark ? <TableText text={mark} style={{ color: colors.text, weight: 700 }} height={0.4} position={[0.35, 0, 0]} /> : undefined}
                status={state.seat === i ? "Picked" : parts.scoreboard && points > 0 ? `+${points} this round` : undefined}
              />
              {i > 0 && heldHere.length > 0 && (
                <>
                  <HandShadow at={hand} radius={HELD_SHADOW.radius(heldHere.length)} opacity={HELD_SHADOW.opacity} />
                  <Zone
                    frame={hand}
                    layout={heldFan(heldHere.length, hand.yaw, CARD_SIZE)}
                    size={CARD_SIZE}
                    cards={heldHere.map((one) => ({
                      key: one.id,
                      id: `thing-${one.id}`,
                      front: face(one.card),
                      back: cardBack,
                      ...(heldState(i) ? { state: heldState(i) } : {}),
                      ...(one.from !== undefined ? { from: topOfDraw(one.from, draw) } : {}),
                    }))}
                  />
                </>
              )}
              {/* A seat with no card in it still can be chosen: a pool of light where its cards would lie */}
              {heldState(i) && i > 0 && heldHere.length === 0 && (
                <LightPool size={{ width: CARD_SIZE.width * 0.68, height: CARD_SIZE.height * 0.68 }} state={heldState(i)!} position={[hand.x, 0.012, hand.z]} yaw={hand.yaw} />
              )}
            </group>
          )
        })}
      {parts.floor && (
        <>
          {(() => {
            const pads = floorPads(draw)
            const hitTone = PLAY_FLOOR_TONES.hit
            const stayTone = PLAY_FLOOR_TONES.stay
            const off = state.floor.disabled
            const empty = state.piles.drawn >= PLAY_DECK.size
            return (
              <>
                <FloorButton at={pads.hit} width={pads.hit.width} depth={pads.hit.depth} tone={hitTone} label="Hit" onPress={actions.hit} disabled={off || empty} />
                <FloorButton at={pads.stay} width={pads.stay.width} depth={pads.stay.depth} tone={stayTone} label="Stay" onPress={actions.stay} disabled={off} />
                <FloorButton at={pads.deal} width={pads.deal.width} depth={pads.deal.depth} tone={hitTone} label="Deal" labelHeight={0.45} onPress={actions.dealRound} disabled={off || empty} />
              </>
            )
          })()}
          {choosing &&
            ring.map((spot, i) => {
              // Their cards and their plate: a press anywhere in it chooses the player. Nothing is drawn on it. The viewer's own cards are the hand in the corner, which has no area here
              if (i === 0) return null
              const frame = heldFrame(spot)
              const room = roomOf(spot)
              const area = joinBoxes([room, plateBoxOf(plateAbove(room))])!
              const middle = pointInFrame(frame, centreOf(area))
              return (
                <Hotspot
                  key={i}
                  at={{ ...middle, yaw: frame.yaw }}
                  width={area.maxX - area.minX + 0.6}
                  depth={area.maxZ - area.minZ + 0.6}
                  ariaLabel={`Give a card to ${nameOf(i)}`}
                  onPress={giving ? () => actions.give(i) : undefined}
                  onTouch={(next) => setTouches((now) => ({ ...now, [i]: next }))}
                />
              )
            })}
        </>
      )}
      {parts.scoreboard && parts.seats && !parts.floor && <TableText text={`Round ${state.score.round}${leader(state) === null ? "" : ` · ${nameOf(leader(state) ?? 0)} leads`}`} style={{ color: colors.muted }} height={0.55} position={[0, 0.02, -3.3]} />}
    </Stage>
  )
}
