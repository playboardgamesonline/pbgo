"use client"

import { Button } from "@pbgo/ui/platform/button"
import { useState } from "react"
import { Knob } from "./controls"
import { SceneFrame } from "./frame"
import { PictureScene } from "./lazy"

// The light half of the pictures specimen: the state and the controls, laid out in a `SceneFrame`, and the scene itself (`lazy.tsx`), which is drawn only when the frame is near the window. The sticker lands in the scene

export function ScenePictureSpecimen() {
  const [width, setWidth] = useState(3.4)
  const [turn, setTurn] = useState(-12)
  const [run, setRun] = useState(0)
  return (
    <SceneFrame
      label="A card table seen from above with a gold sticker that says plus fifteen lying on it, tilted, over a soft dark disc: the sticker drops onto the table and thumps down when it is played again, and its width and its turn can be changed"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => setRun((now) => now + 1)}>
            Land it
          </Button>
          <Knob label="Width" value={width} min={1.5} max={6} step={0.1} onChange={setWidth} />
          <Knob label="Turn (degrees)" value={turn} min={-180} max={180} step={1} onChange={setTurn} />
        </>
      }
    >
      <PictureScene width={width} yaw={(turn * Math.PI) / 180} run={run} />
    </SceneFrame>
  )
}
