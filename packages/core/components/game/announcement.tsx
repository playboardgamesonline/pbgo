"use client"

import { useEffect, useState } from "react"
import {
  ANNOUNCEMENT_LABELS,
  ANNOUNCEMENT_PRESETS,
  announcementSettings,
  type AnnouncementSettings,
  type BaseAnnouncementType,
} from "../../lib/announcement-settings"
import { useOptionalBinding } from "../../lib/binding-context"
import type { SeatAvatarInput } from "../../lib/seat-avatar"
import { playSound } from "../../lib/sound"
import { useMotion } from "../../lib/use-motion"
import { HostIcon } from "../lobby/lobby"
import { AnnouncementView } from "./announcement-view"
import { copyButton, debugTab, useControls } from "./debug-controls"
import { useSeatTheme } from "./seat-label"

export type { AnnouncementSettings, BaseAnnouncementType }

function schema(defaults: AnnouncementSettings, folder: string) {
  return {
    duration: { value: defaults.duration, min: 0.5, max: 8, step: 0.1, label: "duration (s)" },
    sound: { value: defaults.sound, label: "sound" },
    overlay: { value: defaults.overlay, min: 0, max: 1, step: 0.01, label: "veil opacity" },
    veil: { value: defaults.veil, label: "veil color" },
    fade: { value: defaults.fade, min: 0, max: 2, step: 0.05, label: "veil fade (s)" },
    font: { value: defaults.font, label: "font (css)" },
    size: { value: defaults.size, min: 1, max: 10, step: 0.1, label: "text size (rem)" },
    subtitleSize: { value: defaults.subtitleSize, min: 0.5, max: 6, step: 0.1, label: "subtitle size (rem)" },
    spacing: { value: defaults.spacing, min: 0, max: 0.5, step: 0.01, label: "letter spacing (em)" },
    textColor: { value: defaults.textColor, label: "text color" },
    outline: { value: defaults.outline, min: 0, max: 10, step: 0.5, label: "outline (px)" },
    outlineColor: { value: defaults.outlineColor, label: "outline color" },
    shadow: { value: defaults.shadow, min: 0, max: 20, step: 0.5, label: "shadow (px)" },
    shadowColor: { value: defaults.shadowColor, label: "shadow color" },
    blur: { value: defaults.blur, min: 0, max: 60, step: 1, label: "shadow blur (px)" },
    startScale: { value: defaults.startScale, min: 0.2, max: 2, step: 0.01, label: "start scale" },
    rise: { value: defaults.rise, min: 0, max: 80, step: 1, label: "rise (px)" },
    riseBlur: { value: defaults.riseBlur, min: 0, max: 40, step: 1, label: "rise blur (px)" },
    riseDuration: { value: defaults.riseDuration, min: 0.1, max: 3, step: 0.05, label: "rise duration (s)" },
    subtitleDelay: { value: defaults.subtitleDelay, min: 0, max: 1.5, step: 0.02, label: "subtitle delay (s)" },
    spring: { value: defaults.spring, label: "spring (lively games)" },
    bounce: { value: defaults.bounce, min: 4, max: 40, step: 1, label: "damping" },
    lines: { value: defaults.lines, label: "lines" },
    lineDuration: { value: defaults.lineDuration, min: 0, max: 6, step: 0.1, label: "glint duration (s, 0: none)" },
    lineThickness: { value: defaults.lineThickness, min: 1, max: 12, step: 0.5, label: "lines thickness (px)" },
    lineColor: { value: defaults.lineColor, label: "lines color" },
    lineGap: { value: defaults.lineGap, min: 0, max: 120, step: 1, label: "lines gap (px)" },
    above: { value: defaults.above, label: "at top of screen" },
    offsetY: { value: defaults.offsetY, min: -45, max: 45, step: 0.5, label: "text vertical offset (vh)" },
    fadeGradient: { value: defaults.fadeGradient, label: "gradient veil" },
    gradientHeight: { value: defaults.gradientHeight, min: 5, max: 100, step: 1, label: "gradient height (%)" },
    seat: { value: defaults.seat, options: ["none", "inline", "hero"], label: "player seat" },
    confetti: { value: defaults.confetti, label: "confetti (lively games)" },
    confettiCount: { value: defaults.confettiCount, min: 0, max: 400, step: 1, label: "confetti count" },
    confettiColor: { value: defaults.confettiColor, label: "confetti color" },
    confettiShape: { value: defaults.confettiShape, options: ["star", "dot"], label: "confetti shape" },
    confettiSize: { value: defaults.confettiSize, min: 0.2, max: 4, step: 0.05, label: "confetti size" },
    confettiSpeed: { value: defaults.confettiSpeed, min: 0.1, max: 4, step: 0.05, label: "confetti speed" },
    confettiGlow: { value: defaults.confettiGlow, min: 0, max: 60, step: 1, label: "confetti glow" },
    ...copyButton("TRANSITION", folder),
  }
}

