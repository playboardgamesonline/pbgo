import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { ChartColors, LineColors, NeutralRamp, SemanticColors } from "../_components/colors"
import { Block, Bullets, Code, Demo, Inline, Section } from "../_components/layout"
import { MotionDemo } from "../_components/motion-demo"
import { RadiusScale } from "../_components/radius-scale"
import { TokenTable } from "../_components/token-table"
import { TypeScale, WeightProof } from "../_components/type-scale"

const FOREGROUND_NOTE =
  "`card-foreground`, `popover-foreground`, `secondary-foreground` and `accent-foreground` equal `foreground`; `primary-foreground` equals `background`. The pairs exist so a game skin can change one side of a pair without the other."

export function Colors() {
  return (
    <Section
      id="colors"
      intro="Every colour of a platform screen is one of these tokens: a neutral ramp, and `destructive` as the one signal colour. The names are shared with the game layer, so a component never needs to know which layer it is in. The values below are read from this page, not typed."
    >
      <Block title="Surfaces and actions" description={FOREGROUND_NOTE}>
        <SemanticColors />
      </Block>
      <Block
        title="Secondary text, lines and focus"
        description="Borders and field outlines are translucent white, so they follow whatever surface they sit on."
      >
        <LineColors />
      </Block>
      <Block
        title="The neutral ramp"
        description="How the tokens above are built. A component never uses `bg-neutral-*` itself (a test rejects it): it uses the token, so a game skin can change what the token means."
      >
        <NeutralRamp />
      </Block>
      <Block
        title="Chart"
        description="Five greys for the admin charts, read by lightness. There is no hue to tell series apart, so charts label their series."
      >
        <ChartColors />
      </Block>
    </Section>
  )
}

const FONT_ROWS = [
  { variable: "--font-body", utility: "font-sans", use: "Text. Geist Variable on the platform; a game skin sets its own." },
  { variable: "--font-title", utility: "font-heading", use: "Headings and card titles. Same as the body font on the platform." },
  { variable: "--tracking-body", use: "Letter-spacing of the page, set on `.platform`." },
  { variable: "--tracking-tight", utility: "tracking-tight", use: "Letter-spacing of `h1` to `h4`, a bit tighter than the body." },
] as const

export function Typography() {
  return (
    <Section
      id="typography"
      intro="Geist Sans, a variable font loaded through `@fontsource-variable/geist`, in one weight. Line-heights are slightly tight and tighten as the size grows. Letter-spacing is slightly negative. Sizes are Tailwind's `text-*`; the platform changes their line-heights, not their sizes."
    >
      <Block
        title="Scale"
        description="Each sample is measured on this page: size, line-height over size, letter-spacing in em, weight."
      >
        <TypeScale />
      </Block>

      <Block
        title="One weight"
        description="Every `font-*` weight utility resolves to 600, so a platform component never writes one. `font-medium` on a label changes nothing and is a sign the author reached for a value instead of a token."
      >
        <WeightProof />
      </Block>

      <Demo title="Geist" description="The typeface, in the platform's weight and spacing.">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
          <p className="font-heading text-6xl md:text-8xl">Aa</p>
          <div className="flex flex-col gap-2 text-lg">
            <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            <p>abcdefghijklmnopqrstuvwxyz</p>
            <p>0123456789 {"( ) [ ] { } / \\ | @ # & * + - = < > ? ! . , ; :"}</p>
          </div>
        </div>
      </Demo>

      <Block title="Tokens">
        <TokenTable rows={FONT_ROWS} />
      </Block>

      <Demo
        title="Monospace"
        description="`font-mono` is the system monospace stack and is for code and token names only, as on this page. Add `tracking-normal` next to it: the platform's negative letter-spacing cramps a monospace."
        code={`<code className="font-mono text-xs tracking-normal">--radius</code>`}
      >
        <p className="font-mono text-sm tracking-normal">@pbgo/ui/platform/button · --radius · 0.625rem</p>
      </Demo>
    </Section>
  )
}

export function Radius() {
  return (
    <Section
      id="radius"
      intro="One base, `--radius`, and every step of the scale is a multiple of it, so a game skin that sets `--radius` rescales every corner at once. Each box below is measured on this page."
    >
      <RadiusScale />
      <TokenTable
        rows={[{ variable: "--radius", use: "The base of the scale, on `.platform`. A game sets its own on `:root`." }]}
      />
      <Bullets
        items={[
          "Big surfaces are `rounded-4xl` (button, card, dialog, game card); fields and badges are `rounded-3xl`.",
          "A shape nested in another takes a smaller step than its parent.",
          "`rounded-full` is for circles and pills (avatar, switch, progress, tabs).",
          "Never write `rounded-[10px]`: the guard test rejects an arbitrary radius.",
        ]}
      />
    </Section>
  )
}

const LAYOUT_ROWS = [
  { variable: "--gutter", utility: "px-gutter", use: "Side padding of a page, kept thin so the content takes the room. Widens at the `sm` breakpoint." },
  { variable: "--section", utility: "py-section", use: "Vertical space between the sections of a page (`pb-section` between two). Widens at the `sm` breakpoint." },
  { variable: "--container-page", utility: "max-w-page", use: "Width of a page that fills the screen: the hub's list of games, a game's page, the header and the footer. Nearly the whole window, up to this value." },
  { variable: "--container-reading", utility: "max-w-reading", use: "Width of running text, so a line stays readable." },
] as const

