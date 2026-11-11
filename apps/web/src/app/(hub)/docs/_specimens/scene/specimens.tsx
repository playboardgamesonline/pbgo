"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { type Coord, type LaidTile, addStrokes, allSubmitted, longestTrail, rerollDice, rollDice, bagSize, createSaveableRng, type Drawing, drawFromBag, drawingPoints, emptyDrawing, EngineError, hexBoard, openSubmissions, reachable, restoreRng, revealSubmissions, shortestPath, squareBoard, type Stroke, submit, submittedFlags, type Submissions, undoStroke } from "@pbgo/engine-kit"
import { ask, askChoice, askNumber, askText } from "@pbgo/core/components/game/prompt"
import { PromptHost } from "@pbgo/core/components/game/prompt-host"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { Button } from "@pbgo/ui/platform/button"
import { Choice, Knob, Option } from "./controls"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { BAG_SEED, BAG_START, BET_MOST, BID, BID_FACES, BID_PLAYERS, type Bid, type BidPlayer, type BidView, BOARD_HAND, BOARD_PLAYERS, CAMERA_VIEW, COUNTER_RANGE, COUNTER_TIME, CUP_DICE, CUP_TIMES, DICE_COUNT, DICE_SHAPES, DICE_SIDES, DICE_START, type DiceKnobs, type DiceShape, DRAG_HAND, DRAG_START, ISLAND_BUILDS, ISLAND_PLAYERS, type IslandBuild, type IslandPlayer, SHEET, type DragCards, type DragZone, type Drawn, FIELD_LENGTH, type FlightKnobs, GRID, GRID_START, GRID_WALLS, type GridKind, LAYOUT_CARDS, LAYOUTS, type LayoutName, NUMBERS, PIECE_STACK, MEMORY_CARDS, PILE_CARDS, SEAT_PLAYERS, SEAT_TURNS, type SeatTurn, SHADOW_START, SKETCH_BRUSHES, SKETCH_COLORS, SKETCH_PEN, SKETCH_RULES, TIMER_SECONDS, TRACK_LINE, TRACK_LOOP, TRACK_START, type PourPose } from "./defaults"
import { SceneFrame } from "./frame"
import { ISLAND_CORNERS } from "./island"
import { deal, lay, nextFitting, SEED, START, TABLE, TILES, type TileName, view } from "./landscape"
import { BONUS, CATEGORIES, CATEGORY_OF, ROW_OF, scoreOf, totalOf, upperOf } from "./yahtzee"
import { TilesScene, BagScene, BetsScene, BidScene, BoardScene, CameraScene, CardScene, CounterScene, CupScene, DiceScene, DragScene, FlightScene, GlowsScene, GridScene, LayoutsScene, NumbersScene, PiecesScene, PileScene, PoseMemoryScene, PourScene, RoadMapScene, SeatScene, SeatsScene, SheetScene, SketchScene, TableScene, TextFieldScene, TimerScene, TrackScene, ZonesScene } from "./lazy"

// The light half of the 3D specimens of the engine docs: each is the state and the controls of one scene, laid out in a `SceneFrame`, and the scene itself (`lazy.tsx`), which is drawn only when the frame is near the window. The controls
// are the platform's own and hold every value the scene is given, so they are there, and still, before the scene is and after it is let go; the scene is a function of them and sends back what the pointer did in it.

export function SceneBoardSpecimen() {
  const [players, setPlayers] = useState(3)
  const [played, setPlayed] = useState<number[]>([])
  const hand = BOARD_HAND.filter((id) => !played.includes(id))
  const play = (id: number) => setPlayed((current) => (current.includes(id) ? current : [...current, id]))
  const first = hand[0]
  return (
    <SceneFrame
      label="A small card table seen from above: the viewer's hand in front, the backs of the cards the other players hold along the far side, a draw pile, and the middle of the table where played cards lie"
      controls={
        <>
          <Choice
            label="Players"
            value={String(players)}
            options={BOARD_PLAYERS.map((count) => ({ value: String(count), label: String(count), description: `${count} players` }))}
            onChange={(value) => setPlayers(Number(value))}
          />
          <Button variant="outline" size="sm" disabled={first === undefined} onClick={() => first !== undefined && play(first)}>
            Play a card
          </Button>
          <Button variant="outline" size="sm" disabled={played.length === 0} onClick={() => setPlayed([])}>
            Take them back
          </Button>
        </>
      }
    >
      <BoardScene players={players} hand={hand} played={played} onPlay={play} />
    </SceneFrame>
  )
}

export function SceneTableSpecimen() {
  // How many times the visitor asked for the entrance again
  const [replays, setReplays] = useState(0)
  // The entrance is the one thing the table does not play for a visitor who asks for less motion, whatever the game says
  const reduced = usePrefersReducedMotion()
  return (
    <SceneFrame
      label="A card table seen from above: an endless table of felt with a few cards lying on it, some face up and some face down"
      controls={
        <>
          <Button variant="outline" size="sm" disabled={reduced} onClick={() => setReplays((count) => count + 1)}>
            Replay the entrance
          </Button>
          {reduced && <p className="text-sm text-muted-foreground">This device asks for less motion, so the entrance does not play.</p>}
        </>
      }
    >
      <TableScene replays={replays} />
    </SceneFrame>
  )
}

export function SceneCameraSpecimen() {
  const [view, setView] = useState(CAMERA_VIEW)
  const set = (field: keyof typeof CAMERA_VIEW) => (value: number) => setView((current) => ({ ...current, [field]: value }))
  return (
    <SceneFrame
      label="The same card table, seen by a camera whose tilt, yaw, distance and field of view are set by the sliders"
      controls={
        <>
          <Knob label="Tilt" value={view.tilt} min={0} max={85} step={1} onChange={set("tilt")} format={(value) => `${value}°`} />
          <Knob label="Yaw" value={view.yaw} min={-90} max={90} step={1} onChange={set("yaw")} format={(value) => `${value}°`} />
          <Knob label="Distance" value={view.distance} min={6} max={30} step={0.5} onChange={set("distance")} format={(value) => value.toFixed(1)} />
          <Knob label="Field of view" value={view.fov} min={15} max={80} step={1} onChange={set("fov")} format={(value) => `${value}°`} />
          <Button variant="outline" size="sm" onClick={() => setView(CAMERA_VIEW)}>
            Reset the view
          </Button>
        </>
      }
    >
      <CameraScene {...view} />
    </SceneFrame>
  )
}

export function SceneCardSpecimen() {
  const [side, setSide] = useState<"up" | "down">("up")
  const [gloss, setGloss] = useState(true)
  const [shadow, setShadow] = useState(true)
  const [shadowOpacity, setShadowOpacity] = useState(SHADOW_START)
  const flip = () => setSide((current) => (current === "up" ? "down" : "up"))
  return (
    <SceneFrame
      label="A single playing card held above a table, which turns over when it is pressed"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={flip}>
            Flip the card
          </Button>
          <Option label="Gloss" checked={gloss} onChange={setGloss} />
          <Option label="Shadow" checked={shadow} onChange={setShadow} />
          <Knob label="Shadow opacity" value={shadowOpacity} min={0} max={1} step={0.01} onChange={setShadowOpacity} format={(value) => value.toFixed(2)} />
        </>
      }
    >
      <CardScene side={side} gloss={gloss} shadow={shadow} shadowOpacity={shadowOpacity} onFlip={flip} />
    </SceneFrame>
  )
}

export function SceneGlowsSpecimen() {
  return (
    <SceneFrame label="Five cards in a row, lit by a halo, an outline, a frame, a sparkle, and all four together; each is labelled">
      <GlowsScene />
    </SceneFrame>
  )
}