/**
 * Leva settings of the announcements (TRANSITION tab). Four shared presets (`start`, `round`, `turn`, `victory`, see
 * `lib/announcement-settings.ts`), seeded by the game's `UI_THEME.announcement` (font, colours, veil, hairlines, confetti);
 * `extra` adds or overrides the game's own presets (a constant object: do not create it again on each render).
 */
export function useAnnouncementSettings<X extends string = never>(
  extra?: Record<X, Partial<AnnouncementSettings>>,
): Record<BaseAnnouncementType | X, AnnouncementSettings> {
  const theme = useOptionalBinding()?.UI_THEME?.announcement
  const presets = { ...ANNOUNCEMENT_PRESETS, ...extra } as Record<string, Partial<AnnouncementSettings>>
  const out: Record<string, AnnouncementSettings> = {}
  Object.entries(presets).forEach(([key, preset], i) => {
    const folder = `Announcement · ${ANNOUNCEMENT_LABELS[key] ?? key}`
    // eslint-disable-next-line react-hooks/rules-of-hooks -- the number of presets is constant
    out[key] = useControls(folder, schema(announcementSettings(preset, theme), folder), { collapsed: true, order: 2 + i }, debugTab("TRANSITION")) as AnnouncementSettings
  })
  return out as Record<BaseAnnouncementType | X, AnnouncementSettings>
}

/**
 * `sound`: effect declared in the game's `SOUNDS`, played when it shows up if the "sound" setting is on. `seats`: the players shown with
 * it (the viewer for "your turn", the winners for a victory); the preset's `seat` mode decides how, and a game that passes none shows none.
 *
 * The visual is hidden from assistive technology and read out through a polite live region instead, so it is spoken once whatever
 * the animation does. `live={false}` leaves that to the caller, which already keeps a live region for a queue (`useAnnouncements`).
 * Under reduced motion it only fades; confetti and the spring are for the games whose `UI_THEME.motion` is `lively`.
 */
export function Announcement({
  text,
  subtitle,
  settings,
  sound,
  seats,
  live = true,
}: {
  text: string
  subtitle?: string
  settings: AnnouncementSettings
  sound?: string
  seats?: readonly SeatAvatarInput[]
  live?: boolean
}) {
  const motion = useMotion()
  const seatTheme = useSeatTheme()
  // The live region exists empty first and is filled once mounted: a region inserted with its text is not always read out
  const [spoken, setSpoken] = useState("")
  useEffect(() => {
    if (sound && settings.sound) playSound(sound, { bus: "alerts" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!live) return
    const frame = requestAnimationFrame(() => setSpoken([text, subtitle].filter(Boolean).join(". ")))
    return () => cancelAnimationFrame(frame)
  }, [live, text, subtitle])
  return (
    <>
      <AnnouncementView
        text={text}
        subtitle={subtitle}
        settings={settings}
        motion={motion}
        seats={seats}
        seatTheme={seatTheme}
        crown={settings.seat === "hero" ? <HostIcon size="size-[1em]" /> : undefined}
      />
      {live && (
        <div role="status" aria-live="polite" className="ph-mask sr-only">
          {spoken}
        </div>
      )}
    </>
  )
}
