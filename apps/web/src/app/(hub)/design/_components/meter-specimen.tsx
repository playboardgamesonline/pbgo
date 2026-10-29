"use client"

import { useState } from "react"

import { Meter } from "@pbgo/ui/platform/meter"

/** BoardGameGeek's word for each level of weight, from 1 to 5. */
const NAMES = ["Light", "Medium light", "Medium", "Medium heavy", "Heavy"] as const

/** A `Meter` of five levels with what it is filled up to written next to it: it keeps its pick as long as the page is open. */
export function MeterSpecimen({ clearable = true }: { clearable?: boolean }) {
  const [level, setLevel] = useState<number | null>(3)
  return (
    <div className="flex items-center gap-6 px-2">
      <Meter value={level} clearable={clearable} onValueChange={setLevel} levelLabel={(next) => `Up to ${next} of ${NAMES.length}, ${NAMES[next - 1]?.toLowerCase()}`} />
      <p className="w-40 text-sm text-muted-foreground">{level === null ? "Nothing picked" : `Up to ${level}: ${NAMES[level - 1]?.toLowerCase()}`}</p>
    </div>
  )
}