export function SceneFlightSpecimen() {
  const [side, setSide] = useState<"left" | "right">("left")
  // Null until the scene has said what `CARD_SETTINGS` holds
  const [knobs, setKnobs] = useState<FlightKnobs | null>(null)
  const set = (field: keyof FlightKnobs) => (value: number) => setKnobs((current) => (current ? { ...current, [field]: value } : current))
  const times = (value: number) => `×${value.toFixed(2)}`
  return (
    <SceneFrame
      label="A card on the left of a table that flies to the right when it is sent, arching and bending on the way, and back"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => setSide((current) => (current === "left" ? "right" : "left"))}>
            {side === "left" ? "Send it across" : "Send it back"}
          </Button>
          <Knob label="Flight duration" value={knobs?.flightDuration ?? null} min={0.2} max={3} step={0.01} onChange={set("flightDuration")} format={times} />
          <Knob label="Flight height" value={knobs?.flightHeight ?? null} min={0} max={3} step={0.01} onChange={set("flightHeight")} format={times} />
          <Knob label="Bend" value={knobs?.foldable ?? null} min={0} max={1} step={0.01} onChange={set("foldable")} format={(value) => value.toFixed(2)} />
        </>
      }
    >
      <FlightScene side={side} knobs={knobs} onDefaults={setKnobs} />
    </SceneFrame>
  )
}

export function ScenePoseMemorySpecimen() {
  const [middle, setMiddle] = useState<number[]>([])
  const move = (id: number) => setMiddle((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]))
  const hand = MEMORY_CARDS.filter((id) => !middle.includes(id))
  const first = hand[0]
  const last = middle[middle.length - 1]
  return (
    <SceneFrame
      label="A hand of cards in front and the middle of a table behind it: a card pressed in one flies to the other, from where it was"
      controls={
        <>
          <Button variant="outline" size="sm" disabled={first === undefined} onClick={() => first !== undefined && move(first)}>
            To the middle
          </Button>
          <Button variant="outline" size="sm" disabled={last === undefined} onClick={() => last !== undefined && move(last)}>
            Back to the hand
          </Button>
        </>
      }
    >
      <PoseMemoryScene middle={middle} onMove={move} />
    </SceneFrame>
  )
}

export function SceneLayoutsSpecimen() {
  const [layout, setLayout] = useState<LayoutName>("fan")
  const [count, setCount] = useState(LAYOUT_CARDS.start)
  return (
    <SceneFrame
      label="Cards laid out on a table by one of four layout helpers, a fan, a row, a pile or a grid, chosen with the toggle"
      controls={
        <>
          <Choice label="Layout" value={layout} options={LAYOUTS.map((name) => ({ value: name, label: name }))} onChange={setLayout} />
          <Knob label="Cards" value={count} min={1} max={LAYOUT_CARDS.max} step={1} onChange={setCount} />
        </>
      }
    >
      <LayoutsScene layout={layout} count={count} />
    </SceneFrame>
  )
}

export function SceneZonesSpecimen() {
  return (
    <SceneFrame label="The three zones of a board on one table: the viewer's hand in front, the cards another player holds on their seat across the table, and a shared zone in the middle; each is named on the table">
      <ZonesScene />
    </SceneFrame>
  )
}

/** The draw pile and what was taken from it, in one value so that a draw is one update that reads the pile as it is, however fast the presses come. `next` is the number of the card on top: the one drawn next. */
type PileState = { count: number; next: number; drawn: Drawn[] }

const FRESH_PILE: PileState = { count: PILE_CARDS.start, next: 0, drawn: [] }

export function ScenePileSpecimen() {
  const [pile, setPile] = useState(FRESH_PILE)
  const [topUp, setTopUp] = useState(false)
  const { count, next, drawn } = pile
  const draw = () => setPile((current) => (current.count === 0 ? current : { count: current.count - 1, next: current.next + 1, drawn: [...current.drawn, { id: current.next, from: current.count }] }))
  return (
    <SceneFrame
      label="A draw pile on the left of a table and a discard pile on the right: a card drawn from the first flies to the second"
      controls={
        <>
          <Knob label="Cards in the pile" value={count} min={0} max={PILE_CARDS.max} step={1} onChange={(value) => setPile((current) => ({ ...current, count: value }))} />
          <Option label="Top card turned up" checked={topUp} onChange={setTopUp} />
          <Button variant="outline" size="sm" disabled={count === 0} onClick={draw}>
            Draw a card
          </Button>
          <Button variant="ghost" size="sm" disabled={drawn.length === 0} onClick={() => setPile(FRESH_PILE)}>
            Put them back
          </Button>
        </>
      }
    >
      <PileScene count={count} topUp={topUp} next={next} drawn={drawn} onDraw={draw} />
    </SceneFrame>
  )
}

export function SceneSeatsSpecimen() {
  const [count, setCount] = useState(SEAT_PLAYERS.start)
  const [me, setMe] = useState<number | null>(0)
  // A viewer who is not at the table any more (the players dropped below their seat) is a spectator
  const viewer = me !== null && me < count ? me : null
  return (
    <SceneFrame
      label="The ring of seats around a table for two to eight players: each seat is a disc with its number and an arrow for the way it faces, and the viewer's seat is the one in front"
      controls={
        <>
          <Knob label="Players" value={count} min={SEAT_PLAYERS.min} max={SEAT_PLAYERS.max} step={1} onChange={setCount} />
          <Choice
            label="Viewer's seat"
            value={viewer === null ? "none" : String(viewer)}
            options={[{ value: "none", label: "None" }, ...Array.from({ length: count }, (_, i) => ({ value: String(i), label: String(i + 1), description: `Seat ${i + 1}` }))]}
            onChange={(value) => setMe(value === "none" ? null : Number(value))}
          />
        </>
      }
    >
      <SeatsScene count={count} me={viewer} />
    </SceneFrame>
  )
}

const TURN_LABELS: Record<SeatTurn, string> = { none: "Nobody", you: "You", left: "Left", right: "Right" }

export function SceneSeatSpecimen() {
  const [turn, setTurn] = useState<SeatTurn>("left")
  const [expected, setExpected] = useState(false)
  const [winner, setWinner] = useState(false)
  const [away, setAway] = useState(false)
  const [out, setOut] = useState(false)
  const [pick, setPick] = useState(false)
  const [points, setPoints] = useState(12)
  return (
    <SceneFrame
      label="Three seats of a table for five players, the viewer's in front and one on each side: each plate has its name in the seat colour, its avatar, its score line, a crown on the avatar when it is the player's turn and an aura under it for the winners and the players expected together; a plate fades when its player is away or out, and lights up under the pointer when it can be picked"
      controls={
        <>
          <Choice
            label="Whose turn"
            value={turn}
            options={SEAT_TURNS.map((value) => ({ value, label: TURN_LABELS[value], description: value === "none" ? "Nobody's turn" : `${TURN_LABELS[value]} seat's turn` }))}
            onChange={setTurn}
          />
          <Option label="Everybody expected" checked={expected} onChange={setExpected} />
          <Option label="Winners" checked={winner} onChange={setWinner} />
          <Option label="Left is away" checked={away} onChange={setAway} />
          <Option label="Right is out" checked={out} onChange={setOut} />
          <Option label="Names can be picked" checked={pick} onChange={setPick} />
          <Knob label="Score" value={points} min={0} max={30} step={1} onChange={setPoints} />
        </>
      }
    >
      <SeatScene turn={turn} expected={expected} winner={winner} away={away} out={out} pick={pick} points={points} onPick={setTurn} />
    </SceneFrame>
  )
}

