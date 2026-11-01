"use client"

import { useState } from "react"

import { Slider } from "@pbgo/ui/platform/slider"

/** A slider with one thumb on a scale of five stops, and what it reads next to it. */
export function SingleSliderSpecimen() {
  const [level, setLevel] = useState(3)
  return (
    <div className="flex max-w-sm items-center gap-6 px-2">
      <Slider min={1} max={5} step={1} value={[level]} onValueChange={([next = 1]) => setLevel(next)} ticks thumbLabels={["Level"]} valueText={(value) => `Level ${value} of 5`} />
      <p className="w-24 shrink-0 text-sm text-muted-foreground">Level {level} of 5</p>
    </div>
  )
}

/** A slider with two thumbs that never meet, on a scale of eleven stops, and the range it reads next to it. */
export function RangeSliderSpecimen() {
  const [range, setRange] = useState<number[]>([20, 70])
  return (
    <div className="flex max-w-sm items-center gap-6 px-2">
      <Slider
        min={0}
        max={100}
        step={10}
        minStepsBetweenThumbs={1}
        value={range}
        onValueChange={setRange}
        ticks
        thumbLabels={["From", "To"]}
      />
      <p className="w-24 shrink-0 text-sm text-muted-foreground">
        {range[0]} to {range[1]}
      </p>
    </div>
  )
}
