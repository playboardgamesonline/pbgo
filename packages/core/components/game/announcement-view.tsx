"use client"

import { AnimatePresence, motion, type TargetAndTransition } from "motion/react"
import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import {
  announcementTimeline,
  fontSize,
  HERO_MAX,
  heroSeatSize,
  lineGap,
  ruleStyles,
  textStyle,
  veilStyle,
  vh,
  type AnnouncementSettings,
  type AnnouncementTimeline,
} from "../../lib/announcement-settings"
import { EASE_STANDARD, type Motion } from "../../lib/motion-preference"
import { seatAvatar, type SeatAvatarInput } from "../../lib/seat-avatar"
import type { SeatTheme } from "../../lib/ui-theme"
import { SeatAvatarMark } from "./seat-label"

/**
 * One full-screen announcement, drawn: the veil over the table, the two hairlines that frame the title, the title and its
 * subtitle, and for a victory the winner's medallion and crown. Everything is told by the settings and the timeline of
 * `lib/announcement-settings.ts`; this file has no leva, no sound and no game context, so the live component (`announcement.tsx`)
 * and the specimens of the design docs render the same thing.
 *
 * The parts come in one after the other (veil, hairlines drawn from the centre, title rising into focus, subtitle) and leave in
 * the same order, each with its own transition, so the root is a plain element: the exit of every part is what `AnimatePresence`
 * above waits for. Reduced motion: every part only fades, at once.
 */

type Particle = { x: number; y: number; vx: number; vy: number; size: number; angle: number; spin: number; phase: number; freq: number }

function sprite(color: string, glow: number, shape: "star" | "dot") {
  const radius = 32
  const margin = Math.ceil(glow * 1.5)
  const side = (radius + margin) * 2
  const c = document.createElement("canvas")
  c.width = side
  c.height = side
  const ctx = c.getContext("2d")!
  const mark = (t: number) => {
    ctx.beginPath()
    if (shape === "dot") {
      ctx.arc(side / 2, side / 2, t * 0.6, 0, Math.PI * 2)
    } else {
      for (let k = 0; k < 8; k++) {
        const r = k % 2 === 0 ? t : t * 0.28
        const a = (k * Math.PI) / 4
        ctx.lineTo(side / 2 + Math.cos(a) * r, side / 2 + Math.sin(a) * r)
      }
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.shadowColor = color
  ctx.shadowBlur = glow * 2
  ctx.fillStyle = color
  mark(radius)
  ctx.shadowBlur = 0
  ctx.fillStyle = "#fffbe8"
  mark(radius * 0.35)
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
    const { image, scale } = sprite(r.confettiColor, r.confettiGlow, r.confettiShape)
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
  }, [r.confettiCount, r.confettiColor, r.confettiShape, r.confettiSize, r.confettiSpeed, r.confettiGlow])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
}

const tween = (delay: number, duration: number) => ({ delay, duration, ease: EASE_STANDARD })

/** Where a part comes from, where it settles and where it goes: it only fades when nothing travels, blurs or scales (reduced motion) */
function riseTargets({ rise, blur, scale }: { rise: number; blur: number; scale: number }) {
  const from: TargetAndTransition = { opacity: 0 }
  const to: TargetAndTransition = { opacity: 1 }
  const out: TargetAndTransition = { opacity: 0 }
  if (rise) {
    from.y = rise
    to.y = 0
    out.y = -rise * 0.6
  }
  if (scale !== 1) {
    from.scale = scale
    to.scale = 1
  }
  if (blur) {
    from.filter = `blur(${blur}px)`
    to.filter = "blur(0px)"
    out.filter = `blur(${blur * 0.5}px)`
  }
  return { from, to, out }
}

