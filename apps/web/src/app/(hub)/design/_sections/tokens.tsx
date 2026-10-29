import { DURATION, EASE_STANDARD, SPRING_TRAVEL } from "@pbgo/ui/motion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { ChartColors, LineColors, NeutralRamp, SemanticColors } from "../_components/colors"
import { Block, Bullets, Code, Demo, Inline, Section } from "../_components/layout"
import { MotionDemo } from "../_components/motion-demo"
import { RadiusPresets } from "../_components/radius-presets"
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
  { variable: "--text-display", utility: "text-display", use: "The three lines of the home's title, as big as the window lets them be (7.7vw and half a rem, up to 7.5rem): the first line takes 71% of a 390 px window and 60% of a 1440 px one. The lines are not the same width on purpose: the title narrows as it goes down. It sets no line-height: `display-title` does." },
] as const

export function Typography() {
  return (
    <Section
      id="typography"
      intro="Geist Sans, a variable font loaded through `@fontsource-variable/geist`, in one weight. Line-heights are slightly tight and tighten as the size grows. Letter-spacing is slightly negative. Sizes are Tailwind's `text-*`; the platform changes their line-heights, not their sizes. One exception: the home's title has one word that changes between four display faces (see Face cycle)."
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

const RADIUS_ROLES = [
  { role: "Surface", height: "A container, from 6rem high", utility: "rounded-4xl", radius: "31px", examples: "Menu, popover, select, dialog, panels (friends, social, chat), card, game card and its picture, cookie banner, login card, an empty state" },
  { role: "Bar", height: "4rem to 6rem", utility: "rounded-3xl", radius: "26px", examples: "The home's search bar: at the surfaces' step, half its height would make it a pill" },
  { role: "Large control, island", height: "3rem to 3.5rem", utility: "rounded-2xl", radius: "22px", examples: "Navbar island, tab bar of the social panel, a row of a list, a menu item, an alert" },
  { role: "Control", height: "2.25rem to 2.5rem", utility: "rounded-xl", radius: "17px", examples: "Button, field (input, text area, select trigger, input group), tab bar, a tab of the social panel, a chat bubble, a game's icon of 2.5rem" },
  { role: "Small control", height: "2rem", utility: "rounded-lg", radius: "12px", examples: "Small button, toggle, a tab in a tab bar, the buttons and tabs inside a navbar island" },
  { role: "Chip", height: "1.25rem to 1.5rem", utility: "rounded-md", radius: "10px", examples: "Extra small button, badge, key cap, a game's icon of 1.5rem" },
  { role: "Circle", height: "Only a person", utility: "rounded-full", radius: "full", examples: "The picture of a person (`Avatar`) and its dot; the track and the thumb of a switch, a slider and a progress bar" },
] as const

const SMOOTHING = [
  { value: 1, label: "1: the arc of a circle" },
  { value: 1.2, label: "1.2: the one in use" },
  { value: 1.5, label: "1.5: the one before, which squared the corners" },
  { value: 2, label: "2: the squircle" },
] as const

export function Radius() {
  return (
    <Section
      id="radius"
      intro="One family of corners, taken from the menus: the taller the box, the rounder its corner, up to `rounded-4xl` (31px) for a surface and `rounded-2xl` for the rows in it. One base, `--radius`, and every step of the scale is a multiple of it, so a game skin that sets `--radius` rescales every corner at once. Each box below is measured on this page."
    >
      <RadiusScale />
      <TokenTable
        rows={[
          { variable: "--radius", use: "The base of the scale, on `.platform`. A game sets its own on `:root`." },
          { variable: "--corner-smoothing", use: "The exponent of the curve of every rounded corner (`corner-shape: superellipse()`), on `.platform`: 1 is the arc of a circle, 2 the squircle. 1.2, a touch." },
        ]}
      />
      <Block
        title="Which radius"
        description="A corner is rounded by about a third of the height of what it rounds, and never by half of it, so that nothing is a capsule. Pick the step by the height: the taller the container, the rounder its corner, up to `rounded-4xl` for one from 6rem high."
      >
        <div className="overflow-hidden rounded-3xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Height</TableHead>
                <TableHead>Utility</TableHead>
                <TableHead>Used by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RADIUS_ROLES.map((row) => (
                <TableRow key={row.utility}>
                  <TableCell>{row.role}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{row.height}</TableCell>
                  <TableCell>
                    <Inline>{`${row.utility} · ${row.radius}`}</Inline>
                  </TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{row.examples}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Block>
      <Bullets
        items={[
          "The reference is the menus, rounder than they were: a container from 6rem high is `rounded-4xl`, the largest step, and nothing is rounder. A bar of 4rem (the search bar) is `rounded-3xl`, since at `rounded-4xl` it would be a pill.",
          "Only the picture of a person is a circle (`rounded-full`: `Avatar` and its dot). A game, its icon and its card are rounded like anything else, never a circle.",
          "What sits in a padded container takes the container's radius less its padding: a navbar island is 22px with 8px of padding, so what is in it is 12px (`rounded-lg`, the nearest step).",
          "Never write `rounded-[10px]`: the guard test rejects an arbitrary radius.",
          "The home's search bar is `rounded-3xl` (64px high with 8px of padding), not a pill: what is in it takes its radius less the padding, so its category button is 17px (`rounded-xl`).",
        ]}
      />
      <Demo
        title="How round"
        description="The same components under three bases. `--radius` is the one knob: every step is a multiple of it. 12px is the one in use; at 14px a button of 2.25rem is a capsule, which is the one thing a corner must not be."
        code={`.platform {
  --radius: 0.75rem;
}`}
      >
        <RadiusPresets />
      </Demo>
      <Demo
        title="Corner smoothing"
        description="Every corner is a superellipse, not an arc of a circle, the way iOS draws its continuous corners (`corner-shape`, in Chromium; elsewhere the plain arc stays). Each box has the same `rounded-3xl`; only the exponent changes, and a `rounded-full` always keeps its arc."
        code={`.platform {
  --corner-smoothing: 1.2;
}
.platform,
.platform * {
  corner-shape: superellipse(var(--corner-smoothing));
}`}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {SMOOTHING.map(({ value, label }) => (
          <div key={value} className="flex flex-col gap-2">
            <div className="h-28 rounded-3xl border bg-card" style={{ "--corner-smoothing": value } as React.CSSProperties} />
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </Demo>
    </Section>
  )
}

const LAYOUT_ROWS = [
  { variable: "--gutter", utility: "px-gutter", use: "Side padding of a page: 1rem on a phone, 1.5rem from the `sm` breakpoint and 4rem (64px) from `lg`, so a desktop keeps a small margin on each side." },
  { variable: "--section", utility: "py-section", use: "Vertical space between the sections of a page (`pb-section` between two). Widens at the `sm` breakpoint." },
  { variable: "--container-page", utility: "max-w-page", use: "Width of a page that keeps a limit on a wide screen: a game's page, the pages of the tabs, the centred header of a list. Nearly the whole window, up to this value. The hub's lists of games (the home's sections, `/games`) have none: they take the whole window." },
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
        description="The page content is inset by `px-gutter` on both sides. Resize the window past the `sm` breakpoint, then past `lg`, and it widens."
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
        description="`bg-scrim` dims the page behind a dialog or a sheet. Game art is never dimmed with it: a picture shows as it is. On this checkerboard the left half is bare and the right half has the scrim; the pattern comes from the `pattern-checker` utility."
        code={`<div className="absolute inset-0 bg-scrim" />`}
      >
        <div className="relative h-32 overflow-hidden rounded-3xl pattern-checker">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-scrim" />
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
      intro="Three durations, one easing and one spring. Plain `transition` and `transition-colors` already use the base duration and the standard easing, so most components write neither. What CSS cannot do, a layout animation or a sequence, is done with `motion/react` (motion.dev) and reads the same numbers."
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

      <Block
        title="In JavaScript"
        description="`@pbgo/ui/motion` copies the three durations and the easing of the stylesheet in the units that `motion/react` takes (seconds, and a bezier as four numbers), and `motion.test.ts` reads `platform.css` and fails when a copy has drifted. The values below are imported from it, not typed here."
      >
        <div className="rounded-3xl border p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Export</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>CSS</TableHead>
                <TableHead>Use</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: "DURATION.fast", value: `${DURATION.fast} s`, css: "--transition-duration-fast", use: "Overlays entering and leaving." },
                { name: "DURATION.base", value: `${DURATION.base} s`, css: "--transition-duration-base", use: "Hover and focus: what `transition` uses." },
                { name: "DURATION.slow", value: `${DURATION.slow} s`, css: "--transition-duration-slow", use: "Things that travel; the word of the home's title fading out and in." },
                { name: "EASE_STANDARD", value: `[${EASE_STANDARD.join(", ")}]`, css: "--ease-standard", use: "The one easing, quick to leave and slow to settle: cubic-bezier(0.2, 0, 0, 1). The games' UI uses it too." },
                { name: "SPRING_TRAVEL", value: `spring, stiffness ${SPRING_TRAVEL.stiffness}, damping ${SPRING_TRAVEL.damping}`, css: "", use: "Something that moves to a place it was not, and has to feel attached to the hand that asked: the fill that glides between the tabs of the navbar. Stiff, no overshoot worth seeing, settled in about a quarter of a second." },
              ].map((row) => (
                <TableRow key={row.name}>
                  <TableCell>
                    <Code>{row.name}</Code>
                  </TableCell>
                  <TableCell className="whitespace-normal font-mono text-xs tracking-normal">{row.value}</TableCell>
                  <TableCell>{row.css && <Code>{row.css}</Code>}</TableCell>
                  <TableCell className="min-w-56 whitespace-normal text-muted-foreground">
                    <Inline>{row.use}</Inline>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Block>

      <Bullets
        items={[
          "The platform moves in JavaScript in two places: the fill behind the current item of the navbar (`layoutId`, `SPRING_TRAVEL`) and the word of the home's title that changes face (`FaceCycle`: out and in with `DURATION.slow` and `EASE_STANDARD`, the rest of its line gliding). Everything else is a CSS transition.",
          "An animation answers an action (a click, a hover) or says that something changed. Use the tokens, never a duration or an easing written in a component, and reach for `motion` only for a layout animation, a sequence or a spring.",
          "Less motion is honoured everywhere: in CSS the durations become 0ms, in JavaScript `Navbar` mounts `MotionConfig reducedMotion=user` (the fill jumps) and `FaceCycle` does not rotate at all, since an animation that starts by itself is the one a visitor who asks for less motion must never get.",
          "The games' UI shares the curve, not the durations: it has its own timings, tuned by the game's `UI_THEME` (`docs/game-ui.md`).",
        ]}
      />
    </Section>
  )
}

const UTILITIES: readonly { utility: string; does: string; token: string }[] = [
  { utility: "px-gutter, py-section, pb-section", does: "Side padding of a page, rhythm between sections", token: "`--gutter`, `--section`" },
  { utility: "max-w-page, max-w-reading", does: "Width of a page, width of running text", token: "`--container-page`, `--container-reading`" },
  { utility: "shadow-surface, shadow-float, shadow-overlay", does: "The three heights of a surface", token: "`--shadow-*`" },
  { utility: "display-title", does: "The home's title: Geist Black, capitals and tight, fading out downwards, with `text-display`", token: "`--text-display`" },
  { utility: "fine-print", does: "The finest print of a page: the footer's line on what the site is not", token: "`--text-xs`, `--foreground`" },
  { utility: "duration-fast, duration-base, duration-slow", does: "Duration of a transition", token: "`--transition-duration-*`" },
  { utility: "ease-standard", does: "The easing of a transition", token: "`--ease-standard`" },
  { utility: "bg-scrim", does: "Dimming layer behind a dialog or a sheet", token: "`--color-scrim`" },
  { utility: "bg-secondary-hover", does: "Hover state of a `secondary` surface", token: "`secondary` mixed with 8% of `foreground`" },
  { utility: "font-heading", does: "Heading font", token: "`--font-title`" },
  { utility: "pattern-checker", does: "Checkerboard that makes translucency visible", token: "`foreground` at 8%" },
  { utility: "pattern-grid", does: "A grid of thin lines, 3rem apart, in a faint `foreground`: the home's hero had it, and has not for now", token: "`--foreground`, `--spacing`" },
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
