import { CrownIcon, LinkForwardIcon, Sent02Icon, SmileIcon, Tick02Icon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Fragment, type CSSProperties, type ReactNode } from "react"
import { HUD_PANEL, HUD_TEXT, HUD_TITLE, HUD_TRANSITION, HudButton, HudPanel, PlayerDot, readableColor } from "@pbgo/core/components/game/hud-ui"
import { PlayersStripView, type StripData, type StripLabels } from "@pbgo/core/components/game/players-strip-view"
import type { UiTheme } from "@pbgo/core/lib/binding"
import { pendingSeats } from "@pbgo/core/lib/pending-seats"
import { hudStyle } from "@pbgo/core/lib/ui-theme"
import { cn } from "@pbgo/ui/utils"

/*
 * The in-game UI as it renders in a game, drawn from the same primitives (`hud-ui.tsx`, `PlayersStripView`) and the same class
 * strings as the components of `@pbgo/core/components/game`. Those read the game (`useGame()`), the skin and the clock, so a page
 * of the hub cannot mount them: each specimen below mirrors one of them, without the logic. When a component of the in-game UI
 * changes, change its specimen here. Two deliberate differences: the positioning (`fixed` becomes `absolute` inside a stage) and
 * the icons (`apps/web` has no `lucide-react`; these are the closest hugeicons).
 *
 * The player colors and the English labels are made up for the page: a real table reads the colors from the game's skin
 * (`color(id)` of `useGame()`) and the labels from `UI_TEXTS` and its translations (`useText()`).
 */

const NICKNAMES = ["Mira", "Tomás", "Léa", "Jun", "Aurora", "Kasimir", "Noor", "Bastien", "Ines", "Oleksandr", "Wen", "Priya"]
const nicknameOf = (index: number) => NICKNAMES[index % NICKNAMES.length] ?? "Player"
/** Spread around the hue circle so that twelve seats stay distinguishable */
const colorOf = (index: number) => `oklch(0.76 0.14 ${(index * 47 + 25) % 360})`

/** A nickname in its player color, as `PlayerName` of the ticker and the names of the game over do */
function Name({ index, children }: { index: number; children?: ReactNode }) {
  return <span style={{ color: readableColor(colorOf(index)) }}>{children ?? nicknameOf(index)}</span>
}

function NameList({ indexes }: { indexes: readonly number[] }) {
  return indexes.map((index, position) => (
    <Fragment key={index}>
      {position > 0 && ", "}
      <Name index={index} />
    </Fragment>
  ))
}

/**
 * A piece of the in-game UI over a checkerboard, the stand-in for the art of the game: the panels are translucent, and a
 * checkerboard is what shows it. The class `.hud` opens the scope as the root of `GameHud` does; a theme writes its `--hud-*`
 * variables on it (`hudStyle`).
 */
function Stage({ theme, className, children }: { theme?: UiTheme; className?: string; children: ReactNode }) {
  return (
    <div className={cn("hud relative overflow-hidden rounded-3xl border bg-background pattern-checker", className)} style={hudStyle(theme) as CSSProperties}>
      {children}
    </div>
  )
}

/** `wide`: spans both columns of the grid it sits in */
function Specimen({ caption, theme, className, wide, children }: { caption: string; theme?: UiTheme; className?: string; wide?: boolean; children: ReactNode }) {
  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", wide && "md:col-span-2")}>
      <Stage theme={theme} className={className}>
        {children}
      </Stage>
      <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}

/* ---------------------------------------------------------------- primitives */

