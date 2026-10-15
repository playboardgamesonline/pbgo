import { HudVariables } from "../_components/hud-demo"
import {
  AnnouncementSpecimens,
  ChatSpecimens,
  GameOverSpecimen,
  PrimitivesSpecimen,
  ReplayVotedSpecimen,
  StripSpecimens,
  TakeoverSpecimens,
  ThemePair,
  TickerSpecimens,
} from "../_components/hud-specimens"
import { Block, Bullets, Code, Inline, Section, Snippet } from "../_components/layout"

const SCOPE = [
  "The class `.hud` opens the scope. It sits on the root of `GameHud` (the `<main>` of a table), never on `<html>` and never together with `.platform`.",
  "A game declares an optional `UI_THEME` in its binding. `GameHud` writes its values as `--hud-*` variables inline on its root (`hudStyle()` in `@pbgo/core/lib/ui-theme`), and every in-game component reads only those: one value reaches all of them.",
  "The defaults are black and white and live once, in `@pbgo/ui/styles/hud.css`. A game that declares nothing, `/template`, gets exactly them.",
  "The shared tokens (`--primary`, `--card`, `--background`…) are not remapped: the toolbar, the lobby and the boards keep the look of the game's skin.",
  "Values are CSS strings, so a game points at its own tokens (`\"var(--accent-game)\"`) and its theme follows the skin edited in the admin.",
  "`motion` is the one field that is not a style: `\"calm\"` (default) fades only, `\"lively\"` adds confetti, springs and the emoji burst of the chat. Reduced motion always wins, whatever the game says.",
  "A game never forks a component. A look that these fields cannot reach is a new field here, for every game.",
] as const

const COURTISANS = `// games/courtisans/src/lib/ui-theme.ts
import type { UiTheme } from "@pbgo/core/lib/binding"

export const UI_THEME: UiTheme = {
  accent: "var(--accent-game)",
  onAccent: "var(--surface-dark)",
  surface: "var(--surface-dark)",
  titleFont: "var(--font-accent, var(--font-title))",
  motion: "lively",
}

// games/courtisans/src/index.ts
export { UI_THEME } from "./lib/ui-theme"`

export function HudScope() {
  return (
    <Section
      id="hud"
      intro={
        <>
          <p>
            <Inline>
              The ticker, the announcements, the takeover pill, the chat and the game over are shared by every game, so they have a look of their own:
              a third scope next to the platform and the game theme. Black and white by default, tuned per game by `UI_THEME` in its binding. A game changes values, never components.
            </Inline>
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Code>@pbgo/ui/styles/hud.css</Code>
            <Code>@pbgo/core/components/game/hud-ui</Code>
            <Code>@pbgo/core/lib/ui-theme</Code>
          </p>
        </>
      }
    >
      <Bullets items={SCOPE} />

      <Block
        title="Variables"
        description="The ten variables of the scope with the value the browser computes for them on this page. No game is mounted here, so these are the neutral defaults. A translucent variable is shown over a checkerboard."
      >
        <HudVariables />
      </Block>

      <Block
        title="A game's theme"
        description="Courtisans keeps its identity through the contract: the gold of its banquet on the deep navy of its skin, announcements in its accent font, lively motion. This is the whole of it; the shared components do the rest."
      >
        <Snippet>{COURTISANS}</Snippet>
      </Block>

      <Block
        title="The same components, two themes"
        description="Left, the neutral scope of every game that declares nothing. Right, the same markup under a simulated theme: accent, text on the accent, surface, scrim and title font change, and no component does. The theme is made up for this page."
      >
        <ThemePair />
      </Block>
    </Section>
  )
}

const COMPACT = [
  "The `short` variant (`@media (max-height: 30rem)`) switches to the compact layout. It is keyed on the height of the viewport, not its width: a phone held sideways (844×390) is wide but short.",
  "Compact: the history sits behind a toggle, the chat is folded to an icon, the game-over panel scrolls and loses its footer, and every fixed element keeps clear of the safe-area insets. Announcement titles are sized in `min(rem, vh)`, so they shrink by themselves on a short screen.",
  "The specimens on this page use the same classes, so on a window shorter than 30rem they render compact too (the history toggle is the one thing not drawn).",
  "Under 900 px wide a game page shows the `DesktopOnly` wall unless the game turns it off; the compact layout is what a game that turns it off gets.",
] as const

