"use client"

import { ActionLabel, type CameraSettings, cardRise, effectiveState, NO_TOUCH, Pile, pile, pileAboveAt, pileFootprint, type Spot, type Touch, Zone } from "@pbgo/table"
import { useState } from "react"
import { back, CARD_SIZE, face } from "./art"
import { Stage } from "./parts"

// A draw pile on the left and a discard on the right, each with the word that says what pressing it does. The draw pile is a `Pile`, which gives its top card the press and draws the word over it (`action`) and lights them both together. The discard is a card of a `Zone`, which
// a board states itself: it keeps what the visitor does to the word (`onTouch`) for the card's state and what the pointer does to the card (`onHover`) for the word (`touch`). With the switch off nothing can be pressed, so no word is drawn and the cards are as they lie.

const CAMERA: CameraSettings = { tilt: 40, yaw: 0, distance: 13, fov: 34, targetX: 0, targetZ: 0.3 }

const DRAW: Spot = { x: -3.3, z: 0 }
const DISCARD: Spot = { x: 3.3, z: 0 }
const SCALE = 1.25
// The piles are far apart, so each word has the room between them: a longer word would be set smaller to fit a narrower one
const ROOM = 5
const DISCARD_LAYOUT = pile(1, { face: "up", scale: SCALE })

export function ActionLabelScene({ count, can, discard, onDraw, onTake }: { count: number; can: boolean; discard: number; onDraw: () => void; onTake: () => void }) {
  const cardBack = back()
  // What the visitor does to the word over the discard, and whether the pointer is over the card: each lights the other
  const [touch, setTouch] = useState<Touch>(NO_TOUCH)
  const [over, setOver] = useState(false)
  return (
    <Stage id="scene-action-label" camera={CAMERA} playIntro={false}>
      <Pile frame={DRAW} count={count} size={CARD_SIZE} back={cardBack} scale={SCALE} limit={14} lean="draw" leanAmplitude={0.06} action={can ? { label: "Draw", onPress: onDraw, room: ROOM } : undefined} />
      <Zone
        frame={DISCARD}
        layout={DISCARD_LAYOUT}
        size={CARD_SIZE}
        cards={[{ key: "discard", front: face(discard), back: cardBack, state: can ? effectiveState("interactive", touch) : "base", onPress: onTake, ariaLabel: "Take the discard", onHover: setOver }]}
      />
      {can && (
        <ActionLabel
          at={pileAboveAt(DISCARD, DISCARD_LAYOUT[0]?.position.y)}
          over={pileFootprint(DISCARD, CARD_SIZE, SCALE)}
          label="Take the discard"
          onPress={onTake}
          touch={{ ...NO_TOUCH, hovered: over }}
          onTouch={setTouch}
          rise={cardRise(CARD_SIZE, SCALE)}
          room={ROOM}
        />
      )}
    </Stage>
  )
}
