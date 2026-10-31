// The live specimens of the foundations page of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { DURATION, EASE_STANDARD, SPRING_TRAVEL } from "@pbgo/ui/motion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { ChartColors, LineColors, NeutralRamp, SemanticColors } from "./colors"
import { GlassLab } from "./glass-lab"
import { MotionDemo } from "./motion-demo"
import { RadiusScale } from "./radius-scale"
import { Code, Frame } from "./text"
import { TitleMotionLab } from "./title-motion-lab"
import { TokenTable } from "./token-table"
import { TypeScale, WeightProof } from "./type-scale"

const SMOOTHING = [
  { value: 1, label: "1: the arc of a circle" },
  { value: 1.2, label: "1.2: the one in use" },
  { value: 1.5, label: "1.5: squares the corners" },
  { value: 2, label: "2: the squircle" },
] as const

/** The exports of `@pbgo/ui/motion` and the token of the stylesheet each one copies. The values are the imported ones, never typed here. */
const MOTION_EXPORTS = [
  { name: "DURATION.fast", value: `${DURATION.fast} s`, css: "--transition-duration-fast" },
  { name: "DURATION.base", value: `${DURATION.base} s`, css: "--transition-duration-base" },
  { name: "DURATION.slow", value: `${DURATION.slow} s`, css: "--transition-duration-slow" },
  { name: "EASE_STANDARD", value: `[${EASE_STANDARD.join(", ")}]`, css: "--ease-standard" },
  { name: "SPRING_TRAVEL", value: `spring, stiffness ${SPRING_TRAVEL.stiffness}, damping ${SPRING_TRAVEL.damping}`, css: "" },
] as const

function Geist() {
  return (
    <Frame>
      <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
        <p className="font-heading text-6xl md:text-8xl">Aa</p>
        <div className="flex flex-col gap-2 text-lg">
          <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
          <p>abcdefghijklmnopqrstuvwxyz</p>
          <p>0123456789 {"( ) [ ] { } / \\ | @ # & * + - = < > ? ! . , ; :"}</p>
        </div>
      </div>
    </Frame>
  )
}

function Monospace() {
  return (
    <Frame code={`<code className="font-mono text-xs tracking-normal">--radius</code>`}>
      <p className="font-mono text-sm tracking-normal">@pbgo/ui/platform/button · --radius · 0.75rem</p>
    </Frame>
  )
}

function CornerSmoothing() {
  return (
    <Frame className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" code={`.platform {
  --corner-smoothing: 1.2;
}
.platform,
.platform * {
  corner-shape: superellipse(var(--corner-smoothing));
}`}>
      {SMOOTHING.map(({ value, label }) => (
        <div key={value} className="flex flex-col gap-2">
          <div className="h-28 rounded-3xl border bg-card" style={{ "--corner-smoothing": value } as React.CSSProperties} />
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      ))}
    </Frame>
  )
}

function Gutter() {
  return (
    <Frame className="p-0" code={`<section className="mx-auto w-full max-w-page px-gutter py-section">…</section>`}>
      <div className="px-gutter py-6">
        <div className="rounded-2xl bg-muted p-4 text-sm">
          Content, inset by <Code>px-gutter</Code>
        </div>
      </div>
    </Frame>
  )
}

function Widths() {
  return (
    <Frame code={`<div className="mx-auto max-w-page">
  <p className="max-w-reading">…</p>
</div>`}>
      <div className="flex flex-col gap-3">
        <div className="max-w-page rounded-xl bg-muted px-4 py-3 text-sm">
          <Code>max-w-page</Code>
        </div>
        <div className="max-w-reading rounded-xl bg-secondary px-4 py-3 text-sm">
          <Code>max-w-reading</Code>
        </div>
      </div>
    </Frame>
  )
}

function Shadows() {
  return (
    <Frame className="bg-muted p-8">
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-4xl bg-card p-6 shadow-surface">
          <Code className="w-fit">shadow-surface</Code>
          <p className="text-sm text-muted-foreground">At rest: card, game card, switch.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-4xl bg-card p-6 shadow-float">
          <Code className="w-fit">shadow-float</Code>
          <p className="text-sm text-muted-foreground">Lifted: game card on hover, dropdown, select.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-4xl bg-card p-6 shadow-overlay">
          <Code className="w-fit">shadow-overlay</Code>
          <p className="text-sm text-muted-foreground">Over the page: dialog, sheet.</p>
        </div>
      </div>
    </Frame>
  )
}

function Rings() {
  return (
    <Frame>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-4xl bg-card p-6 ring-1 ring-foreground/10">
          <Code className="w-fit">ring-1 ring-foreground/10</Code>
          <p className="text-sm text-muted-foreground">Outline of a surface.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-4xl border border-ring bg-card p-6 ring-3 ring-ring/30">
          <Code className="w-fit">border-ring ring-3 ring-ring/30</Code>
          <p className="text-sm text-muted-foreground">Focus, shown here without focusing anything.</p>
        </div>
      </div>
    </Frame>
  )
}

function Scrim() {
  return (
    <Frame code={`<div className="absolute inset-0 bg-scrim" />`}>
      <div className="relative h-32 overflow-hidden rounded-3xl pattern-checker">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-scrim" />
      </div>
    </Frame>
  )
}

function GlassSettings() {
  return (
    <Frame className="p-0" code={`.platform {
  --card: oklch(0.156 0 0);
  --glass-opacity: 92%;
  --glass-blur: 32px;
  --glass-saturate: 100%;
}`}>
      <GlassLab />
    </Frame>
  )
}

function MotionDurations() {
  return (
    <Frame>
      <MotionDemo />
    </Frame>
  )
}

/** What `@pbgo/ui/motion` exports, with the token of the stylesheet each export copies. */
function MotionJavascript() {
  return (
    <div className="rounded-3xl border p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Export</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>CSS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MOTION_EXPORTS.map((row) => (
            <TableRow key={row.name}>
              <TableCell>
                <Code>{row.name}</Code>
              </TableCell>
              <TableCell className="whitespace-normal font-mono text-xs tracking-normal">{row.value}</TableCell>
              <TableCell className="text-muted-foreground">{row.css ? <Code>{row.css}</Code> : "None"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export const foundationsSpecimens: Specimens = {
  "colors-semantic": SemanticColors,
  "colors-lines": LineColors,
  "colors-neutral-ramp": NeutralRamp,
  "colors-chart": ChartColors,
  "type-scale": TypeScale,
  "type-weights": WeightProof,
  "type-geist": Geist,
  "type-monospace": Monospace,
  "token-table": TokenTable,
  "radius-scale": RadiusScale,
  "corner-smoothing": CornerSmoothing,
  "layout-gutter": Gutter,
  "layout-widths": Widths,
  "depth-shadows": Shadows,
  "depth-rings": Rings,
  "depth-scrim": Scrim,
  "glass-lab": GlassSettings,
  "motion-durations": MotionDurations,
  "motion-javascript": MotionJavascript,
  "title-motion-lab": TitleMotionLab,
}