export function PrimitivesSpecimen() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen caption="HudButton · primary, quiet, floating, ghost" className="flex flex-wrap items-center gap-3 p-6">
        <HudButton variant="primary">Play again</HudButton>
        <HudButton variant="quiet">Share</HudButton>
        <HudButton variant="floating">Hide the scoreboard</HudButton>
        <HudButton variant="ghost">History</HudButton>
      </Specimen>
      <Specimen caption="HudButton · sm, md, lg and disabled" className="flex flex-wrap items-center gap-3 p-6">
        <HudButton size="sm">Small</HudButton>
        <HudButton size="md">Medium</HudButton>
        <HudButton size="lg">Large</HudButton>
        <HudButton variant="quiet" disabled>
          Waiting for other players (2/3)
        </HudButton>
      </Specimen>
      <Specimen caption="HudPanel and PlayerDot · the panel every overlay is made of" className="flex flex-wrap items-center gap-4 p-6">
        <HudPanel className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm">
          <PlayerDot color={colorOf(0)} />
          <Name index={0} />
          <span className="text-hud-muted">(you)</span>
        </HudPanel>
        <HudPanel className="flex items-center gap-3 rounded-full px-4 py-2 text-sm">
          <PlayerDot color={colorOf(1)} />
          <Name index={1} />
        </HudPanel>
      </Specimen>
      <Specimen caption="Text · Geist semibold, tight tracking · titles use the title font" className="flex flex-col gap-1 p-6">
        <p className={cn(HUD_TITLE, "text-3xl leading-tight text-hud-accent")}>Title in the title font</p>
        <p className={cn(HUD_TEXT, "text-lg text-hud-foreground")}>Text on a panel</p>
        <p className={cn(HUD_TEXT, "text-sm text-hud-muted")}>Secondary text</p>
      </Specimen>
    </div>
  )
}

/* ---------------------------------------------------------------- strip */

type StripSample = {
  seats: number
  /** Seats the game still waits for */
  waiting: readonly number[]
  /** Seats not seen at the table for a while */
  away?: readonly number[]
  /** The viewer's seat */
  me?: number
  /** Nicknames replacing the default ones, by seat */
  names?: Readonly<Record<number, string>>
}

/** The real `pendingSeats()` on made-up players, then the real view: only the colors and the labels are samples */
function stripOf({ seats, waiting, away = [], me = 0, names = {} }: StripSample): { strip: StripData; labels: StripLabels } {
  const players = Array.from({ length: seats }, (_, index) => ({ id: `seat-${index}`, nickname: names[index] ?? nicknameOf(index) }))
  const pending = pendingSeats({
    players,
    waitingFor: waiting.map((index) => `seat-${index}`),
    present: players.filter((_, index) => !away.includes(index)).map((player) => player.id),
    meId: `seat-${me}`,
  })
  if (!pending) throw new Error("A strip needs at least two waiting seats")
  return {
    strip: { ...pending, seats: pending.seats.map((seat, index) => ({ ...seat, color: colorOf(index) })) },
    labels: { players: "Players", ready: `${pending.ready}/${pending.total} ready`, done: "Ready", waiting: "Waiting", away: "Away", you: "(you)" },
  }
}

function Strip(sample: StripSample & { className?: string; defaultOpen?: boolean }) {
  const { className, defaultOpen, ...rest } = sample
  const { strip, labels } = stripOf(rest)
  return <PlayersStripView strip={strip} labels={labels} className={className} defaultOpen={defaultOpen} />
}

export function StripSpecimens() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen caption="Four seats · two done, you and one more still to play" className="flex justify-end p-4">
        <HudPanel className="flex w-96 max-w-full flex-col items-end rounded-xl p-4">
          <Strip seats={4} waiting={[0, 2]} me={0} />
        </HudPanel>
      </Specimen>
      <Specimen caption="Five seats · one waited-for player is away, dimmed" className="flex justify-end p-4">
        <HudPanel className="flex w-96 max-w-full flex-col items-end rounded-xl p-4">
          <Strip seats={5} waiting={[1, 2, 4]} away={[2]} me={1} />
        </HudPanel>
      </Specimen>
      <Specimen caption="You are done while others are not · long nicknames truncate, the full name is in the tooltip" className="flex justify-end p-4">
        <HudPanel className="flex w-96 max-w-full flex-col items-end rounded-xl p-4">
          <Strip seats={3} waiting={[0, 1]} me={2} names={{ 0: "Maximilienne-Alexandrine", 1: "Bartholomew" }} />
        </HudPanel>
      </Specimen>
      <Specimen caption="Twelve seats · collapsed to n/N ready, the list opens on hover or tap (drawn open here)" className="flex min-h-64 justify-end p-4">
        <HudPanel className="flex h-fit w-96 max-w-full flex-col items-end rounded-xl p-4">
          <Strip seats={12} waiting={[0, 1, 2, 3, 4, 5, 6]} away={[5]} me={3} defaultOpen />
        </HudPanel>
      </Specimen>
    </div>
  )
}

/* ---------------------------------------------------------------- ticker */

