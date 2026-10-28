"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"
import { cn } from "../utils"

// A slider for a value, or a range, along a scale: a track, a fill between the thumbs (from the start when there is one) and, for a scale of a few
// stops, a dot on the track at each. Radix keeps a thumb inside the slider by shifting it half its own width, which it has to measure, so a thumb
// that is drawn at its full size sits somewhere else on the server than in the browser. The thumb here has no size (`size-0`): there is nothing to
// measure and nothing to shift, and its centre is exactly where the fill, the dots and the pointer put it. The round handle is drawn around that
// centre by its `::before`, and the larger target of a finger by its `::after`. The handles stick out of the track by half their width at each
// end: leave that room around the slider (a margin of half a handle, `mx-2`, keeps them off what stands beside it).

const THUMB =
  "relative block size-0 outline-none " +
  "before:absolute before:top-1/2 before:left-1/2 before:size-4 before:-translate-1/2 before:rounded-full before:border-2 before:border-primary before:bg-background before:shadow-surface before:ring-ring/30 before:transition-shadow group-data-[idle]/slider:before:border-muted-foreground " +
  "after:absolute after:top-1/2 after:left-1/2 after:size-8 after:-translate-1/2 after:rounded-full " +
  "hover:before:ring-4 focus-visible:before:ring-4 focus-visible:before:ring-ring/60"

type SliderProps = Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "children"> & {
  /** What a screen reader calls each thumb, in the order of the thumbs: "Shortest", "Longest". Radix says "Minimum" and "Maximum" for a pair without it. */
  thumbLabels?: readonly string[]
  /** What a screen reader hears for the value of a thumb, where the number alone says too little: a position on a scale is not the time it stands for. */
  valueText?: (value: number, thumb: number) => string
  /** A dot on the track at each step: for a scale of a few stops, where the thumbs jump from one to the next. */
  ticks?: boolean
  /** Nothing is picked: the fill is dimmed. */
  idle?: boolean
}

/**
 * One thumb, or more: as many as the `value` (or the `defaultValue`) has numbers. The fill is `bg-primary` between the thumbs, and from the start
 * with a single one. It is `touch-none`, so a finger drags a thumb instead of scrolling the page.
 */
function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  thumbLabels,
  valueText,
  ticks = false,
  idle = false,
  ...props
}: SliderProps) {
  const values = value ?? defaultValue ?? [min]
  const stops = Math.max(1, Math.round((max - min) / step))
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      data-idle={idle ? "" : undefined}
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      step={step}
      className={cn("group/slider relative flex h-6 w-full touch-none items-center select-none data-disabled:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1.5 w-full grow rounded-full bg-muted">
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full rounded-full bg-primary transition-colors group-data-[idle]/slider:bg-muted-foreground/30"
        />
        {ticks &&
          Array.from({ length: stops + 1 }, (_, index) => (
            <span
              key={index}
              data-slot="slider-tick"
              aria-hidden="true"
              className="absolute top-1/2 size-1 -translate-1/2 rounded-full bg-background/70"
              style={{ left: `${(index / stops) * 100}%` }}
            />
          ))}
      </SliderPrimitive.Track>
      {values.map((thumb, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={thumbLabels?.[index]}
          aria-valuetext={valueText?.(thumb, index)}
          className={THUMB}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
