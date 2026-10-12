import { cn } from "@pbgo/ui/utils"

/*
 * Primitives of the in-game UI (ticker, announcements, takeover pill, chat, game over). They only read the `--hud-*`
 * variables that `GameHud` sets on its root (`@pbgo/ui/styles/hud.css`, tuned per game by `UI_THEME`), so they must sit inside it.
 * No hook and no state here: the same pieces draw the real components and the static samples of `/design`.
 */

/** Text: Geist semibold, slight negative tracking. `.hud` carries no typography itself, so the boards inside keep theirs. */
export const HUD_TEXT = "font-hud font-semibold tracking-hud"

/** Titles (announcements, game over): the font the game's theme names, same weight */
export const HUD_TITLE = "font-hud-title font-semibold tracking-hud-title"

/** Flat dark panel: neutral surface, hairline ring, one shadow. The art behind it stays the hero. */
export const HUD_PANEL = "bg-hud-surface/85 text-hud-foreground ring-1 ring-hud-border shadow-float"

/** Motion of every hover, focus and state change: platform tokens, none under reduced motion */
export const HUD_TRANSITION = "transition-colors duration-fast ease-standard motion-reduce:transition-none"

export function HudPanel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(HUD_TEXT, HUD_PANEL, className)} {...props} />
}

const BUTTON_VARIANTS = {
  /** The one action the screen asks for */
  primary: "bg-hud-accent text-hud-on-accent hover:bg-hud-accent/90",
  quiet: "bg-hud-foreground/10 text-hud-foreground hover:bg-hud-foreground/15",
  /** A control that sits over the art with no panel behind it: it brings its own surface */
  floating: "bg-hud-surface/85 text-hud-foreground ring-1 ring-hud-border shadow-float hover:bg-hud-raised",
  ghost: "text-hud-muted hover:text-hud-foreground",
} as const

const BUTTON_SIZES = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-8 text-base",
} as const

export type HudButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof BUTTON_VARIANTS
  size?: keyof typeof BUTTON_SIZES
}

/**
 * Button of the in-game UI. Waiting is shown by the label and `disabled`, never by a looping effect: a spinner or a sheen
 * would ignore the visitor's reduced-motion preference.
 */
export function HudButton({ variant = "quiet", size = "md", className, type = "button", ...props }: HudButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        HUD_TEXT,
        HUD_TRANSITION,
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg whitespace-nowrap outline-none",
        "focus-visible:ring-2 focus-visible:ring-hud-foreground/70 focus-visible:ring-offset-2 focus-visible:ring-offset-hud-surface",
        "disabled:pointer-events-none disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  )
}

/** A player's color as a dot: the exact color of the skin, as on the board */
export function PlayerDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />
}

/**
 * A player's color as text on a dark panel. Skins pick colors for a pawn or a card edge (often dark and muted), which are too
 * dim for a name, so the text is the same hue pulled towards white; the exact color stays on the `PlayerDot`.
 */
export const readableColor = (color: string) => `color-mix(in oklab, ${color} 70%, white)`
