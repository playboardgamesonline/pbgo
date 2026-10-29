"use client"

import { Code } from "./layout"
import { useMeasured } from "./live"

type Step = {
  /** Written out in full so the utility is generated. */
  className: string
  formula: string
  usedBy: string
}

const STEPS: readonly Step[] = [
  { className: "rounded-xs", formula: "0.125rem, Tailwind's own", usedBy: "Tooltip, a line" },
  { className: "rounded-sm", formula: "--radius × 0.6", usedBy: "Checkbox" },
  { className: "rounded-md", formula: "--radius × 0.8", usedBy: "Chip: extra small button, badge, key cap, a game's icon of 1.5rem" },
  { className: "rounded-lg", formula: "--radius", usedBy: "Small control: small button, toggle, a tab in a tab bar, what is in a navbar island" },
  { className: "rounded-xl", formula: "--radius × 1.4", usedBy: "Control: button, field, tab bar, chat bubble, a game's icon of 2.5rem" },
  { className: "rounded-2xl", formula: "--radius × 1.8", usedBy: "Large control: navbar island, tab bar of the social panel, a row of a list, a menu item, an alert" },
  { className: "rounded-3xl", formula: "--radius × 2.2", usedBy: "Surface: menu, popover, select, dialog, card, game card, panels" },
  { className: "rounded-4xl", formula: "--radius × 2.6", usedBy: "Nothing: the menus' step is the largest (the guard rejects this one)" },
  { className: "rounded-full", formula: "Circle", usedBy: "The picture of a person and its dot; the track and thumb of a switch, a slider and a progress bar; the home's search bar, for now" },
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
        <p className="text-sm text-muted-foreground">{usedBy}</p>
      </div>
    </div>
  )
}

/** The radius scale: every step is a multiple of `--radius`, measured on the rendered box. */
export function RadiusScale() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step) => (
        <RadiusStep key={step.className} {...step} />
      ))}
    </div>
  )
}
