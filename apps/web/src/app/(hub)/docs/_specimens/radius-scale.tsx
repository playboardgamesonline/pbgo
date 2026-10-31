"use client"

import { Code } from "./text"
import { useMeasured } from "./live"

type Step = {
  /** Written out in full so the utility is generated. */
  className: string
  formula: string
  /** Where the step is used, for a step that the table of roles on the page does not cover. */
  usedBy?: string
}

const STEPS: readonly Step[] = [
  { className: "rounded-xs", formula: "0.125rem, Tailwind's own", usedBy: "Tooltip, a line" },
  { className: "rounded-sm", formula: "--radius × 0.6" },
  { className: "rounded-md", formula: "--radius × 0.8" },
  { className: "rounded-lg", formula: "--radius" },
  { className: "rounded-xl", formula: "--radius × 1.4" },
  { className: "rounded-2xl", formula: "--radius × 1.8" },
  { className: "rounded-3xl", formula: "--radius × 2.2" },
  { className: "rounded-4xl", formula: "--radius × 2.6" },
  { className: "rounded-full", formula: "Circle" },
]

/** `border-top-left-radius` of a circle is a huge number of pixels: call it what it is. */
function readable(radius: string): string {
  return parseFloat(radius) > 1000 ? "full" : radius
}

function RadiusStep({ className, formula, usedBy }: Step) {
  const { ref, values } = useMeasured(["border-top-left-radius"])
  return (
    <div className="flex flex-col gap-3 rounded-3xl border p-4">
      <div ref={ref} className={`h-20 border border-input bg-muted ${className}`} />
      <div className="flex flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-2">
          <Code>{className}</Code>
          <span className="font-mono text-xs tracking-normal text-muted-foreground">
            {values[0] ? readable(values[0]) : "…"}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">{formula}</p>
        {usedBy && <p className="text-sm text-muted-foreground">{usedBy}</p>}
      </div>
    </div>
  )
}

/** The radius scale: every step is a multiple of `--radius`, measured on the rendered box. Which step a thing takes is the table of roles under it. */
export function RadiusScale() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step) => (
        <RadiusStep key={step.className} {...step} />
      ))}
    </div>
  )
}
