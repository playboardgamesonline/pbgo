"use client"

import { HUD_TEXT, HUD_TITLE } from "@pbgo/core/components/game/hud-ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { cn } from "@pbgo/ui/utils"
import { Code, Inline } from "./layout"
import { useMeasured } from "./live"

type Variable = {
  /** The CSS variable of `.hud`. Its value is read from the rendered scope below, never typed here. */
  variable: string
  /** A color (the class is written out in full so Tailwind generates it) or the type of text it sets. */
  sample: { kind: "color"; className: string } | { kind: "text" } | { kind: "title" }
  /** The `UiTheme` field of a game's binding that sets it; none: the same for every game. */
  field?: string
  use: string
}

const VARIABLES: readonly Variable[] = [
  { variable: "--hud-surface", sample: { kind: "color", className: "bg-hud-surface" }, field: "surface", use: "Panels: ticker, takeover pill, chat, game-over card." },
  { variable: "--hud-raised", sample: { kind: "color", className: "bg-hud-raised" }, use: "The surface lifted by 8% of the foreground: hover state of a floating control." },
  { variable: "--hud-foreground", sample: { kind: "color", className: "bg-hud-foreground" }, use: "Text on a panel." },
  { variable: "--hud-muted", sample: { kind: "color", className: "bg-hud-muted" }, use: "Secondary text: the status line, ranks, a seat that is done." },
  { variable: "--hud-border", sample: { kind: "color", className: "bg-hud-border" }, use: "The hairline of every panel and separator." },
  { variable: "--hud-accent", sample: { kind: "color", className: "bg-hud-accent" }, field: "accent", use: "The one action of a screen, announcement titles, the winner's points." },
  { variable: "--hud-on-accent", sample: { kind: "color", className: "bg-hud-on-accent" }, field: "onAccent", use: "Text on the accent." },
  { variable: "--hud-backdrop", sample: { kind: "color", className: "bg-hud-backdrop" }, field: "backdrop", use: "Scrim behind an announcement and behind the game over." },
  { variable: "--hud-font", sample: { kind: "text" }, use: "Every text of the in-game UI." },
  { variable: "--hud-title-font", sample: { kind: "title" }, field: "titleFont", use: "Announcement titles and the winner's name." },
]

const NAMES = VARIABLES.map((row) => row.variable)

function Sample({ sample }: { sample: Variable["sample"] }) {
  if (sample.kind !== "color") return <span className={cn(sample.kind === "title" ? HUD_TITLE : HUD_TEXT, "text-xl")}>Aa</span>
  // The hairline and the scrim are translucent: they only read over a checkerboard
  return (
    <span className="block h-8 w-16 overflow-hidden rounded-md border pattern-checker">
      <span className={cn("block size-full", sample.className)} />
    </span>
  )
}

/**
 * The variables of the `.hud` scope with the value the browser computes for them on this page: the neutral defaults of
 * `hud.css` (this page has no game, so no `UI_THEME` on top). The wrapper carries the class `.hud`, as the root of `GameHud` does.
 */
export function HudVariables() {
  const { ref, values } = useMeasured(NAMES)
  return (
    <div ref={ref} className="hud rounded-3xl border p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variable</TableHead>
            <TableHead>Sample</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Use</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {VARIABLES.map((row, index) => (
            <TableRow key={row.variable}>
              <TableCell>
                <div className="flex flex-col items-start gap-1.5">
                  <Code>{row.variable}</Code>
                  <span className="text-xs text-muted-foreground">
                    {row.field ? (
                      <>
                        Set by <Code>{`UI_THEME.${row.field}`}</Code>
                      </>
                    ) : (
                      "Same for every game"
                    )}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Sample sample={row.sample} />
              </TableCell>
              <TableCell className="max-w-64 whitespace-normal break-words font-mono text-xs tracking-normal">
                {values[index]?.trim() || "…"}
              </TableCell>
              <TableCell className="min-w-56 whitespace-normal text-muted-foreground">
                <Inline>{row.use}</Inline>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
