"use client"

import { Code } from "./text"
import { useMeasured } from "./live"

/** A measured length as a figure ("31.2"), whatever the browser prints it as. */
function figure(value: string | undefined): string {
  const number = parseFloat(value ?? "")
  return Number.isFinite(number) ? String(Math.round(number * 10) / 10) : "…"
}

type NestProps = {
  /** Written out in full so the utilities are generated. */
  outerClass: string
  innerClass: string
  title: string
  verdict: string
}

/** One container with a box in its corner, and what the browser measured of both: the corner of each and the padding between them. */
function Nest({ outerClass, innerClass, title, verdict }: NestProps) {
  const { ref: outerRef, values: outerValues } = useMeasured(["border-top-left-radius", "padding-top"])
  const { ref: innerRef, values: innerValues } = useMeasured(["border-top-left-radius"])
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div ref={outerRef} className={`border border-input bg-muted ${outerClass}`}>
        <div ref={innerRef} className={`h-24 bg-background ${innerClass}`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm">{title}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Code>{outerClass}</Code>
          <Code>{innerClass}</Code>
        </p>
        <p className="font-mono text-xs tracking-normal text-muted-foreground">
          outer {figure(outerValues[0])} · padding {figure(outerValues[1])} · inner {figure(innerValues[0])}
        </p>
        <p className="text-sm text-muted-foreground">{verdict}</p>
      </div>
    </div>
  )
}

/** A box in the corner of a padded container, with the same corner as the container and then with the container's corner less the padding: the numbers are measured on the rendered boxes. */
export function RadiusNesting() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Nest outerClass="rounded-4xl p-6" innerClass="rounded-4xl" title="Same corner in and out" verdict="The gap between the two corners widens at the corner." />
      <Nest outerClass="nest-4xl/6" innerClass="rounded-nested" title="The container's corner less its padding" verdict="The two corners run parallel: outer = inner + padding." />
    </div>
  )
}

type TileProps = { className: string }

/** One tile and the corner the browser gave it. */
function Tile({ className }: TileProps) {
  const { ref, values } = useMeasured(["border-top-left-radius", "width"])
  return (
    <div className="flex flex-col items-start gap-3">
      <div ref={ref} className={`bg-muted ring-1 ring-foreground/10 ${className}`} />
      <p className="font-mono text-xs tracking-normal text-muted-foreground">
        side {figure(values[1])} · corner {figure(values[0])}
      </p>
    </div>
  )
}

/** The same tile at three sizes: `rounded-tile` keeps its shape. */
export function RadiusTile() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <Tile className="size-10 rounded-tile" />
      <Tile className="size-16 rounded-tile" />
      <Tile className="size-24 rounded-tile" />
    </div>
  )
}
