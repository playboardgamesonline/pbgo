"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { readSoundLevels } from "../../lib/sound"

/**
 * Animation du bouton de son : des formes qui réagissent à la musique (analyseur audio) quand le son est actif,
 * et qui s'endorment quand il est coupé. Plusieurs propositions, choisies dans le debug (GAME → Sound button) :
 * copier les valeurs puis figer `variant` dans SOUND_VISUAL.
 */
export const SOUND_VARIANTS = ["bars", "mirror", "wave", "dots", "pulse", "ring"] as const
export type SoundVariant = (typeof SOUND_VARIANTS)[number]

export const SOUND_VISUAL = {
  variant: "bars" as SoundVariant,
  bars: 5,
  sensitivity: 1.6,
  smoothing: 0.25,
  thickness: 2.4,
  idle: 0.22,
  color: "#ffffff",
}

let version = 0
const listeners = new Set<() => void>()
export function notifySoundVisual() {
  version++
  listeners.forEach((f) => f())
}
function useVersion() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => version,
    () => 0,
  )
}

export function SoundWaves({ on, size = 28 }: { on: boolean; size?: number }) {
  useVersion()
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef({ on, levels: [] as number[], energy: 0 })
  state.current.on = on

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    el.width = size * ratio
    el.height = size * ratio
    const g = el.getContext("2d")!
    g.scale(ratio, ratio)
    let id = 0
    const loop = (now: number) => {
      const o = SOUND_VISUAL
      const n = Math.max(3, Math.round(o.bars))
      const st = state.current
      const audio = st.on ? readSoundLevels(n) : null
      const t = now / 1000
      const levels = Array.from({ length: n }, (_, i) => {
        if (!st.on) return 0
        const live = audio && !audio.silent ? Math.min(1, (audio.levels[i] ?? 0) * o.sensitivity) : 0
        // sans audio audible (musique coupée ou pas encore chargée) : un léger souffle pour que le bouton reste vivant
        const breath = 0.18 + 0.12 * Math.sin(t * 2.3 + i * 1.3) + 0.08 * Math.sin(t * 4.1 + i * 2.1)
        return audio && !audio.silent ? live : breath
      })
      st.levels = levels.map((v, i) => (st.levels[i] ?? 0) + (v - (st.levels[i] ?? 0)) * o.smoothing)
      st.energy += ((st.on ? st.levels.reduce((a, b) => a + b, 0) / n : 0) - st.energy) * 0.2
      g.clearRect(0, 0, size, size)
      g.fillStyle = g.strokeStyle = o.color
      g.lineCap = "round"
      g.lineWidth = o.thickness
      g.globalAlpha = st.on ? 1 : 0.55
      const pad = size * 0.12
      const w = size - pad * 2
      const cy = size / 2
      const amp = (i: number) => (st.on ? Math.max(o.idle * 0.3, st.levels[i] ?? 0) : o.idle * 0.25)
      switch (o.variant) {
        case "bars":
        case "mirror": {
          const gap = w / n
          for (let i = 0; i < n; i++) {
            const x = pad + gap * (i + 0.5)
            const h = Math.max(o.thickness, amp(i) * size * 0.78)
            g.beginPath()
            if (o.variant === "bars") {
              g.moveTo(x, size - pad)
              g.lineTo(x, size - pad - h)
            } else {
              g.moveTo(x, cy - h / 2)
              g.lineTo(x, cy + h / 2)
            }
            g.stroke()
          }
          break
        }
        case "wave": {
          g.beginPath()
          const steps = 40
          for (let k = 0; k <= steps; k++) {
            const u = k / steps
            const i = Math.min(n - 1, Math.floor(u * n))
            const a = st.on ? Math.max(0.04, st.levels[i] ?? 0) : 0
            const y = cy + Math.sin(u * Math.PI * 3 + t * (st.on ? 6 : 0)) * a * size * 0.42 * Math.sin(Math.PI * u)
            k === 0 ? g.moveTo(pad + u * w, y) : g.lineTo(pad + u * w, y)
          }
          g.stroke()
          break
        }
        case "dots": {
          const gap = w / n
          for (let i = 0; i < n; i++) {
            const x = pad + gap * (i + 0.5)
            const y = cy - (st.on ? amp(i) - 0.15 : 0) * size * 0.45
            g.beginPath()
            g.arc(x, y, o.thickness * (0.7 + (st.on ? amp(i) : 0) * 0.9), 0, Math.PI * 2)
            g.fill()
          }
          break
        }
        case "pulse": {
          const r = size * (0.2 + st.energy * 0.34)
          g.beginPath()
          g.arc(size / 2, cy, Math.max(o.thickness, r), 0, Math.PI * 2)
          g.fill()
          g.globalAlpha = (st.on ? 0.5 : 0.2) * (1 - Math.min(1, st.energy))
          g.beginPath()
          g.arc(size / 2, cy, size * 0.46, 0, Math.PI * 2)
          g.stroke()
          break
        }
        case "ring": {
          const R = size * 0.3
          for (let i = 0; i < n * 2; i++) {
            const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
            const v = amp(i % n)
            const inner = R * 0.85
            const outer = R * 0.85 + Math.max(o.thickness * 0.6, v * size * 0.3)
            g.beginPath()
            g.moveTo(size / 2 + Math.cos(a) * inner, cy + Math.sin(a) * inner)
            g.lineTo(size / 2 + Math.cos(a) * outer, cy + Math.sin(a) * outer)
            g.stroke()
          }
          break
        }
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [size])

  return <canvas ref={canvas} aria-hidden style={{ width: size, height: size }} className="drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]" />
}
