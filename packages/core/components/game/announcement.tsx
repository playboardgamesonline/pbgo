"use client"

import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { EASE_STANDARD, fade, travel } from "../../lib/motion-preference"
import { playSound } from "../../lib/sound"
import { useMotion } from "../../lib/use-motion"
import { copyButton, debugTab, useControls } from "./debug-controls"
import { HUD_PANEL, HUD_TEXT, HUD_TITLE } from "./hud-ui"

const DEFAULTS = {
  duration: 2.4,
  sound: true,
  /** Strength of the scrim behind the title, 0 to 1 (times the `backdrop` of the game's `UI_THEME`) */
  overlay: 1,
  fade: 0.3,
  size: 4.4,
  subtitleSize: 1.75,
  /** A light banner at the top of the screen instead of a title in the middle of it (no scrim) */
  above: false,
  /** Stars falling behind the title; only a game whose `UI_THEME.motion` is `lively` shows them */
  confetti: false,
}
export type AnnouncementSettings = typeof DEFAULTS

function schema(defaults: AnnouncementSettings, folder: string) {
  return {
    duration: { value: defaults.duration, min: 0.5, max: 8, step: 0.1, label: "duration (s)" },
    sound: { value: defaults.sound, label: "sound" },
    overlay: { value: defaults.overlay, min: 0, max: 1, step: 0.01, label: "scrim strength" },
    fade: { value: defaults.fade, min: 0, max: 2, step: 0.05, label: "fade (s)" },
    size: { value: defaults.size, min: 1, max: 10, step: 0.1, label: "text size (rem)" },
    subtitleSize: { value: defaults.subtitleSize, min: 0.5, max: 6, step: 0.1, label: "subtitle size (rem)" },
    above: { value: defaults.above, label: "banner at top of screen" },
    confetti: { value: defaults.confetti, label: "confetti (lively games)" },
    ...copyButton("TRANSITION", folder),
  }
}

const PRESETS = {
  start: {},
  turn: { above: true, size: 1.5, duration: 2 },
  victory: { duration: 4.5, sound: false, size: 3.4, confetti: true },
} satisfies Record<string, Partial<AnnouncementSettings>>

export type BaseAnnouncementType = keyof typeof PRESETS

const LABELS: Record<string, string> = { start: "Start", turn: "Your Turn", victory: "Victory" }

/**
 * Leva settings of the announcements (TRANSITION tab, debug only). Three shared presets (`start`, `turn`, `victory`);
 * `extra` adds or overrides the game's own presets (a constant object: do not create it again on each render).
 */
export function useAnnouncementSettings<X extends string = never>(
  extra?: Record<X, Partial<AnnouncementSettings>>,
): Record<BaseAnnouncementType | X, AnnouncementSettings> {
  const presets = { ...PRESETS, ...extra } as Record<string, Partial<AnnouncementSettings>>
  const out: Record<string, AnnouncementSettings> = {}
  Object.entries(presets).forEach(([key, preset], i) => {
    const folder = `Announcement · ${LABELS[key] ?? key}`
    // eslint-disable-next-line react-hooks/rules-of-hooks -- the number of presets is constant
    out[key] = useControls(folder, schema({ ...DEFAULTS, ...preset }, folder), { collapsed: true, order: 2 + i }, debugTab("TRANSITION")) as AnnouncementSettings
  })
  return out as Record<BaseAnnouncementType | X, AnnouncementSettings>
}

type Particle = { x: number; y: number; vx: number; vy: number; size: number; angle: number; spin: number; phase: number; freq: number }

const CONFETTI_COUNT = 70
const CONFETTI_GLOW = 16

