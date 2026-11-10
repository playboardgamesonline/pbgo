"use client"

import { Card, type CameraSettings, type Drop, DropZone, fan, onTable, pile, rectShape, row, shifted, Zone, type ZoneCard } from "@pbgo/table"
import { useMemo } from "react"
import { DRAG_ZONES, type DragCards, type DragZone } from "../defaults"
import { back, CARD_SIZE, face } from "./art"
import { Stage, TableLabel } from "./parts"

// A hand of five cards and two zones on a table. Pick a card up and the zones it may go on light up; let it go on one and it flies from where it was let go into its place there, let it go on nothing and it goes back, or lies where it is when the switch says so.
// The same cards can be played with a click: press a card, then press a zone. The rule of the game is not in the scene: it is told which zones each card may go on (`dropOn`) and what happened (`onDrop`).

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0.6, targetZ: 0.9 }
/** The table seen from nearly straight above, where what is dragged is under the pointer. */
const ABOVE: CameraSettings = { tilt: 6, yaw: 0, distance: 15, fov: 34, targetX: 0.6, targetZ: 0.9 }
const HAND = { x: 0.6, z: 4.5 }
const ZONES = Object.entries(DRAG_ZONES) as [DragZone, (typeof DRAG_ZONES)[DragZone]][]

export function DragScene({
  cards,
  picked,
  above,
  mayPlay,
  onDrop,
  onPick,
  onZone,
}: {
  cards: DragCards
  picked: number | null
  above: boolean
  mayPlay: (card: number) => boolean
  onDrop: (card: number, drop: Drop) => void
  onPick: (card: number) => void
  onZone: (zone: DragZone) => void
}) {
  const cardBack = back()
  const handLayout = useMemo(() => fan(cards.hand.length, { gap: 1.05, curve: 0.05, roll: 0.03 }), [cards.hand.length])
  const playLayout = useMemo(() => row(cards.play.length, { gap: 0.95 }), [cards.play.length])
  const discardLayout = useMemo(() => pile(cards.discard.length, { face: "up", lean: "discard" }), [cards.discard.length])
  // The zones a card may go on, by the rule of the specimen: the engine's `legal` list, told to the cards
  const zonesOf = (card: number): DragZone[] => (mayPlay(card) ? ["play", "discard"] : ["discard"])
  const own = (card: number): ZoneCard => ({
    key: card,
    id: card,
    front: face(card),
    back: cardBack,
    draggable: true,
    dropOn: zonesOf(card),
    onDrop: (drop) => onDrop(card, drop),
    onClick: (event) => {
      event.stopPropagation()
      onPick(card)
    },
  })
  return (
    <Stage id="scene-drag" camera={above ? ABOVE : CAMERA} playIntro={false}>
      {ZONES.map(([name, zone]) => (
        <DropZone
          key={name}
          id={name}
          shape={rectShape(zone.x, zone.z, zone.width, zone.depth, { radius: 0.25 })}
          show="always"
          ready={picked !== null && zonesOf(picked).includes(name)}
          onClick={(event) => {
            event.stopPropagation()
            onZone(name)
          }}
        />
      ))}
      <TableLabel text="Play" x={DRAG_ZONES.play.x} z={DRAG_ZONES.play.z + DRAG_ZONES.play.depth / 2 + 0.55} height={0.45} tone="muted" />
      <TableLabel text="Discard" x={DRAG_ZONES.discard.x} z={DRAG_ZONES.discard.z + DRAG_ZONES.discard.depth / 2 + 0.55} height={0.45} tone="muted" />
      <Zone
        frame={{ x: DRAG_ZONES.play.x, z: DRAG_ZONES.play.z }}
        layout={playLayout}
        size={CARD_SIZE}
        stagger={0}
        cards={cards.play.map(own)}
      />
      <Zone
        frame={{ x: DRAG_ZONES.discard.x, z: DRAG_ZONES.discard.z }}
        layout={discardLayout}
        size={CARD_SIZE}
        stagger={0}
        cards={cards.discard.map(own)}
      />
      {cards.loose.map(({ card, x, z }) => {
        const { key, ...props } = own(card)
        return <Card key={key} {...props} target={onTable(x, z, { yaw: 0.12 * Math.sin(card) })} size={CARD_SIZE} />
      })}
      <Zone
        frame={HAND}
        layout={handLayout.map((pose, i) => (cards.hand[i] === picked ? shifted(pose, { y: 0.4, z: -0.6 }) : pose))}
        size={CARD_SIZE}
        stagger={0}
        cards={cards.hand.map(own)}
      />
    </Stage>
  )
}
