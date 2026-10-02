"use client"

import { useControls } from "leva"
import { motion } from "motion/react"
import { useEffect, useRef } from "react"
import { cn } from "@pbgo/ui/utils"
import { copyButton, debugTab } from "./debug-tabs"
import { playSound } from "../../lib/sound"


const DEFAULTS = {
  duration: 2.4,
  sound: true,
  overlay: 0.64,
  fade: 0.3,
  size: 4.8,
  subtitleSize: 2,
  spacing: 0,
  textColor: "#ffffff",
  outline: 0.5,
  outlineColor: "#f2b705",
  shadow: 4,
  blur: 18,
  startScale: 0.85,
  bounce: 16,
  lines: true,
  lineDuration: 3.2,
  lineThickness: 2,
  lineColor: "#f5c542",
  lineGap: 80,
  above: false,
  offsetY: -10,
  fadeGradient: false,
  gradientHeight: 52,
  confetti: false,
  confettiCount: 70,
  confettiColor: "#ffd35c",
  confettiSize: 1,
  confettiSpeed: 1,
  confettiGlow: 16,
}
export type AnnouncementSettings = typeof DEFAULTS

function schema(defaults: AnnouncementSettings, folder: string) {
  return {
    duration: { value: defaults.duration, min: 0.5, max: 8, step: 0.1, label: "duration (s)" },
    sound: { value: defaults.sound, label: "sound" },
    overlay: { value: defaults.overlay, min: 0, max: 1, step: 0.01, label: "overlay opacity" },
    fade: { value: defaults.fade, min: 0, max: 2, step: 0.05, label: "fade (s)" },
    size: { value: defaults.size, min: 1, max: 10, step: 0.1, label: "text size (rem)" },
    subtitleSize: { value: defaults.subtitleSize, min: 0.5, max: 6, step: 0.1, label: "subtitle size (rem)" },
    spacing: { value: defaults.spacing, min: 0, max: 0.5, step: 0.01, label: "letter spacing (em)" },
    textColor: { value: defaults.textColor, label: "text color" },
    outline: { value: defaults.outline, min: 0, max: 10, step: 0.5, label: "outline (px)" },
    outlineColor: { value: defaults.outlineColor, label: "outline color" },
    shadow: { value: defaults.shadow, min: 0, max: 20, step: 0.5, label: "shadow (px)" },
    blur: { value: defaults.blur, min: 0, max: 60, step: 1, label: "shadow blur (px)" },
    startScale: { value: defaults.startScale, min: 0.2, max: 2, step: 0.01, label: "start scale" },
    bounce: { value: defaults.bounce, min: 4, max: 40, step: 1, label: "damping" },
    lines: { value: defaults.lines, label: "lines" },
    lineDuration: { value: defaults.lineDuration, min: 0.3, max: 6, step: 0.1, label: "lines duration (s)" },
    lineThickness: { value: defaults.lineThickness, min: 1, max: 12, step: 0.5, label: "lines thickness (px)" },
    lineColor: { value: defaults.lineColor, label: "lines color" },
    lineGap: { value: defaults.lineGap, min: 0, max: 120, step: 1, label: "lines gap (px)" },
    above: { value: defaults.above, label: "at top of screen" },
    offsetY: { value: defaults.offsetY, min: -45, max: 45, step: 0.5, label: "text vertical offset (vh)" },
    fadeGradient: { value: defaults.fadeGradient, label: "gradient overlay" },
    gradientHeight: { value: defaults.gradientHeight, min: 5, max: 100, step: 1, label: "gradient height (%)" },
    confetti: { value: defaults.confetti, label: "confetti" },
    confettiCount: { value: defaults.confettiCount, min: 0, max: 400, step: 1, label: "confetti count" },
    confettiColor: { value: defaults.confettiColor, label: "confetti color" },
    confettiSize: { value: defaults.confettiSize, min: 0.2, max: 4, step: 0.05, label: "confetti size" },
    confettiSpeed: { value: defaults.confettiSpeed, min: 0.1, max: 4, step: 0.05, label: "confetti speed" },
    confettiGlow: { value: defaults.confettiGlow, min: 0, max: 60, step: 1, label: "confetti glow" },
    ...copyButton("TRANSITION", folder),
  }
}

const PRESETS = {
  start: {},
  turn: {
    offsetY: 0,
    above: true,
    fadeGradient: true,
    overlay: 0.55,
    lines: false,
    size: 2.2,
    outline: 0,
    shadow: 2,
    blur: 12,
    startScale: 0.96,
    duration: 2,
    spacing: 0.06,
    gradientHeight: 45,
  },
  victory: { duration: 4.5, sound: false, size: 3.4, confetti: true },
} satisfies Record<string, Partial<AnnouncementSettings>>

export type BaseAnnouncementType = keyof typeof PRESETS

const LABELS: Record<string, string> = { start: "Start", turn: "Your Turn", victory: "Victory" }

/**
 * Réglages leva des annonces (onglet TRANSITION). Trois préréglages communs (`start`, `turn`, `victory`) ;
 * `extra` ajoute ou surcharge des préréglages propres au jeu (objet constant : ne pas le recréer à chaque rendu).
 */