export function SceneDiceSpecimen() {
  const [shape, setShape] = useState<DiceShape>("d6")
  const [count, setCount] = useState(DICE_COUNT.start)
  const [above, setAbove] = useState(false)
  // What the engine rolled, a face for every die the slider can reach, and how many rolls there have been: a roll changes the number, which is what throws the dice
  const [values, setValues] = useState<readonly number[]>(DICE_START)
  const [rolls, setRolls] = useState(0)
  // Null until the scene has said what `DIE_SETTINGS` holds
  const [knobs, setKnobs] = useState<DiceKnobs | null>(null)
  const set = (field: keyof DiceKnobs) => (value: number) => setKnobs((current) => (current ? { ...current, [field]: value } : current))
  const sides = DICE_SIDES[shape]
  const roll = () => {
    setValues(Array.from({ length: DICE_COUNT.max }, () => 1 + Math.floor(Math.random() * sides)))
    setRolls((current) => current + 1)
  }
  // A die with fewer faces than the number it was left on shows the nearest it has
  const shown = values.slice(0, count).map((value) => Math.min(value, sides))
  return (
    <SceneFrame
      label="Dice thrown onto a table inside a marked area: they bounce, tumble, knock one another and settle on the number they were given, which is also written under the scene"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={roll}>
            Roll the dice
          </Button>
          <Choice label="Shape" value={shape} options={DICE_SHAPES.map((name) => ({ value: name, label: name, description: `${DICE_SIDES[name]} faces` }))} onChange={setShape} />
          <Knob label="Dice" value={count} min={DICE_COUNT.min} max={DICE_COUNT.max} step={1} onChange={setCount} />
          <Option label="Seen from above" checked={above} onChange={setAbove} />
          <Knob label="Bounce" value={knobs?.restitution ?? null} min={0} max={0.95} step={0.01} onChange={set("restitution")} format={(value) => value.toFixed(2)} />
          <Knob label="Throw speed" value={knobs?.throwSpeed ?? null} min={1} max={30} step={0.1} onChange={set("throwSpeed")} format={(value) => value.toFixed(1)} />
          <Knob label="Playback speed" value={knobs?.speed ?? null} min={0.1} max={2} step={0.05} onChange={set("speed")} format={(value) => `×${value.toFixed(2)}`} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {rolls === 0 ? "The dice lie as the engine left them: " : "The engine rolled: "}
            <span className="text-foreground tabular-nums">{shown.join(", ")}</span>
          </p>
        </>
      }
    >
      <DiceScene shape={shape} count={count} above={above} values={shown} rolls={rolls} knobs={knobs} onDefaults={setKnobs} />
    </SceneFrame>
  )
}

export function SceneTextFieldSpecimen() {
  // What the player confirmed, which is also what was posted to the engine and what the others read
  const [sent, setSent] = useState<string | null>(null)
  const [max, setMax] = useState(FIELD_LENGTH.start)
  const [several, setSeveral] = useState(false)
  const write = (text: string) => setSent(text)
  const lines = several ? 3 : 1
  return (
    <SceneFrame
      label="Two fields of text on a table: pressing the left one opens a window where the player writes a clue, and the text they confirm appears on it and on the right one, as another player reads it"
      controls={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void askText({ title: "Your clue", description: "One word that the others will guess from.", value: sent ?? "", placeholder: "Press to write a clue", rules: { max, lines } }).then((text) => text !== null && write(text))}
          >
            Write a clue
          </Button>
          <Knob label="Longest text" value={max} min={FIELD_LENGTH.min} max={FIELD_LENGTH.max} step={1} onChange={setMax} />
          <Option label="Three lines" checked={several} onChange={setSeveral} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {sent === null ? "Nothing has been sent to the engine." : "Sent to the engine: "}
            {sent !== null && <span className="whitespace-pre-line text-foreground">{sent}</span>}
          </p>
          <PromptHost />
        </>
      }
    >
      <TextFieldScene text={sent ?? ""} sent={sent} max={max} lines={lines} onWrite={write} />
    </SceneFrame>
  )
}

export function SceneBetsSpecimen() {
  // What each window gave back, which is what the board posts to the engine
  const [bet, setBet] = useState<number | null>(null)
  const [face, setFace] = useState<number | null>(null)
  const [bid, setBid] = useState<Bid | null>(null)
  const askBet = () => askNumber({ title: "Your bet", description: "How many tricks you think you will win.", value: bet ?? undefined, min: 0, max: BET_MOST }).then((value) => value !== null && setBet(value))
  const askFace = () => askChoice({ title: "Your face", description: "The face of the die you bet on.", options: BID_FACES, value: face ?? undefined, instant: true }).then((value) => value !== null && setFace(value))
  const askBid = () =>
    ask({
      title: "Your bid",
      description: "At least how many dice show which face, on the whole table.",
      fields: [
        { id: "count", kind: "number", label: "How many", min: 1, max: 30, value: bid?.count },
        { id: "face", kind: "choice", label: "Of which face", options: BID_FACES, value: bid?.face },
      ],
    }).then((answers) => answers && setBid({ count: answers.count as number, face: answers.face as number }))
  const posted = [bet !== null ? `bet ${bet}` : null, face !== null ? `face ${face}` : null, bid ? `bid ${bid.count} × ${bid.face}` : null].filter(Boolean)
  return (
    <SceneFrame
      label="Three papers on a table, each opening a window: a bet of tricks with a stepper, a face to pick among six, and a bid with two fields at once, how many dice and of which face; what each window gives back is written under the scene"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => void askBet()}>
            Bet tricks
          </Button>
          <Button variant="outline" size="sm" onClick={() => void askFace()}>
            Pick a face
          </Button>
          <Button variant="outline" size="sm" onClick={() => void askBid()}>
            Place a bid
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {posted.length === 0 ? "Nothing has been sent to the engine." : "Sent to the engine: "}
            {posted.length > 0 && <span className="text-foreground tabular-nums">{posted.join(" · ")}</span>}
          </p>
          <PromptHost />
        </>
      }
    >
      <BetsScene bet={bet} face={face} bid={bid} onBet={setBet} onFace={setFace} onAskBid={() => void askBid()} />
    </SceneFrame>
  )
}