/** A hairline of the frame: drawn from the centre, then a glint crosses it (left to right on the top one, back on the bottom one) */
function Hairline({ r, t, direction }: { r: AnnouncementSettings; t: AnnouncementTimeline; direction: 1 | -1 }) {
  const { line, glint } = ruleStyles(r)
  const { rule } = t
  const still = t.motion === "reduced"
  return (
    <motion.div
      className="relative w-full overflow-hidden"
      style={{ height: r.lineThickness, ...line }}
      initial={still ? { opacity: 0 } : { opacity: 0, scaleX: 0 }}
      animate={still ? { opacity: 1 } : { opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0, ...(still ? null : { scaleX: 0 }), transition: { duration: t.exit, ease: EASE_STANDARD } }}
      transition={still ? tween(0, t.veil) : { opacity: tween(rule.delay, 0.25), scaleX: tween(rule.delay, rule.draw) }}
    >
      {rule.glint && (
        <motion.div
          className="absolute inset-y-0 w-[40%]"
          style={glint}
          initial={{ x: direction === 1 ? "-100%" : "250%" }}
          animate={{ x: direction === 1 ? "250%" : "-100%" }}
          transition={tween(rule.glint.delay, rule.glint.duration)}
        />
      )}
    </motion.div>
  )
}

/** The crown sits on a medallion: a size in em that follows the viewport height like the title does, so it keeps its proportion on a short screen */
const CROWN_SIZE = { lg: `min(1.5rem, ${vh(5.5)})`, xl: `min(2.25rem, ${vh(8)})` } as const

export type AnnouncementViewProps = {
  text: string
  subtitle?: string
  settings: AnnouncementSettings
  /** How much it moves: `useMotion()` in a game, picked by hand in a specimen */
  motion: Motion
  /** The players shown with it: the first one beside the title ("your turn", `seat: "inline"`), up to `HERO_MAX` above it (the winners, `seat: "hero"`) */
  seats?: readonly SeatAvatarInput[]
  /** Default: the one of the game shown */
  seatTheme?: SeatTheme
  /** Sits on each medallion of a victory */
  crown?: ReactNode
}

/**
 * One announcement. The preset (`settings.seat`) decides which of the `seats` show; a game without avatars to show passes none.
 */