export function useAnnouncementSettings<X extends string = never>(
  extra?: Record<X, Partial<AnnouncementSettings>>,
): Record<BaseAnnouncementType | X, AnnouncementSettings> {
  const presets = { ...PRESETS, ...extra } as Record<string, Partial<AnnouncementSettings>>
  const out: Record<string, AnnouncementSettings> = {}
  Object.entries(presets).forEach(([key, preset], i) => {
    const folder = `Announcement · ${LABELS[key] ?? key}`
    // eslint-disable-next-line react-hooks/rules-of-hooks -- nombre de préréglages constant
    out[key] = useControls(folder, schema({ ...DEFAULTS, ...preset }, folder), { collapsed: true, order: 2 + i }, debugTab("TRANSITION")) as AnnouncementSettings
  })
  return out as Record<BaseAnnouncementType | X, AnnouncementSettings>
}

function Line({ direction, r }: { direction: 1 | -1; r: AnnouncementSettings }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: r.lineThickness }}>
      <motion.div
        className="absolute inset-y-0 w-[70%]"
        style={{ background: `linear-gradient(90deg, transparent, ${r.lineColor} 30%, #fff4d6 50%, ${r.lineColor} 70%, transparent)` }}
        initial={{ x: direction === 1 ? "-100%" : "145%" }}
        animate={{ x: direction === 1 ? "145%" : "-100%" }}
        transition={{ duration: r.lineDuration, ease: [0.45, 0, 0.2, 1] }}
      />
    </div>
  )
}

type Particle = { x: number; y: number; vx: number; vy: number; size: number; angle: number; spin: number; phase: number; freq: number }

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
  ctx.fillStyle = "#fffbe8"
  star(radius * 0.35)
  return { image: c, scale: side / (radius * 2) }
}

function Confetti({ r }: { r: AnnouncementSettings }) {
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
    const { image, scale } = sprite(r.confettiColor, r.confettiGlow)
    const W = () => canvas.width
    const H = () => canvas.height
    const particles: Particle[] = Array.from({ length: r.confettiCount }, () => ({
      x: Math.random() * W(),
      y: -Math.random() * H() * 0.8,
      vx: (Math.random() - 0.5) * 40 * dpr,
      vy: (60 + Math.random() * 90) * dpr,
      size: (3 + Math.random() * 6) * dpr * r.confettiSize,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 3,
      phase: Math.random() * Math.PI * 2,
      freq: 2 + Math.random() * 4,
    }))
    const start = performance.now()
    let previous = start
    let id = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000) * r.confettiSpeed
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
  }, [r.confettiCount, r.confettiColor, r.confettiSize, r.confettiSpeed, r.confettiGlow])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
}

/** `sound` : effet déclaré dans `SOUNDS` du jeu, joué à l'apparition si le réglage « sound » est actif. */
export function Announcement({ text, subtitle, settings: r, sound }: { text: string; subtitle?: string; settings: AnnouncementSettings; sound?: string }) {
  useEffect(() => {
    if (sound && r.sound) playSound(sound, { bus: "alerts" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = {
    color: r.textColor,
    WebkitTextStroke: r.outline ? `${r.outline}px ${r.outlineColor}` : undefined,
    paintOrder: "stroke fill",
    filter: `drop-shadow(0 ${r.shadow}px 0 rgb(0 0 0 / 85%)) drop-shadow(0 ${r.shadow * 2.5}px ${r.blur}px rgb(0 0 0 / 60%))`,
  } as const
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: r.fade + 0.2 } }}
      transition={{ duration: r.fade }}
      className={cn("pointer-events-none absolute inset-0 z-40 flex justify-center", r.above ? "items-start pt-[9vh]" : "items-center")}
      style={
        r.fadeGradient
          ? { background: `linear-gradient(to bottom, rgb(0 0 0 / ${r.overlay}) 0%, transparent ${r.gradientHeight}%)` }
          : { backgroundColor: `rgb(0 0 0 / ${r.overlay})` }
      }
    >
      {r.confetti && <Confetti r={r} />}
      <div className="relative flex w-full flex-col items-center" style={{ gap: r.lineGap, transform: r.offsetY ? `translateY(${r.offsetY}vh)` : undefined }}>
        {r.lines && <Line direction={1} r={r} />}
        <motion.div
          initial={{ opacity: 0, scale: r.startScale, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: r.bounce, delay: 0.1 }}
          className="flex max-w-full flex-col items-center gap-2 px-6 text-center text-balance uppercase"
          style={{ fontFamily: "var(--font-accent, var(--font-title))" }}
        >
          <h2 style={{ ...style, fontSize: `${r.size}rem`, lineHeight: 1.1, letterSpacing: `${r.spacing}em` }}>{text}</h2>
          {subtitle && <p style={{ ...style, fontSize: `${r.subtitleSize}rem`, lineHeight: 1.1, letterSpacing: `${r.spacing}em` }}>{subtitle}</p>}
        </motion.div>
        {r.lines && <Line direction={-1} r={r} />}
      </div>
    </motion.div>
  )
}