export function ScenePiecesSpecimen() {
  const [picked, setPicked] = useState<string | null>(null)
  const [ringed, setRinged] = useState(false)
  const [stack, setStack] = useState(PIECE_STACK.start)
  const [over, setOver] = useState(false)
  const [across, setAcross] = useState(false)
  const pick = (id: string) => setPicked((current) => (current === id ? null : id))
  return (
    <SceneFrame
      label="Pieces on a table: one of each shape in a row, which rises with a ring round it when it is pressed, then a stack of discs whose count is set by a slider, a hexagonal tile with a picture on each face that hops over, and a pawn that flies from one place to another"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => setOver((current) => !current)}>
            Turn the tile over
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAcross((current) => !current)}>
            Send the pawn across
          </Button>
          <Knob label="Pieces in the stack" value={stack} min={0} max={PIECE_STACK.max} step={1} onChange={setStack} />
          <Option label="Ring every piece" checked={ringed} onChange={setRinged} />
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Picked</span>
            <ToggleGroup type="single" value={picked ?? ""} aria-label="Picked piece" onValueChange={(value) => setPicked(value === "" ? null : value)}>
              {["disc", "square", "hex", "cube", "sphere", "pawn"].map((name) => (
                <ToggleGroupItem key={name} value={name}>
                  {name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </>
      }
    >
      <PiecesScene picked={picked} ringed={ringed} stack={stack} over={over} across={across} onPick={pick} />
    </SceneFrame>
  )
}

export function SceneCounterSpecimen() {
  // What the engine holds: the number
  const [value, setValue] = useState(COUNTER_RANGE.start)
  const [change, setChange] = useState(true)
  const [seconds, setSeconds] = useState(COUNTER_TIME.start)
  const add = (amount: number) => setValue((current) => Math.max(0, Math.min(COUNTER_RANGE.max, current + amount)))
  return (
    <SceneFrame
      label="One number shown three ways on a table, on its own, written on a piece and as a stack of coins: when the number changes the first two count up or down to it, number by number, and what changed floats up beside them"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => add(1)}>
            Gain 1
          </Button>
          <Button variant="outline" size="sm" onClick={() => add(5)}>
            Gain 5
          </Button>
          <Button variant="outline" size="sm" onClick={() => add(-3)}>
            Lose 3
          </Button>
          <Button variant="outline" size="sm" onClick={() => add(37)}>
            Win big
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setValue(COUNTER_RANGE.start)}>
            Start again
          </Button>
          <Knob label="Number" value={value} min={0} max={COUNTER_RANGE.max} step={1} onChange={setValue} />
          <Knob label="Counting time" value={seconds} min={COUNTER_TIME.min} max={COUNTER_TIME.max} step={0.05} onChange={setSeconds} format={(amount) => `${amount.toFixed(2)} s`} />
          <Option label="Show the change" checked={change} onChange={setChange} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The engine says: <span className="text-foreground tabular-nums">{value}</span>
          </p>
        </>
      }
    >
      <CounterScene value={value} change={change} seconds={seconds} />
    </SceneFrame>
  )
}

export function SceneTrackSpecimen() {
  // What the engine holds: where each marker is, as a number
  const [red, setRed] = useState(TRACK_START.red)
  const [blue, setBlue] = useState(TRACK_START.blue)
  const [points, setPoints] = useState(TRACK_START.points)
  const [reach, setReach] = useState(false)
  const [above, setAbove] = useState(false)
  // A space of the loop `steps` on from `space`, round the end of the track
  const around = (space: number, steps: number) => (((space + steps) % TRACK_LOOP) + TRACK_LOOP) % TRACK_LOOP
  return (
    <SceneFrame
      label="Two tracks on a table: twenty spaces round an oval with a red pawn and a blue pawn that walk along it space by space and stand side by side when they meet, and eleven spaces in a line with a cube that climbs it one point at a time and walks back when the score is reset"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => setRed((space) => around(space, 3))}>
            Move red 3 spaces
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRed((space) => around(space, -2))}>
            Move red back 2
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBlue(0)}>
            Send blue to the start
          </Button>
          <Button variant="outline" size="sm" disabled={points >= TRACK_LINE - 1} onClick={() => setPoints((current) => Math.min(TRACK_LINE - 1, current + 1))}>
            Score a point
          </Button>
          <Button variant="ghost" size="sm" disabled={points === 0} onClick={() => setPoints(0)}>
            Reset the score
          </Button>
          <Option label="Show where red can go" checked={reach} onChange={setReach} />
          <Option label="Seen from above" checked={above} onChange={setAbove} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The engine says: red on space <span className="text-foreground tabular-nums">{red}</span>, blue on <span className="text-foreground tabular-nums">{blue}</span>, score <span className="text-foreground tabular-nums">{points}</span>
          </p>
        </>
      }
    >
      <TrackScene red={red} blue={blue} points={points} reach={reach} above={above} onRed={setRed} />
    </SceneFrame>
  )
}

export function SceneBidSpecimen() {
  // What the engine holds: who has bid and what, secret until everybody has (the `Submissions` of a simultaneous step)
  const [bids, setBids] = useState<Submissions<number>>(() => openSubmissions([...BID_PLAYERS]))
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])
  const flags = submittedFlags(bids)
  const done = allSubmitted(bids)
  // A player may change their bid until the last has bid; the step is over after that
  const place = (who: BidPlayer, amount: number) => setBids((now) => (allSubmitted(now) ? now : submit(now, who, amount)))
  // The others bid one after the other, so that their cards are seen coming to their seats
  const othersBid = () =>
    BID_PLAYERS.slice(1).forEach((who, i) => {
      if (flags[who]) return
      timers.current.push(setTimeout(() => setBids((now) => (now[who] !== null ? now : submit(now, who, Math.floor(Math.random() * BID.count)))), 400 + i * 900))
    })
  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setBids(openSubmissions([...BID_PLAYERS]))
  }
  const known = done ? revealSubmissions(bids, [...BID_PLAYERS]) : null
  // What the view gives the board: the viewer's own bid, who else has bid, and what they bid only once everybody has
  const view: BidView = { mine: bids.you ?? null, others: [{ hasBid: flags.basile ?? false, bid: known ? known[1]! : null }, { hasBid: flags.camille ?? false, bid: known ? known[2]! : null }] }
  const said = (who: BidPlayer, name: string) => `${name} ${flags[who] ? "has" : "has not"} bid`
  return (
    <SceneFrame
      label="A card table with three seats: you in front with a row of six bid cards across the middle of the table, and two other players. Pressing a bid card sends it to your seat face up, and pressing another takes its place; the others' bids lie face down at their seats as soon as they are made, and turn over together when the last player has bid"
      controls={
        <>
          <Choice label="Your bid" value={view.mine === null ? "none" : String(view.mine)} options={Array.from({ length: BID.count }, (_, k) => ({ value: String(k), label: String(k), description: `Bid ${k}` }))} onChange={(value) => place("you", Number(value))} />
          <Button variant="outline" size="sm" disabled={done || (flags.basile && flags.camille)} onClick={othersBid}>
            Let the others bid
          </Button>
          <Button variant="ghost" size="sm" disabled={!flags.you && !flags.basile && !flags.camille} onClick={reset}>
            New round
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The view says: you bid <span className="text-foreground tabular-nums">{view.mine ?? "nothing yet"}</span>; {said("basile", "Basile")} and {said("camille", "Camille")}
            {known ? (
              <>
                . Everybody has bid, so it gives every bid: <span className="text-foreground tabular-nums">{known.join(", ")}</span>.
              </>
            ) : (
              ", and it does not say what they bid until everybody has."
            )}
          </p>
        </>
      }
    >
      <BidScene view={view} onBid={(amount) => place("you", amount)} />
    </SceneFrame>
  )
}

export function SceneNumbersSpecimen() {
  // What the board holds: the count, the face chosen, the bet, and the bet the player last settled on
  const [count, setCount] = useState(NUMBERS.count.start)
  const [face, setFace] = useState<number | null>(null)
  const [bet, setBet] = useState(NUMBERS.bet.start)
  const [settled, setSettled] = useState<number | null>(null)
  return (
    <SceneFrame
      label="Three ways to ask for a number on a table, in pieces and not in a window: a stepper, a number between two arrows that repeat when they are held; a row of six tokens, one of which rises and is ringed when it is pressed; and a slider, a knob that is dragged along a rail marked from 0 to 100"
      controls={
        <>
          <Knob label="How many" value={count} min={NUMBERS.count.min} max={NUMBERS.count.max} step={1} onChange={setCount} />
          <Choice label="Which face" value={face === null ? "none" : String(face)} options={Array.from({ length: NUMBERS.faces }, (_, k) => ({ value: String(k + 1), label: String(k + 1), description: `Face ${k + 1}` }))} onChange={(value) => setFace(Number(value))} />
          <Knob label="Bet" value={bet} min={NUMBERS.bet.min} max={NUMBERS.bet.max} step={NUMBERS.bet.step} onChange={setBet} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCount(NUMBERS.count.start)
              setFace(null)
              setBet(NUMBERS.bet.start)
              setSettled(null)
            }}
          >
            Start again
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The board holds: <span className="text-foreground tabular-nums">{count}</span> of face <span className="text-foreground tabular-nums">{face ?? "none yet"}</span>, a bet of <span className="text-foreground tabular-nums">{bet}</span>
            {settled === null ? "." : <>, and the player settled on <span className="text-foreground tabular-nums">{settled}</span> when they let go of the knob.</>}
          </p>
        </>
      }
    >
      <NumbersScene count={count} face={face} bet={bet} onCount={setCount} onFace={setFace} onBet={setBet} onSettle={setSettled} />
    </SceneFrame>
  )
}

