"use client"

import { useState } from "react"
import { Button } from "@pbgo/ui/platform/button"
import { Code } from "./text"
import { Var } from "./live"

type Row = {
  name: string
  variable: string
  /** Each class is written out in full so the utility is generated. */
  track: string
}

const ROWS: readonly Row[] = [
  {
    name: "duration-fast",
    variable: "--transition-duration-fast",
    track: "h-6 rounded-full bg-foreground transition-[width] duration-fast ease-standard",
  },
  {
    name: "duration-base",
    variable: "--transition-duration-base",
    track: "h-6 rounded-full bg-foreground transition-[width] duration-base ease-standard",
  },
  {
    name: "duration-slow",
    variable: "--transition-duration-slow",
    track: "h-6 rounded-full bg-foreground transition-[width] duration-slow ease-standard",
  },
]

/** The three durations side by side, on the same easing; the button plays them again. What each is for is the table under it. */
export function MotionDemo() {
  const [full, setFull] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" onClick={() => setFull((value) => !value)}>
          Play
        </Button>
        <p className="text-sm text-muted-foreground">
          Easing <Code>ease-standard</Code>{" "}
          <Code>
            <Var name="--ease-standard" />
          </Code>
        </p>
      </div>
      <div className="flex flex-col gap-5">
        {ROWS.map((row) => (
          <div key={row.name} className="grid gap-x-8 gap-y-2 md:grid-cols-[14rem_1fr] md:items-center">
            <p className="flex items-center gap-2">
              <Code>{row.name}</Code>
              <span className="font-mono text-xs tracking-normal text-muted-foreground">
                <Var name={row.variable} />
              </span>
            </p>
            <div className="rounded-full bg-muted p-1">
              <div className={`${row.track} ${full ? "w-full" : "w-6"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