const MOTION = [
  "CSS transitions use the platform tokens (`duration-fast|base|slow`, `ease-standard`) and stop under `prefers-reduced-motion` (`motion-reduce:transition-none`).",
  "Motion written in JavaScript goes through one hook, `useMotion()` (`@pbgo/core/lib/use-motion`), that answers `\"reduced\"`, `\"calm\"` or `\"lively\"`. `GameHud` also wraps its tree in `MotionConfig` with `reducedMotion=\"user\"`.",
  "Reduced: opacity fades of 150 ms at most. No confetti, no emoji burst, no springs, nothing that loops.",
  "Calm, the default: the fades and short travels of the presets. Lively (`UI_THEME.motion`): confetti on the victory, springs, the emoji burst.",
  "Announcements stay up for the same time whatever the preference, and are spoken through an `aria-live` region. Card and table motion belongs to the game.",
] as const

const PRIMITIVES = `import { HudButton, HudPanel, PlayerDot } from "@pbgo/core/components/game/hud-ui"

<HudPanel className="flex items-center gap-3 rounded-xl p-4">
  <PlayerDot color={color(id)} />
  <HudButton variant="primary">Play again</HudButton>
</HudPanel>`

export function HudParts() {
  return (
    <Section
      id="hud-parts"
      intro={
        <>
          <p>
            <Inline>
              What a table shows over the board, in the order a game goes: the ticker with its strip of pending players, the takeover pill, the announcements, the game over and the chat.
              Panels are translucent, so a checkerboard stands in for the art of the game.
            </Inline>
          </p>
          <p>
            <Inline>
              Each specimen is drawn from the primitives and the class strings of the matching component in `@pbgo/core/components/game`. Those read the game, the skin and the clock, so
              a page of the hub cannot mount them: when one changes, its specimen changes with it. Colors and labels are made up here; a table reads them from the game.
            </Inline>
          </p>
        </>
      }
    >
      <Block title="Primitives" description="Hook-free pieces that every component is made of. A new in-game component starts from them.">
        <PrimitivesSpecimen />
        <Snippet>{PRIMITIVES}</Snippet>
      </Block>

      <Block
        title="Pending players"
        description="When the game waits for several players at once (secret bids, reading the missions), a strip under the ticker's main line lists every seat. Waiting players are at full contrast, the ones who are done are muted with a tick, an absent player is dimmed, and you are marked. Beyond eight seats the strip folds to `n/N ready`, the full list opening on hover or tap. A classic turn has no strip. These strips are the real `PlayersStripView` fed by `pendingSeats()`."
      >
        <StripSpecimens />
      </Block>

      <Block title="Ticker" description="Whose turn it is, a status line, the strip when several players are expected, and the history of the table.">
        <TickerSpecimens />
      </Block>

      <Block
        title="Takeover"
        description="After `settings.turnTimeout` without a move, the present players are offered to play for the absent one. Each votes, and the absent player is played for once every other present member has."
      >
        <TakeoverSpecimens />
      </Block>

      <Block title="Announcements" description="Start, turn and victory are one component with three presets. The title takes the accent and the title font of the theme.">
        <AnnouncementSpecimens />
      </Block>

      <Block
        title="Game over"
        description="A centered table: the winners with the detail of their score, then the ranking. `Hide the scoreboard` sits on top, `Play again` below, as in every game. A tie lists every winner."
      >
        <GameOverSpecimen />
        <ReplayVotedSpecimen />
      </Block>

      <Block
        title="Chat"
        description="Messages fade out above the input and are not stored. Reactions are a short soundboard: in a lively game they burst over the board."
      >
        <ChatSpecimens />
      </Block>

      <Block title="Compact layout">
        <Bullets items={COMPACT} />
      </Block>

      <Block title="Motion and reduced motion">
        <Bullets items={MOTION} />
      </Block>
    </Section>
  )
}