const MAIN_LINE = "text-lg leading-snug text-balance short:text-base"
const STATUS_LINE = "text-sm text-hud-muted tabular-nums short:text-xs"

function TickerPanel({ children }: { children: ReactNode }) {
  return <HudPanel className="flex w-96 max-w-full flex-col items-end gap-1.5 rounded-xl p-4 text-right short:w-80 short:gap-1 short:p-3">{children}</HudPanel>
}

function TickerHistory() {
  return (
    <div className="mt-1.5 flex w-full flex-col items-end border-t border-hud-border pt-3 short:mt-1 short:pt-2">
      <div className="max-h-48 w-full overflow-y-auto pr-1 pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-1rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden short:mt-2 short:max-h-32">
        <ol className="flex flex-col items-end gap-3 text-base short:gap-2 short:text-sm">
          <li className="flex flex-col items-end gap-1.5">
            <span className="text-xs text-hud-muted">Round 2</span>
            <div>
              <Name index={3} /> played a card
            </div>
            <div>
              <Name index={0} /> passed
            </div>
          </li>
          <li className="flex flex-col items-end gap-1.5">
            <span className="text-xs text-hud-muted">Round 1</span>
            <div>
              <Name index={1} /> won the round
            </div>
          </li>
        </ol>
      </div>
    </div>
  )
}

export function TickerSpecimens() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen caption="Your turn" className="flex justify-end p-4">
        <TickerPanel>
          <p className={MAIN_LINE}>It&apos;s your turn</p>
          <div className={STATUS_LINE}>Round 2 of 5</div>
        </TickerPanel>
      </Specimen>
      <Specimen caption="Someone else's turn" className="flex justify-end p-4">
        <TickerPanel>
          <p className={MAIN_LINE}>
            <Name index={1} />
            &apos;s turn
          </p>
          <div className={STATUS_LINE}>Round 2 of 5</div>
        </TickerPanel>
      </Specimen>
      <Specimen caption="A simultaneous step · the strip lists every seat, the history sits under it" className="flex justify-end p-4" wide>
        <TickerPanel>
          <p className={MAIN_LINE}>
            Waiting for <NameList indexes={[0, 2, 3]} />
          </p>
          <div className={STATUS_LINE}>Round 2 of 5</div>
          <Strip seats={4} waiting={[0, 2, 3]} me={0} className="mt-0.5" />
          <TickerHistory />
        </TickerPanel>
      </Specimen>
    </div>
  )
}

/* ---------------------------------------------------------------- takeover */

function Pill({ prompt, action, voted }: { prompt: string; action: string; voted?: boolean }) {
  return (
    <div
      role="group"
      aria-label={prompt}
      className={cn(
        HUD_TEXT,
        HUD_PANEL,
        "flex w-fit max-w-full items-center gap-3 rounded-xl py-2 pr-2 pl-4 text-sm whitespace-nowrap",
        "short:flex-col short:items-stretch short:gap-1.5 short:p-2 short:text-xs",
      )}
    >
      <span className="min-w-0 truncate short:line-clamp-2 short:px-1 short:whitespace-normal" title={prompt}>
        {prompt}
      </span>
      <HudButton
        variant={voted ? "quiet" : "primary"}
        disabled={voted}
        className="short:h-auto short:min-h-8 short:px-3 short:py-1 short:text-center short:text-xs short:leading-tight short:whitespace-normal"
      >
        {action}
      </HudButton>
    </div>
  )
}

export function TakeoverSpecimens() {
  return (
    <div className="grid gap-6">
      <Specimen caption="Offered once the turn has stalled" className="flex items-center justify-center p-5">
        <Pill prompt="Mira isn't responding?" action="Play for them" />
      </Specimen>
      <Specimen caption="Several present players must agree · votes so far" className="flex items-center justify-center p-5">
        <Pill prompt="Mira isn't responding?" action="Play for them (1/3)" />
      </Specimen>
      <Specimen caption="You voted · waiting for the others" className="flex items-center justify-center p-5">
        <Pill prompt="Mira isn't responding?" action="Waiting for other players (2/3)" voted />
      </Specimen>
    </div>
  )
}

/* ---------------------------------------------------------------- announcements */

/** The size clamps to the height of the window as the real announcement does, so a short window reads smaller */
const fit = (rem: number) => `min(${rem}rem, ${rem * 2.4}vh)`

