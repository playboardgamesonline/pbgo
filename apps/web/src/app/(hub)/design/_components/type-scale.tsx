"use client"

import { Code, Inline } from "./layout"
import { useMeasured } from "./live"

const PROPERTIES = ["font-size", "line-height", "letter-spacing", "font-weight"] as const

/** `22.4px` over `16px` → `1.4`; anything that is not a length (`normal`) is shown as the browser says it. */
export function ratio(value: string, base: string): string {
  const a = parseFloat(value)
  const b = parseFloat(base)
  return Number.isNaN(a) || Number.isNaN(b) || b === 0 ? value : String(Math.round((a / b) * 1000) / 1000)
}

type Row = {
  /** The Tailwind classes of the sample, written out in full so the utilities are generated. */
  className: string
  /** Where the size is used today. */
  use: string
}

const TEXT: readonly Row[] = [
  { className: "text-xs", use: "Badges, tooltips, menu shortcuts" },
  { className: "text-sm", use: "Controls, descriptions, table cells, menu rows" },
  { className: "text-base", use: "Body text, inputs and text areas on mobile" },
  { className: "text-lg", use: "Lead paragraph, game card title" },
]

const HEADINGS: readonly Row[] = [
  { className: "font-heading text-xl", use: "Small headings" },
  { className: "font-heading text-2xl", use: "Hub section headings" },
  { className: "font-heading text-3xl", use: "Page title of a text page, section title; the home's title on a phone" },
  { className: "font-heading text-4xl", use: "A game's page title below `md`, the title of this page" },
  { className: "font-heading text-5xl", use: "The home's title from `sm`, the title of this page from `md`" },
  { className: "font-heading text-6xl", use: "A game's page title from `md`" },
  { className: "font-heading text-7xl", use: "The home's title from `lg`" },
  { className: "font-heading text-8xl", use: "The home's title from `xl`" },
  { className: "page-title", use: "The title of Games, Tables and Tournaments: 8rem from a 850px window, Geist at 720 with a tracking of -6%, one line" },
]

function TypeRow({ className, use }: Row) {
  const { ref, values } = useMeasured(PROPERTIES)
  const [size, leading, tracking, weight] = values
  return (
    <div className="grid gap-x-8 gap-y-3 py-6 first:pt-0 last:pb-0 md:grid-cols-[14rem_1fr]">
      <div className="flex flex-col gap-2">
        <Code className="w-fit">{className}</Code>
        <p className="text-sm text-muted-foreground">
          {size ? (
            <>
              {size} / {ratio(leading, size)} · {ratio(tracking, size)}em · {weight}
            </>
          ) : (
            "…"
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          <Inline>{use}</Inline>
        </p>
      </div>
      <p ref={ref} className={className}>
        Board games online
      </p>
    </div>
  )
}

/** Sizes of the platform: Tailwind's `text-*` with the platform's line-heights, measured on the rendered sample. */
export function TypeScale() {
  return (
    <div className="flex flex-col gap-8">
      <div className="divide-y rounded-3xl border p-6">
        {TEXT.map((row) => (
          <TypeRow key={row.className} {...row} />
        ))}
      </div>
      <div className="divide-y rounded-3xl border p-6">
        {HEADINGS.map((row) => (
          <TypeRow key={row.className} {...row} />
        ))}
      </div>
    </div>
  )
}

function WeightRow({ className, label }: { className: string; label: string }) {
  const { ref, values } = useMeasured(["font-weight"])
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0">
      <p ref={ref} className={`text-lg ${className}`}>
        Board games online
      </p>
      <p className="flex items-center gap-3 text-sm text-muted-foreground">
        <Code>{label}</Code>
        <span className="w-10 text-right font-mono tracking-normal">{values[0] || "…"}</span>
      </p>
    </div>
  )
}

/** Proof that the platform has one weight: every `font-*` utility resolves to 600, so none is ever needed. */
export function WeightProof() {
  return (
    <div className="rounded-3xl border px-6">
      <WeightRow className="font-normal" label="font-normal" />
      <WeightRow className="font-medium" label="font-medium" />
      <WeightRow className="font-semibold" label="font-semibold" />
      <WeightRow className="font-bold" label="font-bold" />
    </div>
  )
}