export function AnnouncementView({ text, subtitle, settings: r, motion: mode, seats, seatTheme, crown }: AnnouncementViewProps) {
  const shown = r.seat === "hero" ? (seats ?? []).slice(0, HERO_MAX) : r.seat === "inline" ? (seats ?? []).slice(0, 1) : []
  const t = announcementTimeline(r, mode, shown.length)
  const avatars = shown.map(seatAvatar)
  const calm = mode === "reduced"

  const title = riseTargets(t.title)
  const subtitleTargets = riseTargets({ rise: t.subtitle.rise, blur: 0, scale: 1 })
  // A spring only for the title and the medallions that ask for it (the victory of a lively game); the blur always tweens
  const settle = t.title.spring ? { type: "spring" as const, stiffness: 180, damping: r.bounce, delay: t.title.delay } : tween(t.title.delay, t.title.duration)
  const titleTransition = calm ? tween(0, t.veil) : { y: settle, scale: settle, opacity: tween(t.title.delay, t.title.duration), filter: tween(t.title.delay, t.title.duration) }

  const letters = { fontSize: fontSize(r.size), lineHeight: 1.1, letterSpacing: `${r.spacing}em` }
  const inline = r.seat === "inline" && avatars[0]

  return (
    <div
      aria-hidden
      data-hud="announcement"
      className={cn(
        "pointer-events-none absolute inset-0 z-40 flex justify-center",
        // the 9 % of the screen's height of `vh(9)`, written for Tailwind
        r.above ? "items-start pt-[max(calc(var(--vh,1vh)*9),env(safe-area-inset-top))] short:pt-[max(0.75rem,env(safe-area-inset-top))]" : "items-center",
      )}
    >
      <motion.div
        className="absolute inset-0"
        style={veilStyle(r)}
        initial={{ opacity: 0 }}
        animate={{ opacity: r.overlay }}
        exit={{ opacity: 0, transition: { duration: t.exit, ease: EASE_STANDARD } }}
        transition={tween(0, t.veil)}
      />
      {t.confetti && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: t.exit, ease: EASE_STANDARD } }}
          transition={tween(0, t.veil)}
        >
          <Confetti r={r} />
        </motion.div>
      )}
      <div className="relative flex w-full flex-col items-center" style={{ gap: lineGap(r.lineGap), transform: r.offsetY ? `translateY(${vh(r.offsetY)})` : undefined }}>
        {t.rule.show && <Hairline r={r} t={t} direction={1} />}
        <div className="flex max-w-full flex-col items-center gap-3 px-6 text-center text-balance uppercase" style={{ fontFamily: r.font }}>
          {r.seat === "hero" && avatars.length > 0 && (
            <div className="flex items-end justify-center gap-4 short:gap-3">
              {avatars.map((avatar, i) => {
                const size = heroSeatSize(avatars.length)
                return (
                  <motion.div
                    key={i}
                    className="relative"
                    initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.7, y: 10 }}
                    animate={calm ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: t.exit * 0.7, ease: EASE_STANDARD } }}
                    transition={
                      calm
                        ? tween(0, t.veil)
                        : { opacity: tween(t.seat.delay + i * 0.08, t.seat.duration), scale: seatMove(t, i), y: seatMove(t, i) }
                    }
                  >
                    <SeatAvatarMark avatar={avatar} theme={seatTheme} size={size} />
                    {crown && (
                      <span className="absolute inset-x-0 top-0 flex -translate-y-[62%] justify-center" style={{ fontSize: CROWN_SIZE[size] }}>
                        <motion.span
                          className="inline-flex"
                          style={{ color: "var(--accent-game)", filter: "drop-shadow(0 0 10px var(--accent-game))" }}
                          initial={calm ? { opacity: 0 } : { opacity: 0, y: -14, rotate: -14, scale: 1.4 }}
                          animate={calm ? { opacity: 1 } : { opacity: 1, y: 0, rotate: 0, scale: 1 }}
                          transition={calm ? tween(0, t.veil) : { ...seatMove(t, i, t.seat.crownDelay), opacity: tween(t.seat.crownDelay + i * 0.08, 0.3) }}
                        >
                          {crown}
                        </motion.span>
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
          <motion.div
            className={cn("max-w-full", inline && "flex items-center justify-center gap-3")}
            initial={title.from}
            animate={title.to}
            exit={{ ...title.out, transition: { duration: t.exit, ease: EASE_STANDARD } }}
            transition={titleTransition}
          >
            {inline && <SeatAvatarMark avatar={inline} theme={seatTheme} size="md" />}
            <h2 style={{ ...textStyle(r), ...letters }}>{text}</h2>
          </motion.div>
          {subtitle && (
            <motion.div
              initial={subtitleTargets.from}
              animate={subtitleTargets.to}
              exit={{ ...subtitleTargets.out, transition: { duration: t.exit * 0.7, ease: EASE_STANDARD } }}
              transition={calm ? tween(0, t.veil) : tween(t.subtitle.delay, t.subtitle.duration)}
            >
              {/* the subtitle carries the winners' nicknames: session recordings show it masked (`ph-mask`) */}
              <p className="ph-mask" style={{ ...textStyle(r), ...letters, fontSize: fontSize(r.subtitleSize) }}>
                {subtitle}
              </p>
            </motion.div>
          )}
        </div>
        {t.rule.show && <Hairline r={r} t={t} direction={-1} />}
      </div>
    </div>
  )
}

/** How a medallion (or its crown) lands: with the title's spring when the game asks for it, else a tween; `i` staggers a tie */
function seatMove(t: AnnouncementTimeline, i: number, lead = t.seat.delay) {
  const delay = lead + i * 0.08
  return t.title.spring ? { type: "spring" as const, stiffness: 180, damping: 14, delay } : tween(delay, t.seat.duration)
}

/**
 * The announcement with the `AnimatePresence` its parts need to play their exit. In a game the HUD mounts and unmounts it; a
 * page that has no `motion` of its own (the specimens of the design docs) flips `show` instead, and the parts leave in order as in a game.
 */
export function AnnouncementPresence({ show, ...view }: AnnouncementViewProps & { show: boolean }) {
  return <AnimatePresence>{show && <AnnouncementView {...view} />}</AnimatePresence>
}
