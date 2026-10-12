import type { UiTheme } from "./binding"

/** `UiTheme` field → HUD variable (`@pbgo/ui/styles/hud.css`). `motion` is no CSS value: `useMotion` reads it (`motion-preference.ts`). */
const HUD_VARIABLES = {
  accent: "--hud-accent",
  onAccent: "--hud-on-accent",
  surface: "--hud-surface",
  titleFont: "--hud-title-font",
  backdrop: "--hud-backdrop",
} as const satisfies Partial<Record<keyof UiTheme, `--hud-${string}`>>

/**
 * The `--hud-*` variables a game's theme sets, written inline on the root of `GameHud`. Only the fields the game names are
 * returned: the others keep the neutral defaults of `.hud` in `@pbgo/ui/styles/hud.css`. A blank value counts as absent.
 */
export function hudStyle(theme: UiTheme | undefined): Record<string, string> {
  const style: Record<string, string> = {}
  if (!theme) return style
  for (const field of Object.keys(HUD_VARIABLES) as (keyof typeof HUD_VARIABLES)[]) {
    const value = theme[field]?.trim()
    if (value) style[HUD_VARIABLES[field]] = value
  }
  return style
}
