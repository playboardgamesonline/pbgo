"use client"

import { useState } from "react"
import { Button } from "@pbgo/ui/platform/button"
import { Code, Inline } from "./layout"
import { Var } from "./live"

type Row = {
  name: string
  variable: string
  /** Each class is written out in full so the utility is generated. */
  track: string
  use: string
}

const ROWS: readonly Row[] = [
  {
    name: "duration-fast",
    variable: "--transition-duration-fast",
    track: "h-6 rounded-full bg-foreground transition-[width] duration-fast ease-standard",
    use: "Overlays fading in and out (dialog, sheet backdrop, dropdown, tooltip)",
  },
  {
    name: "duration-base",
    variable: "--transition-duration-base",
    track: "h-6 rounded-full bg-foreground transition-[width] duration-base ease-standard",
    use: "Default of `transition`, `transition-colors`: hover and focus on controls",
  },
  {
    name: "duration-slow",
    variable: "--transition-duration-slow",
    track: "h-6 rounded-full bg-foreground transition-[width] duration-slow ease-standard",
    use: "Things that travel: a sheet sliding in, the game card art zooming",
  },
]

/** The three durations side by side, on the same easing; the button plays them again. */
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
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2">
                <Code>{row.name}</Code>
                <span className="font-mono text-xs tracking-normal text-muted-foreground">
                  <Var name={row.variable} />
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                <Inline>{row.use}</Inline>
              </p>
            </div>
            <div className="rounded-full bg-muted p-1">
              <div className={`${row.track} ${full ? "w-full" : "w-6"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