export function SceneSheetSpecimen() {
  // What the board holds: the five dice and which are kept, how many rolls the turn has had, and what each category of the card holds. The dice come from the engine's seeded stream, the kit's `rollDice` and `rerollDice`
  const [rng] = useState(() => createSaveableRng(SHEET.seed))
  const [dice, setDice] = useState<number[]>(() => Array.from({ length: SHEET.dice }, () => 1))
  const [held, setHeld] = useState<boolean[]>(() => Array.from({ length: SHEET.dice }, () => false))
  const [rolls, setRolls] = useState(0)
  const [scores, setScores] = useState<(number | null)[]>(() => CATEGORIES.map(() => null))
  const finished = scores.every((score) => score !== null)
  const canRoll = rolls < SHEET.rolls && !finished
  // The categories that can be chosen: the empty ones, once the dice have been rolled
  const open = rolls > 0 && !finished ? CATEGORIES.flatMap((_, category) => (scores[category] === null ? [category] : [])) : []
  const best = open.reduce<number | undefined>((top, category) => (top === undefined || scoreOf(category, dice) > scoreOf(top, dice) ? category : top), undefined)
  const roll = () => {
    if (!canRoll) return
    setDice((now) => (rolls === 0 ? rollDice(rng, SHEET.dice) : rerollDice(rng, now, now.flatMap((_, die) => (held[die] ? [] : [die])))))
    setRolls((count) => count + 1)
  }
  const score = (category: number) => {
    if (!open.includes(category)) return
    setScores((now) => now.map((had, at) => (at === category ? scoreOf(category, dice) : had)))
    setRolls(0)
    setHeld((now) => now.map(() => false))
  }
  const keep = (die: number) => rolls > 0 && rolls < SHEET.rolls && setHeld((now) => now.map((was, at) => (at === die ? !was : was)))
  const { sum, bonus } = upperOf(scores)
  return (
    <SceneFrame
      label="A scorecard of Yahtzee on a table: a paper with the thirteen categories listed down it and a column of boxes beside them, and a column of five numbered tokens, the dice, to its right. A box that can be chosen is ringed and shows in faint ink what the dice would score in it; pressing one writes the score, and pressing a die keeps it for the next roll"
      tall
      controls={
        <>
          <Button variant="outline" size="sm" disabled={!canRoll} onClick={roll}>
            {rolls === 0 ? "Roll the dice" : "Roll again"}
          </Button>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Keep</span>
            <ToggleGroup
              type="multiple"
              aria-label="Dice to keep"
              value={held.flatMap((was, die) => (was ? [String(die)] : []))}
              onValueChange={(values) => rolls > 0 && rolls < SHEET.rolls && setHeld(held.map((_, die) => values.includes(String(die))))}
            >
              {held.map((_, die) => (
                <ToggleGroupItem key={die} value={String(die)} disabled={rolls === 0 || rolls >= SHEET.rolls} aria-label={`Keep the ${["first", "second", "third", "fourth", "fifth"][die]} die`}>
                  {rolls === 0 ? "?" : dice[die]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Button variant="outline" size="sm" disabled={best === undefined} onClick={() => best !== undefined && score(best)}>
            Score the best box
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={rolls === 0 && scores.every((had) => had === null)}
            onClick={() => {
              setScores((now) => now.map(() => null))
              setHeld((now) => now.map(() => false))
              setRolls(0)
            }}
          >
            Start again
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {finished ? (
              <>
                The card is full: <span className="text-foreground tabular-nums">{totalOf(scores)}</span> in all.
              </>
            ) : (
              <>
                Roll <span className="text-foreground tabular-nums">{rolls}</span> of {SHEET.rolls}.
              </>
            )}{" "}
            <span className="text-foreground tabular-nums">{scores.filter((had) => had !== null).length}</span> of {CATEGORIES.length} boxes written, the upper section <span className="text-foreground tabular-nums">{sum}</span> of {BONUS.needs}
            {bonus > 0 ? ", with the bonus." : "."}
          </p>
        </>
      }
    >
      <SheetScene dice={dice} rolled={rolls > 0 || scores.some((had) => had !== null)} held={held} scores={scores} rows={open.map((category) => ROW_OF[category]!)} onRow={(row) => CATEGORY_OF[row] !== null && score(CATEGORY_OF[row]!)} onDie={keep} />
    </SceneFrame>
  )
}

export function SceneTilesSpecimen() {
  // What the table holds: the box in the order the tiles are drawn, the tiles that are laid, which tile of the box is in hand and how many times it was turned (a number that only goes up, so the tile always turns the way it was pressed), and how many
  // tiles went back in the box for want of a place. The rules are the kit's: where a tile fits, and the roads and the cities that are closed
  const [box] = useState(() => deal(SEED))
  const [laid, setLaid] = useState<LaidTile<TileName>[]>(() => [START])
  const first = useMemo(() => nextFitting([START], box, 0), [box])
  const [index, setIndex] = useState(first)
  const [spin, setSpin] = useState(0)
  const [skipped, setSkipped] = useState(first)
  const { name, turns, options, spots, fits, ways, score } = useMemo(() => view(laid, box, index, spin), [laid, box, index, spin])
  const layOn = (at: Coord, turned: number) => {
    if (!name) return
    const next = lay(laid, box, index, at, turned)
    setLaid(next.laid)
    setSkipped((count) => count + next.skipped)
    setIndex(next.index)
    setSpin(0)
  }
  const turn = () => options.length > 1 && setSpin((count) => count + 1)
  const again = () => {
    setLaid([START])
    setIndex(first)
    setSkipped(first)
    setSpin(0)
  }
  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)
  return (
    <SceneFrame
      label="A table of tiles seen from above: tiles with a road, a city or a field on each side lie side by side, and the next tile of the box lies to the right of them. The cells next to a tile where the next tile fits as it is turned are ringed; pressing one lays the tile there, and pressing the tile turns it a quarter"
      controls={
        <>
          <Button variant="outline" size="sm" disabled={options.length < 2} onClick={turn}>
            Turn the tile
          </Button>
          <Button variant="outline" size="sm" disabled={ways.length === 0} onClick={() => ways[0] && layOn(ways[0].at, ways[0].turns)}>
            Lay it for me
          </Button>
          <Button variant="ghost" size="sm" disabled={laid.length === 1 && spin === 0} onClick={again}>
            Start again
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {name ? (
              <>
                Tile <span className="text-foreground tabular-nums">{index + 1}</span> of {box.length}: {TILES[name].label.startsWith("a") || TILES[name].label.startsWith("e") ? "an" : "a"} {TILES[name].label}, which fits on{" "}
                <span className="text-foreground tabular-nums">{fits.length}</span> {plural(fits.length, "cell", "cells")} as it is turned.
              </>
            ) : (
              <>The box is empty.</>
            )}{" "}
            <span className="text-foreground tabular-nums">{laid.length}</span> {plural(laid.length, "tile", "tiles")} laid. Closed: <span className="text-foreground tabular-nums">{score.roads}</span> {plural(score.roads, "road", "roads")} and{" "}
            <span className="text-foreground tabular-nums">{score.cities}</span> {plural(score.cities, "city", "cities")}, worth <span className="text-foreground tabular-nums">{score.points}</span> {plural(score.points, "point", "points")}.
            {skipped > 0 && (
              <>
                {" "}
                {skipped} {plural(skipped, "tile", "tiles")} fitted nowhere and went back in the box.
              </>
            )}{" "}
            The table is {2 * TABLE.columns + 1} tiles across and {2 * TABLE.rows + 1} down.
          </p>
        </>
      }
    >
      <TilesScene
        laid={laid}
        hand={name ? { tile: name, spin } : null}
        spots={spots}
        fits={fits}
        done={score.tiles}
        turnable={options.length > 1}
        onSpot={(place) => fits.includes(place) && layOn(spots[place]!, turns)}
        onTurn={turn}
      />
    </SceneFrame>
  )
}

/** What a player has built on the island, in words */
const builtBy = (who: IslandPlayer, settlements: readonly (IslandPlayer | null)[], roads: readonly (IslandPlayer | null)[]) => {
  const owned = roads.flatMap((owner, road) => (owner === who ? [road] : []))
  return { settlements: settlements.filter((owner) => owner === who).length, roads: owned.length, longest: longestTrail(ISLAND_CORNERS, owned, { blocked: (point) => settlements[point] === 1 - who }) }
}

export function SceneRoadMapSpecimen() {
  // What the board holds: who has a settlement on each point of the island and who has built each side. The structure is the engine's, the kit's `cornerGraph`
  const [settlements, setSettlements] = useState<(IslandPlayer | null)[]>(() => Array.from({ length: ISLAND_CORNERS.size }, () => null))
  const [roads, setRoads] = useState<(IslandPlayer | null)[]>(() => Array.from({ length: ISLAND_CORNERS.edges.length }, () => null))
  const [player, setPlayer] = useState<IslandPlayer>(0)
  const [build, setBuild] = useState<IslandBuild>("settlement")

  // A settlement goes on a free point with no settlement next to it, and a road on a free side that leaves a point where the player has a settlement or a road, and not through another player's settlement
  const places = Array.from({ length: ISLAND_CORNERS.size }, (_, point) => point).filter((point) => settlements[point] === null && ISLAND_CORNERS.neighbours(point).every((next) => settlements[next] === null))
  const reaches = (point: number) => settlements[point] === player || (settlements[point] === null && ISLAND_CORNERS.edgesAt(point).some((side) => roads[side] === player))
  const sides = roads.flatMap((owner, side) => (owner === null && ISLAND_CORNERS.edges[side]!.some(reaches) ? [side] : []))
  const build_ = (what: IslandBuild, where: number) => {
    if (what === "settlement" && places.includes(where)) setSettlements((now) => now.map((owner, point) => (point === where ? player : owner)))
    if (what === "road" && sides.includes(where)) setRoads((now) => now.map((owner, side) => (side === where ? player : owner)))
  }
  const first = build === "settlement" ? places[0] : sides[0]
  return (
    <SceneFrame
      label="An island of nineteen hexagons seen from above, each with a colour and a number. A ring pulses on every point where a settlement may be built, or a strip on every side where a road may be, and pressing one builds there: the settlement is a cube and the road a wide line, both in the colour of the player"
      controls={
        <>
          <Choice label="Player" value={String(player)} options={ISLAND_PLAYERS.map((name, who) => ({ value: String(who), label: name, description: `${name} builds` }))} onChange={(value) => setPlayer(Number(value) as IslandPlayer)} />
          <Choice label="Build" value={build} options={ISLAND_BUILDS.map((what) => ({ value: what, label: what, description: `Build a ${what}` }))} onChange={setBuild} />
          <Button variant="outline" size="sm" disabled={first === undefined} onClick={() => first !== undefined && build_(build, first)}>
            Build one for me
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={settlements.every((owner) => owner === null) && roads.every((owner) => owner === null)}
            onClick={() => {
              setSettlements((now) => now.map(() => null))
              setRoads((now) => now.map(() => null))
            }}
          >
            Start again
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The island has <span className="text-foreground tabular-nums">{ISLAND_CORNERS.size}</span> points and <span className="text-foreground tabular-nums">{ISLAND_CORNERS.edges.length}</span> sides.
            {ISLAND_PLAYERS.map((name, who) => {
              const have = builtBy(who as IslandPlayer, settlements, roads)
              return (
                <span key={name}>
                  {" "}
                  {name}: <span className="text-foreground tabular-nums">{have.settlements}</span> {have.settlements === 1 ? "settlement" : "settlements"}, <span className="text-foreground tabular-nums">{have.roads}</span> {have.roads === 1 ? "road" : "roads"}, longest road{" "}
                  <span className="text-foreground tabular-nums">{have.longest}</span>.
                </span>
              )
            })}
          </p>
        </>
      }
    >
      <RoadMapScene settlements={settlements} roads={roads} halo={{ places: build === "settlement" ? places : [], roads: build === "road" ? sides : [] }} onPlace={(point) => build_("settlement", point)} onRoad={(side) => build_("road", side)} />
    </SceneFrame>
  )
}

/** How big a drawing is on the wire, in the units a person reads */
const sizeOf = (bytes: number) => (bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} kB`)

export function SceneSketchSpecimen() {
  // What the board holds is the drawing as the engine keeps it: the strokes the sheet sends go through the engine kit, which cleans each one and refuses what does not fit. `held` is the newest drawing, for a batch that arrives before the page has drawn again
  const [drawing, setDrawing] = useState<Drawing>(emptyDrawing)
  const held = useRef<Drawing>(drawing)
  const [pen, setPen] = useState(SKETCH_PEN)
  const [mine, setMine] = useState(true)
  const [refusal, setRefusal] = useState<string | null>(null)
  const keep = (next: Drawing) => {
    held.current = next
    setDrawing(next)
    setRefusal(null)
  }
  const draw = (incoming: Stroke[]) => {
    try {
      keep(addStrokes(held.current, incoming, SKETCH_RULES))
    } catch (error) {
      if (!(error instanceof EngineError)) throw error
      setRefusal(error.code)
    }
  }
  return (
    <SceneFrame
      label="Two sheets of paper on a table seen from above: a large one on the left that can be drawn on with the pointer, and a smaller one on the right that shows what the other players read. A line drawn on the large sheet appears on the small one a moment later, once the board has kept it"
      controls={
        <>
          <Choice label="Colour" value={String(pen.color)} options={SKETCH_COLORS.map((name, k) => ({ value: String(k), label: name, description: `${name} ink` }))} onChange={(value) => setPen((now) => ({ ...now, color: Number(value) }))} />
          <Choice label="Brush" value={String(pen.width)} options={SKETCH_BRUSHES.map((brush, k) => ({ value: String(k), label: brush.name, description: `${brush.name} brush` }))} onChange={(value) => setPen((now) => ({ ...now, width: Number(value) }))} />
          <Option label="It is my turn" checked={mine} onChange={setMine} />
          <Button variant="outline" size="sm" disabled={drawing.length === 0} onClick={() => keep(undoStroke(held.current))}>
            Undo a stroke
          </Button>
          <Button variant="ghost" size="sm" disabled={drawing.length === 0} onClick={() => keep(emptyDrawing())}>
            Clear
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The board holds <span className="text-foreground tabular-nums">{drawing.length}</span> of {SKETCH_RULES.strokes} strokes and <span className="text-foreground tabular-nums">{drawingPoints(drawing)}</span> of {SKETCH_RULES.points} points, which is{" "}
            <span className="text-foreground tabular-nums">{sizeOf(JSON.stringify(drawing).length)}</span> of state.
            {refusal !== null && (
              <>
                {" "}
                The engine refused the last strokes with <code className="text-foreground">{refusal}</code>, and the sheet lets them go a moment later.
              </>
            )}
            {!mine && " It is another player's turn, so the sheet can only be looked at."}
          </p>
        </>
      }
    >
      <SketchScene strokes={drawing} pen={pen} mine={mine} onStrokes={draw} />
    </SceneFrame>
  )
}

export function SceneTimerSpecimen() {
  // What the game says: how long a step lasts. What the platform says: when the time ends, on the page's own clock, and null when no clock runs. What is left when the clock stops
  const [seconds, setSeconds] = useState(TIMER_SECONDS.start)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [rest, setRest] = useState(1)
  const [digits, setDigits] = useState(true)
  const [outs, setOuts] = useState(0)
  const begin = (inSeconds: number) => setEndsAt(performance.now() + inSeconds * 1000)
  const stop = () => {
    if (endsAt !== null) setRest(Math.min(1, Math.max(0, (endsAt - performance.now()) / (seconds * 1000))))
    setEndsAt(null)
  }
  return (
    <SceneFrame
      label="Four hourglasses on a table: a big one whose sand runs as the time of a step goes and which turns over when a new step starts its clock, trembles and reddens in the last seconds and writes the seconds that are left, and three small ones with no clock that show a share of the time and wait"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => begin(seconds)}>
            {endsAt === null ? "Start the clock" : "Start a new step"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => begin(4)}>
            Run out in 4 seconds
          </Button>
          <Button variant="outline" size="sm" disabled={endsAt === null} onClick={stop}>
            Stop the clock
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEndsAt(null)
              setRest(1)
              setOuts(0)
            }}
          >
            Fill it again
          </Button>
          <Knob label="Length of a step" value={seconds} min={TIMER_SECONDS.min} max={TIMER_SECONDS.max} step={1} onChange={setSeconds} format={(value) => `${value} s`} />
          <Option label="Write the seconds" checked={digits} onChange={setDigits} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The game says the step lasts <span className="text-foreground tabular-nums">{seconds}</span> seconds, and the platform says when they end. The hourglass told the board that time was out{" "}
            <span className="text-foreground tabular-nums">{outs}</span> {outs === 1 ? "time" : "times"}; it is the server that plays the move then, not the board.
          </p>
        </>
      }
    >
      <TimerScene endsAt={endsAt} seconds={seconds} rest={rest} digits={digits} onEnd={() => setOuts((count) => count + 1)} />
    </SceneFrame>
  )
}

export function SceneGridSpecimen() {
  // What the engine holds: the cell each pawn stands on, and the way it walked there
  const [pawns, setPawns] = useState<Record<GridKind, { cell: number; route: number[] }>>({ square: { cell: GRID_START.square, route: [] }, hex: { cell: GRID_START.hex, route: [] } })
  const [picked, setPicked] = useState<GridKind | null>(null)
  const [corners, setCorners] = useState(false)
  const [above, setAbove] = useState(false)
  // The boards the engine asks: the squares touch by their corners too when the switch says so
  const boards = useMemo(() => ({ square: squareBoard({ columns: GRID.columns, rows: GRID.rows, diagonals: corners }), hex: hexBoard({ radius: GRID.radius }) }), [corners])
  const rules = (kind: GridKind) => ({ blocked: (cell: number) => GRID_WALLS[kind].includes(cell) })
  // The cells each pawn can reach, which the pawn that is picked up or dragged may be let go on
  const reachOf = (kind: GridKind) => reachable(boards[kind], pawns[kind].cell, GRID.range, rules(kind)).filter((reached) => reached.cell !== pawns[kind].cell).map((reached) => reached.cell)
  const reach = { square: reachOf("square"), hex: reachOf("hex") }
  const move = (kind: GridKind, cell: number) => {
    const route = shortestPath(boards[kind], pawns[kind].cell, cell, rules(kind))
    if (route) setPawns((current) => ({ ...current, [kind]: { cell, route } }))
    setPicked(null)
  }
  // A pawn that is dragged is carried to the cell: it walks no route, the way it would not if somebody lifted it
  const carry = (kind: GridKind, cell: number) => {
    setPawns((current) => ({ ...current, [kind]: { cell, route: [] } }))
    setPicked(null)
  }
  const pick = (kind: GridKind) => setPicked((current) => (current === kind ? null : kind))
  return (
    <SceneFrame
      label="Two boards on a table, thirty-six squares with a wall of three cells and nineteen hexagons with a wall of their own, a pawn on each: pressing a pawn rings the cells it can reach in four steps going round the walls, and pressing a ringed cell sends the pawn there across the cells; or the pawn is picked up and let go on one of them"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => setPicked(null)} disabled={picked === null}>
            Put the pawn down
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPawns({ square: { cell: GRID_START.square, route: [] }, hex: { cell: GRID_START.hex, route: [] } })
              setPicked(null)
            }}
          >
            Put the pawns back
          </Button>
          <Option label="Squares touch by their corners" checked={corners} onChange={setCorners} />
          <Option label="Seen from above" checked={above} onChange={setAbove} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The engine says: the pawn on the squares is on cell <span className="text-foreground tabular-nums">{pawns.square.cell}</span>, the one on the hexagons on cell <span className="text-foreground tabular-nums">{pawns.hex.cell}</span>
            {picked !== null && (
              <>
                , and the <span className="text-foreground">{picked === "square" ? "squares" : "hexagons"}</span> pawn can reach <span className="text-foreground tabular-nums">{reach[picked].length}</span> cells
              </>
            )}
          </p>
        </>
      }
    >
      <GridScene squareAt={pawns.square.cell} squareRoute={pawns.square.route} hexAt={pawns.hex.cell} hexRoute={pawns.hex.route} picked={picked} reach={reach} above={above} onPick={pick} onCell={move} onDrop={carry} />
    </SceneFrame>
  )
}

/** What the engine rolls for a hand: five dice, each from one to six */
const rollHand = () => Array.from({ length: CUP_DICE }, () => 1 + Math.floor(Math.random() * 6))
const START_HANDS = { you: [3, 5, 1, 6, 2], left: [4, 4, 2, 1, 6], right: [5, 3, 3, 6, 1] }

export function SceneCupSpecimen() {
  // What the engine holds: every player's dice. What the view gives the board: yours always, the others' only when they are shown
  const [hands, setHands] = useState(START_HANDS)
  const [shaking, setShaking] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [peek, setPeek] = useState(false)
  // The dice are on the table under the cups; while the cups are shaken they are in them
  const [dice, setDice] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const roll = () => {
    if (shaking) return
    setRevealed(false)
    setPeek(false)
    setDice(false)
    setShaking(true)
    // The cups come down when the shake is over, with the new dice under them
    timer.current = setTimeout(() => {
      setHands({ you: rollHand(), left: rollHand(), right: rollHand() })
      setShaking(false)
    }, CUP_TIMES.shake)
  }
  const mine = hands.you.join(", ")
  return (
    <SceneFrame
      label="Three cups on a table, yours in front and one at each side, each over five dice: they shake and come down in a slam, your cup tilts when you press it to let you look under, and when the dice are shown the cups lift away; the board is never given the dice of the other two until they are shown"
      controls={
        <>
          <Button variant="outline" size="sm" disabled={shaking} onClick={roll}>
            Shake and roll
          </Button>
          <Button variant="outline" size="sm" disabled={shaking} onClick={() => setRevealed((current) => !current)}>
            {revealed ? "Cover the dice again" : "Show all the dice"}
          </Button>
          <Option label="Peek under your cup" checked={peek && !revealed} onChange={setPeek} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            The view says: you hold <span className="text-foreground tabular-nums">{mine}</span>;{" "}
            {revealed ? (
              <>
                the left seat holds <span className="text-foreground tabular-nums">{hands.left.join(", ")}</span> and the right seat <span className="text-foreground tabular-nums">{hands.right.join(", ")}</span>.
              </>
            ) : (
              <>the other two seats hold {CUP_DICE} dice each, and the view does not say which.</>
            )}
          </p>
        </>
      }
    >
      <CupScene
        yours={hands.you}
        left={revealed ? hands.left : null}
        right={revealed ? hands.right : null}
        shaking={shaking}
        revealed={revealed}
        peek={peek}
        dice={dice}
        onPeek={() => setPeek((current) => !current)}
        onSlam={() => setDice(true)}
      />
    </SceneFrame>
  )
}

export function ScenePourSpecimen() {
  // What the engine rolled, how many rolls there have been (a roll throws the dice), and what the cup is doing
  const [values, setValues] = useState<readonly number[]>([2, 4, 6, 1, 3])
  const [rolls, setRolls] = useState(0)
  const [pose, setPose] = useState<PourPose>("rest")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])
  const pour = () => {
    if (pose !== "rest") return
    setPose("shaking")
    timers.current.push(setTimeout(() => setPose("pouring"), CUP_TIMES.shake))
  }
  // The cup is tipped over: the dice are thrown from its mouth, and the cup is put back when they have come to rest
  const poured = () => {
    setValues(rollHand())
    setRolls((current) => current + 1)
    timers.current.push(setTimeout(() => setPose("rest"), CUP_TIMES.pour))
  }
  return (
    <SceneFrame
      label="A cup on a table with a tray of five dice in front of it: it is taken up and shaken, tipped over, the dice fly out of its mouth and roll onto the tray, and the cup is put back on its base"
      controls={
        <>
          <Button variant="outline" size="sm" disabled={pose !== "rest"} onClick={pour}>
            Shake and pour
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {rolls === 0 ? "The dice lie as the engine left them: " : "The engine rolled: "}
            <span className="text-foreground tabular-nums">{values.join(", ")}</span>
          </p>
        </>
      }
    >
      <PourScene values={values} rolls={rolls} pose={pose} onPoured={poured} />
    </SceneFrame>
  )
}

export function SceneBagSpecimen() {
  // What the engine holds: how many tokens of each kind are in the bag, where its stream is, and the kinds drawn so far, in order
  const [bag, setBag] = useState<{ counts: number[]; rng: number; drawn: number[] }>(() => ({ counts: [...BAG_START], rng: createSaveableRng(BAG_SEED).save(), drawn: [] }))
  const left = bagSize(bag.counts)
  const draw = (count: number) =>
    setBag((current) => {
      const rng = restoreRng(current.rng)
      const { drawn, bag: counts } = drawFromBag(rng, current.counts, count)
      return drawn.length === 0 ? current : { counts, rng: rng.save(), drawn: [...current.drawn, ...drawn] }
    })
  return (
    <SceneFrame
      label="A cloth bag of tokens in four colours: pressing it draws a token, which comes out of its mouth and flies into a row, the bag rocks and slumps as it empties, and a counter says how many tokens are left"
      controls={
        <>
          <Button variant="outline" size="sm" disabled={left === 0} onClick={() => draw(1)}>
            Draw a token
          </Button>
          <Button variant="outline" size="sm" disabled={left === 0} onClick={() => draw(3)}>
            Draw three
          </Button>
          <Button variant="ghost" size="sm" disabled={bag.drawn.length === 0} onClick={() => setBag({ counts: [...BAG_START], rng: createSaveableRng(BAG_SEED).save(), drawn: [] })}>
            Put them back
          </Button>
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {bag.drawn.length === 0 ? "Nothing has been drawn: " : "The engine drew the kinds "}
            <span className="text-foreground tabular-nums">{bag.drawn.length === 0 ? "" : bag.drawn.join(", ")}</span>
            {bag.drawn.length === 0 ? "" : ", "}
            <span className="text-foreground tabular-nums">{left}</span> of {bagSize(BAG_START)} are left.
          </p>
        </>
      }
    >
      <BagScene drawn={bag.drawn} left={left} total={bagSize(BAG_START)} pressable={left > 0} onDraw={() => draw(1)} />
    </SceneFrame>
  )
}

export function SceneDragSpecimen() {
  // What the engine holds: where each card is. A card is in the hand, in the play zone, in the discard zone, or lying where it was let go
  const [cards, setCards] = useState<DragCards>(DRAG_START)
  const [picked, setPicked] = useState<number | null>(null)
  const [keep, setKeep] = useState(false)
  const [above, setAbove] = useState(false)
  const [said, setSaid] = useState("")
  const mayPlay = (card: number) => DRAG_HAND.find((entry) => entry.card === card)?.plays ?? false
  // The engine's move: the card leaves where it was and goes where it is sent. A zone it may not go on is refused there, as the engine would
  const send = (card: number, to: DragZone | { x: number; z: number }) =>
    setCards((now) => {
      const without: DragCards = { hand: now.hand.filter((c) => c !== card), play: now.play.filter((c) => c !== card), discard: now.discard.filter((c) => c !== card), loose: now.loose.filter((l) => l.card !== card) }
      return typeof to === "string" ? { ...without, [to]: [...without[to], card] } : { ...without, loose: [...without.loose, { card, ...to }] }
    })
  const drop = (card: number, { target, position }: { target: string | number | null; position: { x: number; z: number } }) => {
    if (target === "play" || target === "discard") {
      if (target === "play" && !mayPlay(card)) return setSaid(`Card ${card} cannot be played, so it went back.`)
      send(card, target)
      return setSaid(`Card ${card} was let go on ${target}.`)
    }
    if (keep) {
      send(card, { x: position.x, z: position.z })
      return setSaid(`Card ${card} was let go on nothing, so it lies where it was let go.`)
    }
    setSaid(`Card ${card} was let go on nothing, so it went back.`)
  }
  const zone = (name: DragZone) => {
    if (picked === null) return
    if (name === "play" && !mayPlay(picked)) return setSaid(`Card ${picked} cannot be played.`)
    send(picked, name)
    setSaid(`Card ${picked} was sent to ${name} with a click.`)
    setPicked(null)
  }
  return (
    <SceneFrame
      label="A card table with a hand of five cards, a Play zone and a Discard zone: picking a card up lights the zones it may go on, letting it go on one sends it there, and letting it go on nothing puts it back; the same cards can be sent with a click on the card and a click on the zone"
      controls={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCards(DRAG_START)
              setPicked(null)
              setSaid("")
            }}
          >
            Put the cards back
          </Button>
          <Option label="Cards lie where they are let go" checked={keep} onChange={setKeep} />
          <Option label="Seen from above" checked={above} onChange={setAbove} />
          <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
            {said === "" ? "Two of the cards cannot be played, only discarded: the Play zone stays dark when you hold one of them." : said}{" "}
            <span className="text-foreground tabular-nums">{cards.hand.length}</span> in the hand, <span className="text-foreground tabular-nums">{cards.play.length}</span> played,{" "}
            <span className="text-foreground tabular-nums">{cards.discard.length}</span> discarded.
          </p>
        </>
      }
    >
      <DragScene cards={cards} picked={picked} above={above} mayPlay={mayPlay} onDrop={drop} onPick={(card) => setPicked((now) => (now === card ? null : card))} onZone={zone} />
    </SceneFrame>
  )
}
