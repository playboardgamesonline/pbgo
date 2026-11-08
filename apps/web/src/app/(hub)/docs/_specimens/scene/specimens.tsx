"use client"

import { useState } from "react"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { Button } from "@pbgo/ui/platform/button"
import { Choice, Knob, Option } from "./controls"
import { BOARD_HAND, BOARD_PLAYERS, CAMERA_VIEW, type Drawn, type FlightKnobs, LAYOUT_CARDS, LAYOUTS, type LayoutName, MEMORY_CARDS, PILE_CARDS, SEAT_PLAYERS, SEAT_TURNS, type SeatTurn, SHADOW_START } from "./defaults"
import { SceneFrame } from "./frame"
import { BoardScene, CameraScene, CardScene, FlightScene, GlowsScene, LayoutsScene, PileScene, PoseMemoryScene, SeatScene, SeatsScene, TableScene, ZonesScene } from "./lazy"

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