function sprite(color: string, glow: number) {
  const radius = 32
  const margin = Math.ceil(glow * 1.5)
  const side = (radius + margin) * 2
  const c = document.createElement("canvas")
  c.width = side
  c.height = side
  const ctx = c.getContext("2d")!
  const star = (t: number) => {
    ctx.beginPath()
    for (let k = 0; k < 8; k++) {
      const r = k % 2 === 0 ? t : t * 0.28
      const a = (k * Math.PI) / 4
      ctx.lineTo(side / 2 + Math.cos(a) * r, side / 2 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.shadowColor = color
  ctx.shadowBlur = glow * 2
  ctx.fillStyle = color
  star(radius)
  ctx.shadowBlur = 0
  ctx.fillStyle = "#fff"
  star(radius * 0.35)
  return { image: c, scale: side / (radius * 2) }
}

/** Falling stars in the accent color of the game's theme (`--hud-accent`, read from the page: a canvas takes no `var()`) */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const dpr = Math.min(1.25, window.devicePixelRatio || 1)
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
    }
    resize()
    const color = getComputedStyle(canvas).getPropertyValue("--hud-accent").trim() || "#fff"
    const { image, scale } = sprite(color, CONFETTI_GLOW)
    const W = () => canvas.width
    const H = () => canvas.height
    const particles: Particle[] = Array.from({ length: CONFETTI_COUNT }, () => ({
      x: Math.random() * W(),
      y: -Math.random() * H() * 0.8,
      vx: (Math.random() - 0.5) * 40 * dpr,
      vy: (60 + Math.random() * 90) * dpr,
      size: (3 + Math.random() * 6) * dpr,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 3,
      phase: Math.random() * Math.PI * 2,
      freq: 2 + Math.random() * 4,
    }))
    const start = performance.now()
    let previous = start
    let id = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      const elapsed = (now - start) / 1000
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W(), H())
      ctx.globalCompositeOperation = "lighter"
      for (const p of particles) {
        p.x += (p.vx + Math.sin(elapsed * 1.3 + p.phase) * 25 * dpr) * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        if (p.y > H() + 20) {
          p.y = -20
          p.x = Math.random() * W()
        }
        const sparkle = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * p.freq + p.phase), 3)
        const side = p.size * (0.7 + 0.3 * sparkle) * 2 * scale
        const cos = Math.cos(p.angle)
        const sin = Math.sin(p.angle)
        ctx.globalAlpha = sparkle
        ctx.setTransform(cos, sin, -sin, cos, p.x, p.y)
        ctx.drawImage(image, -side / 2, -side / 2, side, side)
      }
      ctx.globalAlpha = 1
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener("resize", resize)
    }
  }, [])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
}

/** A size in rem that also follows the height of the viewport, so a title shrinks by itself on a short screen (a phone held sideways) */
const fontSize = (rem: number) => `min(${rem}rem, ${rem * 2.4}vh)`

/**
 * An announcement over the table: a centred title on a soft scrim, or (`above`) a light banner at the top of the screen.
 * `sound`: effect declared in the game's `SOUNDS`, played when it shows up if the "sound" setting is on.
 *
 * The visual is hidden from assistive technology and read out through a polite live region instead, so it is spoken once whatever
 * the animation does. `live={false}` leaves that to the caller, which already keeps a live region for a queue (`useAnnouncements`).
 */
export function Announcement({
  text,
  subtitle,
  settings: r,
  sound,
  live = true,
}: {
  text: string
  subtitle?: string
  settings: AnnouncementSettings
  sound?: string
  live?: boolean
}) {
  const motionMode = useMotion()
  const lively = motionMode === "lively"
  // The live region exists empty first and is filled once mounted: a region inserted with its text is not always read out
  const [spoken, setSpoken] = useState("")
  useEffect(() => {
    if (sound && r.sound) playSound(sound, { bus: "alerts" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!live) return
    const frame = requestAnimationFrame(() => setSpoken([text, subtitle].filter(Boolean).join(". ")))
    return () => cancelAnimationFrame(frame)
  }, [live, text, subtitle])
  const enter = lively ? { type: "spring" as const, stiffness: 180, damping: 18, delay: 0.1 } : { duration: fade(motionMode, r.fade), ease: EASE_STANDARD }
  return (
    <>
      <motion.div
        aria-hidden
        data-hud="announcement"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: fade(motionMode, r.fade) } }}
        transition={{ duration: fade(motionMode, r.fade), ease: EASE_STANDARD }}
        className={cn(
          "pointer-events-none absolute inset-0 z-40 flex justify-center",
          r.above ? "items-start pt-[max(1.25rem,env(safe-area-inset-top))] short:pt-[max(0.75rem,env(safe-area-inset-top))]" : "items-center",
        )}
      >
        {!r.above && <div className="absolute inset-0 bg-hud-backdrop" style={{ opacity: r.overlay }} />}
        {r.confetti && lively && <Confetti />}
        <motion.div
          initial={{ opacity: 0, y: travel(motionMode, r.above ? -12 : 12), scale: lively ? 0.92 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={enter}
          className={cn(
            "relative flex max-w-full flex-col items-center gap-2 text-center text-balance",
            r.above ? cn(HUD_TEXT, HUD_PANEL, "rounded-full px-5 py-2") : "px-6",
          )}
        >
          <h2 className={cn(r.above ? HUD_TEXT : HUD_TITLE, "leading-[1.05] text-hud-accent")} style={{ fontSize: fontSize(r.size) }}>
            {text}
          </h2>
          {subtitle && (
            <p className={cn(HUD_TEXT, "leading-tight text-hud-foreground")} style={{ fontSize: fontSize(r.subtitleSize) }}>
              {subtitle}
            </p>
          )}
        </motion.div>
      </motion.div>
      {live && (
        <div role="status" aria-live="polite" className="sr-only">
          {spoken}
        </div>
      )}
    </>
  )
}
