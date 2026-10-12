import type { CSSProperties } from "react"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Input } from "@pbgo/ui/platform/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { Block, Bullets, Inline, Section, Snippet } from "../_components/layout"

const PRINCIPLES = [
  "Black and white: the palette is the `neutral` scale plus `destructive`. No accent colour, no gradient.",
  "Dark only. The platform has no light theme and no `dark:` variants; `color-scheme` is `dark`.",
  "One typeface, Geist, in one weight: everything is semibold (600). `font-medium` and `font-bold` resolve to the same weight, so do not write them. Text is slightly tight: about -0.01em on body text, -0.03em on headings.",
  "Game art is the only colour on the platform. Never tint, overlay or recolour it.",
  "Depth comes from surface steps and hairlines (`ring-1 ring-foreground/10`), then from three shadows: `shadow-surface` at rest, `shadow-float` when lifted, `shadow-overlay` for dialogs and sheets.",
  "Tokens, not values: no hex, `rgb()`, arbitrary pixel sizes, font names or `bg-neutral-*` in platform UI. Write `bg-card`, `text-muted-foreground`, `rounded-3xl`, `px-gutter`.",
  "A missing piece goes into `@pbgo/ui` first, is shown on this page, then is used.",
  "Out of scope for v1: brand fonts, gradients, a light theme and game boards.",
] as const

const WHERE: readonly { what: string; where: string }[] = [
  { what: "Tokens and the boundary between the layers", where: "`packages/ui/src/styles/platform.css`" },
  { what: "Components", where: "`packages/ui/src/platform/<name>.tsx`, imported as `@pbgo/ui/platform/<name>`" },
  { what: "Class names", where: "`cn()` from `@pbgo/ui/utils`" },
  { what: "Colour of the browser chrome", where: "`PLATFORM_THEME_COLOR` from `@pbgo/ui/theme`" },
  { what: "Guards", where: "`packages/ui/src/platform.test.ts` (no hard-coded colour, weight, shadow, duration or radius in a component), `theme.test.ts` (browser colour = `--background`)" },
  { what: "This page", where: "`apps/web/src/app/(hub)/design`" },
  { what: "The rule", where: "`CLAUDE.md`, section Design system (`@pbgo/ui`)" },
]

const DO = `import { Button } from "@pbgo/ui/platform/button"

<Button variant="outline">Join the table</Button>`

const DONT = `<button className="bg-[#111] text-[13px] font-medium rounded-[10px]">
  Join the table
</button>`

export function Principles() {
  return (
    <Section
      id="principles"
      intro="The platform (hub, account, legal, admin, 404) is black and white, dark only, set in Geist semibold. Everything on it is built from the tokens and components of `@pbgo/ui`. The only colour on a platform screen is a game's own art."
    >
      <Bullets items={PRINCIPLES} />

      <Block title="Where things live">
        <div className="rounded-3xl border p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>What</TableHead>
                <TableHead>Where</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {WHERE.map((row) => (
                <TableRow key={row.what}>
                  <TableCell className="whitespace-normal">{row.what}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    <Inline>{row.where}</Inline>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Block>

      <div className="flex flex-col gap-6">
        <Block title="Do" description="A component of `@pbgo/ui`, with its variant.">
          <Snippet>{DO}</Snippet>
        </Block>
        <Block title="Do not" description="A one-off element with its own colour, size, weight and radius.">
          <Snippet>{DONT}</Snippet>
        </Block>
      </div>
    </Section>
  )
}

/*
 * A deliberate illustration of the game layer, the only place of this page that names a colour or a font: a real skin
 * sets these same names on <html> (`themeStyle()` in `@pbgo/core/lib/settings` from the game's Sanity settings, and the
 * `:root` of `packages/core/styles/game.css`). The values are made up and exist on this page only.
 */
const SIMULATED_SKIN = {
  "--primary": "oklch(0.78 0.14 75)",
  "--primary-foreground": "oklch(0.2 0.03 75)",
  "--radius": "0.25rem",
  "--font-body": "Georgia, serif",
} as CSSProperties

const SKIN_SNIPPET = `/* A game restyles by changing the value of a token. No component is touched. */
:root {
  --primary: var(--accent-game);
  --radius: 0.75rem;
  --font-body: "Alegreya Variable", Georgia, serif;
}`

const COMPARISON: readonly { row: string; platform: string; game: string }[] = [
  { row: "Used by", platform: "Hub, `/design`, legal, 404, the admin of every game", game: "A game's own pages: home, lobby, table, board" },
  { row: "Components", platform: "`@pbgo/ui/platform/*`", game: "`@pbgo/ui/game/*`" },
  { row: "Token values", platform: "`packages/ui/src/styles/platform.css`, scoped to `.platform`", game: "`:root` of `packages/core/styles/game.css` and the game's stylesheet, overridden by its Sanity skin" },
  { row: "Who changes them", platform: "The design system: a pull request on `packages/ui`", game: "The game: its admin (Visual, Copy) through `themeStyle()`" },
  { row: "Theme", platform: "Black and white, dark only", game: "Whatever the game's skin says" },
  { row: "`platform` class", platform: "On `<html>` (hub, 404), on the admin wrapper, on the root of every portal", game: "Never" },
]

const BOUNDARY = [
  "The platform sets its values on `.platform`, never on `:root`. A game sets its values on `:root`, never on `.platform`. The two never mix, even on a game page that hosts the admin.",
  "A component reads tokens and never names a colour, a font or a size of its own. That is what lets a game restyle everything by changing values.",
  "`@theme` in `platform.css` only defines new names (`shadow-surface`, `duration-fast`, `bg-scrim`). A name Tailwind already has gets its platform value inside `.platform`, or every game would inherit it from `:root`.",
  "Portals (select, dropdown, dialog, sheet, tooltip, toast) render outside the wrapper that carries `platform`, so their root carries the class itself. The platform components do it already.",
  "`.platform` carries no background: a portal would paint it. `<html>` and the admin wrapper add `bg-background` themselves.",
] as const

function Specimen() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a table</CardTitle>
        <CardDescription>Two to five players, about 30 minutes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input placeholder="Your nickname" aria-label="Nickname" />
        <div className="flex gap-2">
          <Button>Create</Button>
          <Button variant="outline">Join</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function Layers() {
  return (
    <Section
      id="layers"
      intro="Two layers share the same token names (`--background`, `--primary`, `--radius`, `--font-body`…). The platform layer is this page. The game layer is what a game's pages use, and a game overrides it at runtime through its Sanity skin. Same names, different values."
    >
      <div className="rounded-3xl border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Platform layer</TableHead>
              <TableHead>Game layer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPARISON.map((row) => (
              <TableRow key={row.row}>
                <TableCell>
                  <Inline>{row.row}</Inline>
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <Inline>{row.platform}</Inline>
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <Inline>{row.game}</Inline>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Block title="Rules of the boundary">
        <Bullets items={BOUNDARY} />
      </Block>

      <Block
        title="The same specimen in both layers"
        description="Left, the platform. Right, the same components with four tokens overridden, as a game skin would: `--primary`, `--primary-foreground`, `--radius` and `--font-body`. Colour, radius and font change, no component does. This is a simulation for this page; a real skin sets the names on `<html>`."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Platform</p>
            <Specimen />
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Simulated game skin</p>
            {/* `font-sans` makes the font re-resolve here: `font-family` inherits as a computed value */}
            <div style={SIMULATED_SKIN} className="font-sans">
              <Specimen />
            </div>
          </div>
        </div>
        <Snippet>{SKIN_SNIPPET}</Snippet>
      </Block>
    </Section>
  )
}
