"use client"

import { Code, Inline } from "./layout"
import { useCssVars } from "./live"

/*
 * Class names are written out in full: Tailwind only generates a utility it finds in the source, so `bg-${name}` would
 * paint nothing. Values are never typed here, they are read back from the browser (`useCssVars`).
 */

const NEUTRAL_STEPS = [
  { step: "50", swatch: "bg-neutral-50" },
  { step: "100", swatch: "bg-neutral-100" },
  { step: "200", swatch: "bg-neutral-200" },
  { step: "300", swatch: "bg-neutral-300" },
  { step: "400", swatch: "bg-neutral-400" },
  { step: "500", swatch: "bg-neutral-500" },
  { step: "600", swatch: "bg-neutral-600" },
  { step: "700", swatch: "bg-neutral-700" },
  { step: "800", swatch: "bg-neutral-800" },
  { step: "900", swatch: "bg-neutral-900" },
  { step: "950", swatch: "bg-neutral-950" },
] as const

type Semantic = {
  token: string
  /** Swatch (`bg-*`), then the text colour that reads on it. */
  swatch: string
  on: string
  role: string
}

const SEMANTIC: readonly Semantic[] = [
  { token: "background", swatch: "bg-background", on: "text-foreground", role: "The page. Set on <html> and on the admin wrapper, never on `.platform` itself." },
  { token: "foreground", swatch: "bg-foreground", on: "text-background", role: "Text and icons on the page." },
  { token: "card", swatch: "bg-card", on: "text-card-foreground", role: "Raised surface: cards, code blocks, the game card." },
  { token: "popover", swatch: "bg-popover", on: "text-popover-foreground", role: "Floating surface: select, dropdown, dialog, sheet, tooltip content." },
  { token: "primary", swatch: "bg-primary", on: "text-primary-foreground", role: "The one emphasis: the default button. White on black, not a hue." },
  { token: "secondary", swatch: "bg-secondary", on: "text-secondary-foreground", role: "Quiet button and badge. `bg-secondary-hover` is its hover step." },
  { token: "muted", swatch: "bg-muted", on: "text-muted-foreground", role: "Wells, skeletons, inline code, the unselected side of a switch." },
  { token: "accent", swatch: "bg-accent", on: "text-accent-foreground", role: "Hover and focus of a menu row or a ghost button." },
  { token: "destructive", swatch: "bg-destructive", on: "text-background", role: "Errors and irreversible actions. The only hue of the platform." },
]

const SECONDARY_TOKENS = [
  { token: "muted-foreground", role: "Secondary text: descriptions, captions, placeholders. `text-muted-foreground`." },
  { token: "border", role: "Hairline between regions. White at 10%: `border`, `divide-*`; `ring-foreground/10` outlines a card." },
  { token: "input", role: "Outline of a field. White at 15%: `border-input`." },
  { token: "ring", role: "Focus: `focus-visible:ring-3 focus-visible:ring-ring/30` with a `focus-visible:border-ring` edge. Also the default outline colour, at 50%." },
] as const

const CHART = [
  { token: "chart-1", swatch: "bg-chart-1" },
  { token: "chart-2", swatch: "bg-chart-2" },
  { token: "chart-3", swatch: "bg-chart-3" },
  { token: "chart-4", swatch: "bg-chart-4" },
  { token: "chart-5", swatch: "bg-chart-5" },
] as const

const SEMANTIC_NAMES = [
  ...SEMANTIC.map((s) => `--${s.token}`),
  ...SECONDARY_TOKENS.map((s) => `--${s.token}`),
  ...CHART.map((s) => `--${s.token}`),
]
const NEUTRAL_NAMES = NEUTRAL_STEPS.map((n) => `--color-neutral-${n.step}`)
const ALL_NAMES = [...NEUTRAL_NAMES, ...SEMANTIC_NAMES]

/** Which neutral steps a semantic token resolves to: the computed strings are equal when `--x: var(--color-neutral-N)`. */
function useNeutralMap() {
  const values = useCssVars(ALL_NAMES)
  const byName = new Map(ALL_NAMES.map((name, i) => [name, values[i]] as const))
  const stepOf = (token: string): string | undefined => {
    const value = byName.get(`--${token}`)
    if (!value) return undefined
    return NEUTRAL_STEPS.find((n) => byName.get(`--color-neutral-${n.step}`) === value)?.step
  }
  return { byName, stepOf }
}

function Value({ children }: { children: string | undefined }) {
  return <span className="font-mono text-xs tracking-normal text-muted-foreground">{children || "…"}</span>
}

/** The semantic palette: each swatch is the token itself, with the neutral step it resolves to and its computed value. */
export function SemanticColors() {
  const { byName, stepOf } = useNeutralMap()
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SEMANTIC.map(({ token, swatch, on, role }) => {
        const step = stepOf(token)
        return (
          <div key={token} className="flex flex-col overflow-hidden rounded-3xl border">
            <div className={`flex h-24 items-end p-4 ${swatch} ${on}`}>
              <span className="font-heading text-lg">{token}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-sm text-muted-foreground">
                <Inline>{role}</Inline>
              </p>
              <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1">
                <Code>{`--${token}`}</Code>
                {step && <Code>{`neutral-${step}`}</Code>}
              </p>
              <Value>{byName.get(`--${token}`)}</Value>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Supporting tokens that are not surfaces: secondary text, borders, the focus ring. */
export function LineColors() {
  const { byName } = useNeutralMap()
  return (
    <ul className="grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2">
      {SECONDARY_TOKENS.map(({ token, role }) => (
        <li key={token} className="flex flex-col gap-2 bg-background p-4">
          <p className="flex flex-wrap items-center gap-2">
            <Code>{`--${token}`}</Code>
            <Value>{byName.get(`--${token}`)}</Value>
          </p>
          <p className="text-sm text-muted-foreground">
            <Inline>{role}</Inline>
          </p>
        </li>
      ))}
    </ul>
  )
}

/** Tailwind's neutral scale (chroma 0) with, under each step, the semantic tokens that point at it. */
export function NeutralRamp() {
  const { byName, stepOf } = useNeutralMap()
  const usedBy = (step: string) => SEMANTIC_NAMES.map((name) => name.slice(2)).filter((token) => stepOf(token) === step)
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {NEUTRAL_STEPS.map(({ step, swatch }) => (
        <div key={step} className="flex flex-col gap-2">
          <div className={`h-16 rounded-2xl border ${swatch}`} />
          <p className="flex flex-col gap-0.5">
            <span className="text-sm">{step}</span>
            <Value>{byName.get(`--color-neutral-${step}`)}</Value>
          </p>
          <p className="text-xs text-muted-foreground">{usedBy(step).join(", ") || "Not used by a token"}</p>
        </div>
      ))}
    </div>
  )
}

/** The five chart steps: a descending grey ramp, so a series reads by lightness and never by hue. */
export function ChartColors() {
  const { byName, stepOf } = useNeutralMap()
  return (
    <div className="grid grid-cols-5 gap-3">
      {CHART.map(({ token, swatch }) => (
        <div key={token} className="flex flex-col gap-2">
          <div className={`h-16 rounded-2xl border ${swatch}`} />
          <p className="flex flex-col gap-0.5">
            <span className="text-sm">{token}</span>
            <Value>{stepOf(token) ? `neutral-${stepOf(token)}` : byName.get(`--${token}`)}</Value>
          </p>
        </div>
      ))}
    </div>
  )
}