export function AnnouncementSpecimens() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen caption="Start · centered on the scrim, the title in the accent" className="flex h-64 items-center justify-center">
        <div className="absolute inset-0 bg-hud-backdrop" />
        <div className="relative flex max-w-full flex-col items-center gap-2 px-6 text-center text-balance">
          <h4 className={cn(HUD_TITLE, "leading-[1.05] text-hud-accent")} style={{ fontSize: fit(4.4) }}>
            Round 1
          </h4>
          <p className={cn(HUD_TEXT, "leading-tight text-hud-foreground")} style={{ fontSize: fit(1.75) }}>
            Place your bids
          </p>
        </div>
      </Specimen>
      <Specimen caption="Victory · a longer stay, and confetti when the game is lively" className="flex h-64 items-center justify-center">
        <div className="absolute inset-0 bg-hud-backdrop" />
        <div className="relative flex max-w-full flex-col items-center gap-2 px-6 text-center text-balance">
          <h4 className={cn(HUD_TITLE, "leading-[1.05] text-hud-accent")} style={{ fontSize: fit(3.4) }}>
            Long live the winner
          </h4>
          <p className={cn(HUD_TEXT, "leading-tight text-hud-foreground")} style={{ fontSize: fit(1.75) }}>
            Mira · 42 pts
          </p>
        </div>
      </Specimen>
      <Specimen caption="Turn · a pill above the board, no scrim" className="flex h-24 items-start justify-center pt-5" wide>
        <div className={cn("relative flex max-w-full flex-col items-center gap-2 text-center text-balance", HUD_TEXT, HUD_PANEL, "rounded-full px-5 py-2")}>
          <h4 className={cn(HUD_TEXT, "leading-[1.05] text-hud-accent")} style={{ fontSize: fit(1.5) }}>
            It&apos;s your turn
          </h4>
        </div>
      </Specimen>
    </div>
  )
}

/* ---------------------------------------------------------------- game over */

type Chip = readonly [label: string, points: number]