export function Layout() {
  return (
    <Section
      id="layout"
      intro="Spacing is Tailwind's own scale (`p-4`, `gap-6`). The platform adds only what a whole page needs: the side gutter, the rhythm between sections, and two widths."
    >
      <TokenTable rows={LAYOUT_ROWS} />

      <Demo
        title="Gutter"
        description="The page content is inset by `px-gutter` on both sides. Resize the window past the `sm` breakpoint and it widens."
        code={`<section className="mx-auto w-full max-w-page px-gutter py-section">…</section>`}
        className="p-0"
      >
        <div className="px-gutter py-6">
          <div className="rounded-2xl bg-muted p-4 text-sm">
            Content, inset by <Code>px-gutter</Code>
          </div>
        </div>
      </Demo>

      <Demo
        title="Widths"
        description="`max-w-page` caps a page. `max-w-reading` caps a block of text inside it. This column is narrower than a real page, so the first bar may fill it."
        code={`<div className="mx-auto max-w-page">
  <p className="max-w-reading">…</p>
</div>`}
      >
        <div className="flex flex-col gap-3">
          <div className="max-w-page rounded-xl bg-muted px-4 py-3 text-sm">
            <Code>max-w-page</Code>
          </div>
          <div className="max-w-reading rounded-xl bg-secondary px-4 py-3 text-sm">
            <Code>max-w-reading</Code>
          </div>
        </div>
      </Demo>
    </Section>
  )
}

export function Depth() {
  return (
    <Section
      id="depth"
      intro="On black, a shadow barely shows, so most depth comes from surface steps (`background`, `card`, `secondary`) and hairlines. Three shadows exist for the three heights a surface can be at. They are drawn on a `muted` stage below, because the page itself is too dark to show them."
    >
      <Demo title="Shadows" className="bg-muted p-8">
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
      </Demo>

      <Demo
        title="Rings"
        description="A hairline ring outlines a surface without adding a border to its box. The focus ring is `ring-3` at 30% of `ring`, plus a `border-ring` edge; components add it on `focus-visible`."
      >
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
      </Demo>

      <Demo
        title="Scrim"
        description="`bg-scrim` dims the page behind a dialog or a sheet. A picture that carries a logo, such as the background of a game card, takes a lighter veil: the same scrim at 40% (`bg-scrim/40`). On this checkerboard the left third is bare, the middle one has the lighter scrim and the right one the full scrim; the pattern comes from the `pattern-checker` utility."
        code={`<div className="absolute inset-0 bg-scrim" />
<div className="absolute inset-0 bg-scrim/40" />`}
      >
        <div className="relative h-32 overflow-hidden rounded-3xl pattern-checker">
          <div className="absolute inset-y-0 left-1/3 w-1/3 bg-scrim/40" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-scrim" />
        </div>
      </Demo>
    </Section>
  )
}

const MOTION_ROWS = [
  { variable: "--transition-duration-fast", utility: "duration-fast", use: "Overlays entering and leaving." },
  { variable: "--transition-duration-base", utility: "duration-base", use: "The default of `transition`: hover and focus." },
  { variable: "--transition-duration-slow", utility: "duration-slow", use: "Things that travel: a sheet, the game card art." },
  { variable: "--ease-standard", utility: "ease-standard", use: "The one easing." },
  { variable: "--default-transition-duration", use: "What `transition` uses when no duration is given: the base duration." },
  { variable: "--default-transition-timing-function", use: "What `transition` uses when no easing is given: the standard easing." },
] as const

export function Motion() {
  return (
    <Section
      id="motion"
      intro="Three durations and one easing. Plain `transition` and `transition-colors` already use the base duration and the standard easing, so most components write neither."
    >
      <Demo title="Durations">
        <MotionDemo />
      </Demo>
      <TokenTable rows={MOTION_ROWS} />
      <Bullets
        items={[
          "With `prefers-reduced-motion: reduce`, the three durations become 0ms: nothing animates, and no component needs to check.",
          "Never write `duration-200`: the guard test rejects a numeric duration.",
        ]}
      />
    </Section>
  )
}

const UTILITIES: readonly { utility: string; does: string; token: string }[] = [
  { utility: "px-gutter, py-section, pb-section", does: "Side padding of a page, rhythm between sections", token: "`--gutter`, `--section`" },
  { utility: "max-w-page, max-w-reading", does: "Width of a page, width of running text", token: "`--container-page`, `--container-reading`" },
  { utility: "shadow-surface, shadow-float, shadow-overlay", does: "The three heights of a surface", token: "`--shadow-*`" },
  { utility: "duration-fast, duration-base, duration-slow", does: "Duration of a transition", token: "`--transition-duration-*`" },
  { utility: "ease-standard", does: "The easing of a transition", token: "`--ease-standard`" },
  { utility: "bg-scrim", does: "Dimming layer behind a dialog or a sheet; at 40% (`bg-scrim/40`), a veil over the background of a game card", token: "`--color-scrim`" },
  { utility: "bg-secondary-hover", does: "Hover state of a `secondary` surface", token: "`secondary` mixed with 8% of `foreground`" },
  { utility: "font-heading", does: "Heading font", token: "`--font-title`" },
  { utility: "pattern-checker", does: "Checkerboard that makes translucency visible", token: "`foreground` at 8%" },
]

export function Utilities() {
  return (
    <Section
      id="utilities"
      intro="Utilities the platform adds on top of Tailwind. Anything else is Tailwind's own scale, read through the tokens above."
    >
      <div className="rounded-3xl border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utility</TableHead>
              <TableHead>Does</TableHead>
              <TableHead>Token</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {UTILITIES.map((row) => (
              <TableRow key={row.utility}>
                <TableCell className="whitespace-normal">
                  <Code>{row.utility}</Code>
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <Inline>{row.does}</Inline>
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <Inline>{row.token}</Inline>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  )
}
