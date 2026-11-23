"use client"

import { Button } from "@pbgo/ui/platform/button"
import { useState } from "react"
import { Knob } from "./controls"
import { SceneFrame } from "./frame"
import { StagingScene } from "./lazy"

// The light half of the staging specimen: the state and the controls, laid out in a `SceneFrame`, and the scene itself (`lazy.tsx`), which is drawn only when the frame is near the window. The sequence plays in the scene; the button here starts it again.

export function SceneStagingSpecimen() {
  const [run, setRun] = useState(0)
  const [seconds, setSeconds] = useState(1.1)
  return (
    <SceneFrame
      label="A card table seen from above with four cards in a row. The points of each card come down onto the table in front of it one after the other, then the table goes dark and the words 'Ada wins' come down over it, lit"
      controls={
        <>
          <Button variant="outline" size="sm" onClick={() => setRun((now) => now + 1)}>
            Play it again
          </Button>
          <Knob label="Seconds between steps" value={seconds} min={0.3} max={3} step={0.1} onChange={setSeconds} />
        </>
      }
    >
      <StagingScene run={run} seconds={seconds} />
    </SceneFrame>
  )
}