/** The score detail chips of a player (the game can render its own with `renderDetail`) */
function Chips({ items, large, centered }: { items: readonly Chip[]; large?: boolean; centered?: boolean }) {
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`
  return (
    <div className={cn("flex flex-wrap items-center", centered ? "justify-center" : "justify-start", large ? "gap-2" : "gap-1.5")}>
      {items.map(([label, points]) => (
        <span
          key={label}
          className={cn(
            HUD_TEXT,
            "flex shrink-0 items-center gap-1.5 rounded-md bg-hud-foreground/10 text-hud-foreground tabular-nums",
            large ? "h-8 px-3 text-sm" : "h-7 px-2.5 text-xs",
            points === 0 && "opacity-50",
          )}
        >
          <span className="text-hud-muted">{label}</span>
          {sign(points)}
        </span>
      ))}
    </div>
  )
}

const RANKING: readonly { rank: number; index: number; total: number; items: readonly Chip[] }[] = [
  { rank: 2, index: 1, total: 38, items: [["Bids", 30], ["Bonus", 8]] },
  { rank: 3, index: 2, total: 25, items: [["Bids", 25], ["Bonus", 0]] },
  { rank: 4, index: 3, total: 17, items: [["Bids", 20], ["Penalty", -3]] },
]

export function GameOverSpecimen() {
  return (
    <Specimen
      caption="The scoreboard · winner, ranking, footer · hide or show on top, replay below"
      className="flex h-[48rem] flex-col items-center justify-center px-6 pt-20 pb-24 short:pt-14 short:pb-[4.5rem]"
    >
      <div className="absolute inset-0 bg-hud-backdrop" />
      <section aria-label="Scoreboard" className="relative flex max-h-full w-full max-w-lg flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-hud-surface text-hud-foreground shadow-overlay ring-1 ring-hud-border">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden short:overflow-y-auto">
            <header className="relative shrink-0 px-6 pt-6 pb-5 text-center short:pt-4 short:pb-3">
              <HudButton variant="quiet" size="sm" title="Share the result" aria-label="Share the result" className="absolute top-3 right-3 w-8 px-0 short:top-2 short:right-2">
                <HugeiconsIcon icon={LinkForwardIcon} strokeWidth={1.8} className="size-4" />
              </HudButton>
              <p className={cn(HUD_TEXT, "text-sm text-hud-muted")}>Winner:</p>
              <div className="mt-2 flex flex-col items-center gap-1 short:mt-1">
                <HugeiconsIcon icon={CrownIcon} aria-hidden strokeWidth={1.8} className="size-7 text-hud-accent" />
                <p className={cn(HUD_TITLE, "text-3xl leading-tight text-balance short:text-2xl")}>
                  <Name index={0} />
                </p>
                <p className={cn(HUD_TEXT, "text-xl text-hud-accent tabular-nums short:text-lg")}>42 pts</p>
              </div>
              <div className="mt-4 space-y-3 short:mt-2 short:space-y-2">
                <div className="space-y-1.5">
                  <Chips items={[["Bids", 30], ["Bonus", 12]]} large centered />
                </div>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 [scrollbar-width:thin] short:flex-none short:overflow-visible">
              <ol className="divide-y divide-hud-border border-t border-hud-border">
                {RANKING.map(({ rank, index, total, items }) => (
                  <li key={rank} className="space-y-2 py-3 short:py-2">
                    <div className="flex items-baseline gap-2">
                      <span className={cn(HUD_TEXT, "text-base text-hud-muted tabular-nums")}>{rank}.</span>
                      <span className={cn(HUD_TEXT, "min-w-0 flex-1 truncate text-lg")} title={nicknameOf(index)}>
                        <Name index={index} />
                      </span>
                      <span className={cn(HUD_TEXT, "text-xl leading-none tabular-nums")}>{total} pts</span>
                    </div>
                    <Chips items={items} />
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <footer className={cn(HUD_TEXT, "shrink-0 border-t border-hud-border px-6 py-3 text-center text-xs text-hud-muted short:hidden")}>Game name · 14 min · Oct 12, 2026, 9:41 PM · PBGO</footer>
        </div>
      </section>
      <div className="absolute inset-x-0 top-6 flex justify-center short:top-3">
        <HudButton variant="floating" size="sm" title="Hide the scoreboard" className="rounded-full short:w-8 short:px-0">
          <HugeiconsIcon icon={ViewOffIcon} aria-hidden strokeWidth={1.8} className="size-4" />
          <span className="short:sr-only">Hide the scoreboard</span>
        </HudButton>
      </div>
      <div className="absolute inset-x-0 bottom-6 flex justify-center short:bottom-3">
        <HudButton variant="primary" size="lg" className="shadow-float short:h-10">
          Play again (1/4)
        </HudButton>
      </div>
    </Specimen>
  )
}

/** Once you voted to play again, the button becomes a quiet, disabled confirmation */
export function ReplayVotedSpecimen() {
  return (
    <Specimen caption="Replay · before and after your vote" className="flex flex-wrap items-center justify-center gap-4 p-6">
      <HudButton variant="primary" size="lg" className="shadow-float">
        Play again (1/4)
      </HudButton>
      <HudButton variant="floating" size="lg" disabled className="text-hud-muted shadow-float disabled:opacity-100">
        <HugeiconsIcon icon={Tick02Icon} aria-hidden strokeWidth={1.8} className="size-4" />
        Play again (2/4)
      </HudButton>
    </Specimen>
  )
}

/* ---------------------------------------------------------------- chat */

const REACTIONS = ["👏", "😂", "😱", "🎉", "😈", "😢", "🔥", "❤️"]
const ICON_BUTTON = "flex size-8 cursor-pointer items-center justify-center rounded-full text-hud-foreground outline-none hover:bg-hud-foreground/10 focus-visible:ring-2 focus-visible:ring-hud-foreground/70"

function Chat({ palette }: { palette?: boolean }) {
  return (
    <div className="absolute right-5 bottom-5 flex w-[min(22rem,calc(100%-2.5rem))] flex-col gap-2 short:right-4 short:bottom-3 short:w-72">
      <div className="relative h-60 [mask-image:linear-gradient(to_bottom,transparent_0%,black_55%)] short:h-24">
        <ul aria-label="Chat" className="absolute inset-x-0 bottom-0 flex max-h-full flex-col justify-end gap-1 overflow-y-auto pr-1 [scrollbar-width:none]">
          {(
            [
              [0, "Good luck everyone"],
              [1, "That last bid was bold"],
              [2, "🔥"],
            ] as const
          ).map(([index, text]) => (
            <li key={text} className={cn(HUD_TEXT, "w-fit max-w-full rounded-lg bg-hud-surface/85 px-3 py-1.5 text-sm leading-snug text-hud-foreground ring-1 ring-hud-border")}>
              <span className="mr-1.5" style={{ color: readableColor(colorOf(index)) }}>
                {nicknameOf(index)}
              </span>
              <span className="break-words">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-end gap-2">
        <div className={cn(HUD_TEXT, HUD_PANEL, "flex min-w-0 flex-1 items-center gap-1 rounded-full py-1 pr-1 pl-4 opacity-80 hover:opacity-100", palette && "opacity-100")}>
          <span className="min-w-0 flex-1 truncate text-sm text-hud-muted">Write a message…</span>
          <div className="relative">
            {palette && (
              <div className="absolute right-0 bottom-full mb-2 grid w-44 grid-cols-4 gap-1 rounded-xl bg-hud-surface p-2 shadow-overlay ring-1 ring-hud-border">
                {REACTIONS.map((emoji) => (
                  <span key={emoji} className={cn(HUD_TRANSITION, "flex size-9 items-center justify-center rounded-lg text-xl hover:bg-hud-foreground/10")}>
                    {emoji}
                  </span>
                ))}
              </div>
            )}
            <span className={cn(HUD_TRANSITION, ICON_BUTTON, palette && "bg-hud-foreground/15")}>
              <HugeiconsIcon icon={SmileIcon} aria-hidden strokeWidth={1.8} className="size-4.5" />
            </span>
          </div>
          <span className={cn(HUD_TRANSITION, ICON_BUTTON, "opacity-30")}>
            <HugeiconsIcon icon={Sent02Icon} aria-hidden strokeWidth={1.8} className="size-4.5" />
          </span>
        </div>
      </div>
    </div>
  )
}

export function ChatSpecimens() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen caption="Messages fade out above the input, a message stays a few seconds" className="h-[24rem]">
        <Chat />
      </Specimen>
      <Specimen caption="Reactions · a soundboard that bursts emoji over the board in a lively game" className="h-[24rem]">
        <Chat palette />
      </Specimen>
    </div>
  )
}

/* ---------------------------------------------------------------- theme */

/**
 * A deliberate simulation of a game's theme, one of the two places of this page that name a colour or a font (the other is
 * `SIMULATED_SKIN` of the layers section): made-up values in the spirit of what Courtisans declares in its binding. A real
 * game points at its own tokens (`"var(--accent-game)"`), so its theme follows the skin edited in the admin.
 */
export const SIMULATED_THEME: UiTheme = {
  accent: "oklch(0.8 0.14 85)",
  onAccent: "oklch(0.2 0.04 250)",
  surface: "oklch(0.2 0.04 250)",
  titleFont: "Georgia, serif",
  backdrop: "oklch(0.15 0.04 250 / 0.7)",
  motion: "lively",
}

function ThemeScene() {
  return (
    <>
      <div className="absolute inset-0 bg-hud-backdrop" />
      <div className="relative flex w-full flex-col items-center gap-6 p-6">
        <div className="flex flex-col items-center gap-2 text-center text-balance">
          <p className={cn(HUD_TITLE, "text-4xl leading-[1.05] text-hud-accent")}>Round 1</p>
          <p className={cn(HUD_TEXT, "text-lg leading-tight text-hud-foreground")}>Place your bids</p>
        </div>
        <TickerPanel>
          <p className={MAIN_LINE}>
            Waiting for <NameList indexes={[1, 2]} />
          </p>
          <Strip seats={3} waiting={[1, 2]} me={0} className="mt-0.5" />
        </TickerPanel>
        <div className="flex items-center gap-3">
          <HudButton variant="primary">Play again</HudButton>
          <HudButton variant="quiet">Share</HudButton>
        </div>
      </div>
    </>
  )
}

export function ThemePair() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen caption="No theme · the neutral black and white of every game that declares nothing" className="flex items-center justify-center">
        <ThemeScene />
      </Specimen>
      <Specimen caption="A simulated theme · the same components, accent, surface, scrim and title font changed" theme={SIMULATED_THEME} className="flex items-center justify-center">
        <ThemeScene />
      </Specimen>
    </div>
  )
}
