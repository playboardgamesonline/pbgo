import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "../utils"

// A strip of figures for the head of a page, on the platform's glass: each figure has its icon, then its label, small and in capitals, over the figure itself, and a figure that is a progress ends with a small bar that says how far it has got. The whole strip is one button, 3rem high on a wide screen like the
// buttons that it stands beside (it wraps into rows, which are as high as they need, on a narrower one): what the figures sum up is what a press opens (`DialogTrigger` takes it as its child), so the figures are drawn in text and nothing but text, which a button may hold. It draws what it is given and writes no figure itself.

type StatStripItem = {
  /** What the figure counts ("Play time"): it is written in capitals by the style, not by the text. */
  label: string
  /** The figure, already written ("38 h", "3/12", "—"). */
  value: React.ReactNode
  icon: IconSvgElement
  /** How far a progress has got, from 0 to 100: a small bar after the figure. None for a figure that is no progress. */
  progress?: number
}

type StatStripProps = Omit<React.ComponentProps<"button">, "children"> & {
  items: readonly StatStripItem[]
}

function StatStrip({ items, className, ...props }: StatStripProps) {
  return (
    <button
      type="button"
      data-slot="stat-strip"
      className={cn(
        "glass flex min-h-12 flex-wrap items-center gap-x-8 gap-y-3 rounded-xl px-5 py-2 text-left ring-1 ring-foreground/10 outline-none transition-shadow hover:ring-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/30 xl:h-12 xl:flex-nowrap xl:py-0",
        className
      )}
      {...props}
    >
      {items.map(({ label, value, icon, progress }) => (
        <span key={label} className="flex min-w-0 items-center gap-2.5">
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs leading-4 tracking-wider text-muted-foreground uppercase">{label}</span>
            <span className="flex items-center gap-2 text-sm leading-5 tabular-nums">
              {value}
              {progress !== undefined && (
                <span aria-hidden="true" className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-foreground/15">
                  <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                </span>
              )}
            </span>
          </span>
        </span>
      ))}
    </button>
  )
}

export { StatStrip }
export type { StatStripItem, StatStripProps }
