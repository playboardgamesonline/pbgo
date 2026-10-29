"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Suit, type SuitName } from "@pbgo/ui/platform/suits"
import { CoinSides } from "@pbgo/ui/platform/title-coin"
import { DieCube } from "@pbgo/ui/platform/title-die"

// A lab for the way the pieces of the home's title move: for each piece, several ways of doing the same thing, each with its easing, its duration and what it adds (a wind-up, a hop, a squash, a settle on a spring), side by
// side on a stage that is the hero's, so that the one that is right can be chosen by eye and its values written into the guidelines (`docs/design-system.md`, `@pbgo/ui/motion`). Every card plays its move, rests, and plays it
// again; "Replay" plays it now. The pieces are the real ones (`DieCube`, `CoinSides`, the suits of `Suit`), driven here by motion values instead of by their own timers.

type Transition = Record<string, unknown>
/** Moves a motion value, and says when it is there. Everything it starts can be stopped, so that a replay starts from a clean state. */
type Anim = (value: MotionValue<number>, to: number | number[], transition: Transition) => Promise<void>

type Variant<Handles> = {
  id: string
  name: string
  /** What it feels like, and what the page does today when it is the one that is now. */
  note: string
  /** The parts of the move and the values they take: [what, how]. */
  specs: readonly (readonly [string, string])[]
  play: (handles: Handles, anim: Anim) => Promise<void>
}

const wait = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000))

/** Plays a move, waits, and plays it again for as long as `loop` is on; `run` and `token` start it over (a replay of this card, a replay of all of them). */
function useLoop(play: (anim: Anim) => Promise<void>, rest: () => void, options: { loop: boolean; enabled: boolean; token: number; run: number; delay: number }) {
  const { loop, enabled, token, run, delay } = options
  React.useEffect(() => {
    if (!enabled) return
    let alive = true
    const running = new Set<AnimationPlaybackControls>()
    const anim: Anim = (value, to, transition) => {
      const controls = animate(value, to as never, transition as never)
      running.add(controls)
      return controls.then(() => {
        running.delete(controls)
      })
    }
    void (async () => {
      await wait(delay)
      while (alive) {
        rest()
        await play(anim)
        if (!alive || !loop) return
        await wait(1.6)
      }
    })()
    return () => {
      alive = false
      running.forEach((controls) => controls.stop())
      running.clear()
    }
  }, [play, rest, loop, enabled, token, run, delay])
}

// ———————————————————————————————— the die

type DieHandles = { angle: MotionValue<number>; lift: MotionValue<number>; sx: MotionValue<number>; sy: MotionValue<number> }

/** Where the page lands: three turns and a quarter, on the next side. */
const ROLL = 3 * 360 + 90
const SQUASH = { type: "spring", stiffness: 420, damping: 11 }

const DIE: readonly Variant<DieHandles>[] = [
  {
    id: "A",
    name: "Friction",
    note: "What the page does now: a quick start, then the same slowing at every moment. Nothing else moves: steady, and a little monotone.",
    specs: [["roll", "cubic-bezier(0.5, 1, 0.89, 1) · 3.9 s"]],
    play: async ({ angle }, anim) => {
      await anim(angle, angle.get() + ROLL, { duration: 3.9, ease: [0.5, 1, 0.89, 1] })
    },
  },
  {
    id: "B",
    name: "Wind-up and settle",
    note: "It leans back before it goes, flies past its place by a few degrees and settles on a spring: it has weight.",
    specs: [
      ["wind-up", "−22° · 0.22 s · cubic-bezier(0.2, 0, 0, 1)"],
      ["roll", "cubic-bezier(0.22, 1, 0.36, 1) · 2.7 s · 12° past"],
      ["settle", "spring · stiffness 240 · damping 13"],
    ],
    play: async ({ angle }, anim) => {
      const from = angle.get()
      await anim(angle, from - 22, { duration: 0.22, ease: [0.2, 0, 0, 1] })
      await anim(angle, from + ROLL + 12, { duration: 2.7, ease: [0.22, 1, 0.36, 1] })
      await anim(angle, from + ROLL, { type: "spring", stiffness: 240, damping: 13 })
    },
  },
  {
    id: "C",
    name: "Hop",
    note: "It jumps while it rolls: stretched going up, squashed when it lands, one small bounce, and the roll goes on.",
    specs: [
      ["roll", "cubic-bezier(0.65, 0, 0.35, 1) · 2.2 s"],
      ["hop", "0.2em up · 0.4 s cubic-bezier(0.2, 0.8, 0.3, 1), down 0.36 s cubic-bezier(0.7, 0, 1, 0.7)"],
      ["stretch / squash", "y 1.1, x 0.94 going up · y 0.82, x 1.16 on landing · spring stiffness 420, damping 11"],
    ],
    play: async ({ angle, lift, sx, sy }, anim) => {
      const roll = anim(angle, angle.get() + ROLL, { duration: 2.2, ease: [0.65, 0, 0.35, 1] })
      await Promise.all([anim(lift, 0.2, { duration: 0.4, ease: [0.2, 0.8, 0.3, 1] }), anim(sy, 1.1, { duration: 0.4 }), anim(sx, 0.94, { duration: 0.4 })])
      await anim(lift, 0, { duration: 0.36, ease: [0.7, 0, 1, 0.7] })
      await Promise.all([anim(sy, 0.82, { duration: 0.07 }), anim(sx, 1.16, { duration: 0.07 })])
      void anim(lift, [0, 0.05, 0], { duration: 0.3, ease: "easeOut" })
      await Promise.all([anim(sy, 1, SQUASH), anim(sx, 1, SQUASH)])
      await roll
    },
  },
  {
    id: "D",
    name: "Spring",
    note: "No easing curve: one spring pushes it round and lets it wobble past its place, with a pop of size as it leaves.",
    specs: [
      ["roll", "spring · duration 2.6 s · bounce 0.3"],
      ["pop", "scale 1 → 1.14 → 1 · 0.5 s · ease-in-out"],
    ],
    play: async ({ angle, sx, sy }, anim) => {
      const roll = anim(angle, angle.get() + ROLL, { type: "spring", duration: 2.6, bounce: 0.3 })
      await Promise.all([anim(sx, [1, 1.14, 1], { duration: 0.5, ease: "easeInOut" }), anim(sy, [1, 1.14, 1], { duration: 0.5, ease: "easeInOut" })])
      await roll
    },
  },
  {
    id: "E",
    name: "Expo snap",
    note: "Slow to wake up, then all at once, then a long gentle stop; it swells as it flies, like something thrown at you.",
    specs: [
      ["roll", "cubic-bezier(0.87, 0, 0.13, 1) · 1.9 s"],
      ["swell", "scale 1 → 1.22 → 1 · 1.9 s · ease-in-out"],
    ],
    play: async ({ angle, sx, sy }, anim) => {
      await Promise.all([
        anim(angle, angle.get() + ROLL, { duration: 1.9, ease: [0.87, 0, 0.13, 1] }),
        anim(sx, [1, 1.22, 1], { duration: 1.9, ease: "easeInOut" }),
        anim(sy, [1, 1.22, 1], { duration: 1.9, ease: "easeInOut" }),
      ])
    },
  },
]

// ———————————————————————————————— the coin

type CoinHandles = { angle: MotionValue<number>; wobble: MotionValue<number>; scale: MotionValue<number> }

/** Where the page lands: five whole turns, top to bottom. */
const SPIN = 5 * 360

const COIN: readonly Variant<CoinHandles>[] = [
  {
    id: "A",
    name: "Friction",
    note: "What the page does now: five turns, a quick start and a long slowing. Slow, calm, and all the same from the first turn to the last.",
    specs: [["spin", "cubic-bezier(0.5, 1, 0.89, 1) · 8.3 s"]],
    play: async ({ angle }, anim) => {
      await anim(angle, angle.get() - SPIN, { duration: 8.3, ease: [0.5, 1, 0.89, 1] })
    },
  },
  {
    id: "B",
    name: "Flick and rock",
    note: "A flick that is over sooner, and a coin that falls flat with a rocking, like a real one on a table.",
    specs: [
      ["spin", "cubic-bezier(0.22, 0.8, 0.32, 1) · 4.2 s · 16° past"],
      ["rock", "spring · stiffness 140 · damping 5"],
    ],
    play: async ({ angle }, anim) => {
      const to = angle.get() - SPIN
      await anim(angle, to - 16, { duration: 4.2, ease: [0.22, 0.8, 0.32, 1] })
      await anim(angle, to, { type: "spring", stiffness: 140, damping: 5 })
    },
  },
  {
    id: "C",
    name: "Spin-down wobble",
    note: "As it slows it starts to wobble, more and more, and then settles: the way a coin spun on its edge ends.",
    specs: [
      ["spin", "cubic-bezier(0.4, 0.6, 0.35, 1) · 6.4 s"],
      ["wobble", "±5° growing to ±27° around the vertical · the last third of the spin · linear keyframes"],
    ],
    play: async ({ angle, wobble }, anim) => {
      await Promise.all([
        anim(angle, angle.get() - SPIN, { duration: 6.4, ease: [0.4, 0.6, 0.35, 1] }),
        anim(wobble, [0, 4, -5, 8, -10, 13, -17, 22, -27, 21, -14, 8, -3, 0], {
          duration: 6.4,
          ease: "linear",
          times: [0, 0.34, 0.5, 0.61, 0.69, 0.75, 0.8, 0.85, 0.89, 0.93, 0.96, 0.98, 0.99, 1],
        }),
      ])
    },
  },
  {
    id: "D",
    name: "Toss pulse",
    note: "It dips as if gathering itself, swells toward you at the top of the toss, and lands with a squash. Symmetric: it speeds up as much as it slows down.",
    specs: [
      ["spin", "cubic-bezier(0.65, 0, 0.35, 1) · 3.6 s"],
      ["pulse", "scale 1 → 0.93 → 1.2 → 1 · 3.6 s · ease-in-out"],
      ["landing", "scale 0.9 · 0.06 s, then spring stiffness 420, damping 11"],
    ],
    play: async ({ angle, scale }, anim) => {
      await Promise.all([
        anim(angle, angle.get() - SPIN, { duration: 3.6, ease: [0.65, 0, 0.35, 1] }),
        anim(scale, [1, 0.93, 1.2, 1], { duration: 3.6, times: [0, 0.08, 0.5, 1], ease: "easeInOut" }),
      ])
      await anim(scale, 0.9, { duration: 0.06 })
      await anim(scale, 1, SQUASH)
    },
  },
  {
    id: "E",
    name: "Snap and bounce",
    note: "Short and punchy: it is gone in a blink and lands with a bounce.",
    specs: [
      ["spin", "cubic-bezier(0.16, 1, 0.3, 1) · 2.6 s · 24° past"],
      ["bounce", "spring · stiffness 300 · damping 9"],
    ],
    play: async ({ angle }, anim) => {
      const to = angle.get() - SPIN
      await anim(angle, to - 24, { duration: 2.6, ease: [0.16, 1, 0.3, 1] })
      await anim(angle, to, { type: "spring", stiffness: 300, damping: 9 })
    },
  },
]

// ———————————————————————————————— the suits

/** One suit of the reel: how far it is from its place (in ems), how big, how stretched, how turned and how clear. */
type Layer = { y: MotionValue<number>; s: MotionValue<number>; sy: MotionValue<number>; r: MotionValue<number>; o: MotionValue<number> }
type ReelHandles = { out: Layer; in: Layer }

/** How far a suit goes to be out of the window: a bit more than its height. */
const TRAVEL = 0.72
const SUITS: readonly SuitName[] = ["heart", "spade", "diamond", "club"]

const showLayer = (layer: Layer) => {
  layer.y.set(0)
  layer.s.set(1)
  layer.sy.set(1)
  layer.r.set(0)
  layer.o.set(1)
}
const parkLayer = (layer: Layer) => {
  layer.y.set(TRAVEL)
  layer.s.set(1)
  layer.sy.set(1)
  layer.r.set(0)
  layer.o.set(1)
}

const POP = { type: "spring", stiffness: 420, damping: 15, delay: 0.14 }
const TILT = { duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }
const PULL = { duration: 0.95, ease: [0.68, -0.55, 0.27, 1.55] }

const REEL: readonly Variant<ReelHandles>[] = [
  {
    id: "A",
    name: "Reel",
    note: "What the page does now: the old one goes up as the new one comes from below, the same curve both ways. Clean, a bit mechanical.",
    specs: [["both", "cubic-bezier(0.42, 0, 0.58, 1) · 0.8 s"]],
    play: async (h, anim) => {
      parkLayer(h.in)
      await Promise.all([anim(h.out.y, -TRAVEL, { duration: 0.8, ease: [0.42, 0, 0.58, 1] }), anim(h.in.y, 0, { duration: 0.8, ease: [0.42, 0, 0.58, 1] })])
    },
  },
  {
    id: "B",
    name: "Reel and overshoot",
    note: "The old one leaves fast and stretched; the new one comes in on a spring, goes a little past its place and settles.",
    specs: [
      ["out", "cubic-bezier(0.5, 0, 1, 0.6) · 0.45 s · stretch y 1 → 1.18"],
      ["in", "spring · duration 0.7 s · bounce 0.35 · stretch y 1.15 → 1"],
    ],
    play: async (h, anim) => {
      parkLayer(h.in)
      h.in.sy.set(1.15)
      await Promise.all([
        anim(h.out.y, -TRAVEL, { duration: 0.45, ease: [0.5, 0, 1, 0.6] }),
        anim(h.out.sy, 1.18, { duration: 0.45, ease: "easeIn" }),
        anim(h.in.y, 0, { type: "spring", duration: 0.7, bounce: 0.35 }),
        anim(h.in.sy, 1, { type: "spring", duration: 0.7, bounce: 0.35 }),
      ])
    },
  },
  {
    id: "C",
    name: "Slot pull",
    note: "They pull back first, shoot, and overshoot, stretched at the fastest, like the reel of a slot machine.",
    specs: [
      ["both", "cubic-bezier(0.68, −0.55, 0.27, 1.55) · 0.95 s"],
      ["stretch", "y 1 → 1.3 → 1 · 0.95 s · ease-in-out"],
    ],
    play: async (h, anim) => {
      parkLayer(h.in)
      await Promise.all([
        anim(h.out.y, -TRAVEL, PULL),
        anim(h.in.y, 0, PULL),
        anim(h.out.sy, [1, 1.3, 1], { duration: 0.95, ease: "easeInOut" }),
        anim(h.in.sy, [1, 1.3, 1], { duration: 0.95, ease: "easeInOut" }),
      ])
    },
  },
  {
    id: "D",
    name: "Pop",
    note: "No reel: the old one shrinks and floats away, the new one pops in from small, turned, on a springy overshoot.",
    specs: [
      ["out", "cubic-bezier(0.5, 0, 1, 0.5) · 0.28 s · scale → 0.2 · 0.25em up · fades"],
      ["in", "spring · stiffness 420 · damping 15 · after 0.14 s · from scale 0.2, −24°, 0.18em low"],
    ],
    play: async (h, anim) => {
      parkLayer(h.in)
      h.in.y.set(0.18)
      h.in.s.set(0.2)
      h.in.r.set(-24)
      h.in.o.set(0)
      const leave = { duration: 0.28, ease: [0.5, 0, 1, 0.5] }
      await Promise.all([
        anim(h.out.o, 0, leave),
        anim(h.out.s, 0.2, leave),
        anim(h.out.y, -0.25, leave),
        anim(h.in.o, 1, { duration: 0.12, delay: 0.14 }),
        anim(h.in.s, 1, POP),
        anim(h.in.y, 0, POP),
        anim(h.in.r, 0, POP),
      ])
    },
  },
  {
    id: "E",
    name: "Tilt reel",
    note: "A reel, but they turn as they travel: the old one tips away, the new one rights itself with a little overshoot.",
    specs: [
      ["out", "cubic-bezier(0.4, 0, 1, 1) · 0.55 s · 18° as it goes"],
      ["in", "cubic-bezier(0.34, 1.56, 0.64, 1) · 0.75 s · from −18°"],
    ],
    play: async (h, anim) => {
      parkLayer(h.in)
      h.in.r.set(-18)
      const leave = { duration: 0.55, ease: [0.4, 0, 1, 1] }
      await Promise.all([anim(h.out.y, -TRAVEL, leave), anim(h.out.r, 18, leave), anim(h.in.y, 0, TILT), anim(h.in.r, 0, TILT)])
    },
  },
]

// ———————————————————————————————— the cards

type CardProps<Handles> = { variant: Variant<Handles>; loop: boolean; token: number; delay: number }

/** One variant: its stage, its name, what it feels like and the values it is made of. */
function Frame<Handles>({ variant, onReplay, children }: { variant: Variant<Handles>; onReplay: () => void; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-3xl border bg-card p-3">
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-(--wood-2)">
        <p aria-hidden="true" className="display-title text-[5.5rem] leading-none text-foreground">
          {children}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 px-1">
        <h4 className="flex items-center gap-2 font-heading text-base">
          <Badge variant="secondary">{variant.id}</Badge>
          {variant.name}
        </h4>
        <Button type="button" variant="outline" size="sm" onClick={onReplay}>
          Replay
        </Button>
      </div>
      <p className="px-1 text-sm text-muted-foreground">{variant.note}</p>
      <dl className="flex flex-col gap-1.5 px-1 font-mono text-xs tracking-normal">
        {variant.specs.map(([what, how]) => (
          <div key={what} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{what}</dt>
            <dd className="text-foreground">
              {/* Each part of a value stays on one line (a curve is not cut at its hyphen), and the line breaks between the parts */}
              {how.split(" · ").map((part, index) => (
                <React.Fragment key={part}>
                  {index > 0 && " · "}
                  <span className={part.length > 40 ? undefined : "whitespace-nowrap"}>{part}</span>
                </React.Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function useRun(token: number) {
  const reduced = useReducedMotion()
  const [run, setRun] = React.useState(0)
  return { run, replay: () => setRun((value) => value + 1), enabled: !reduced || run > 0 || token > 0 }
}

function DieCard({ variant, loop, token, delay }: CardProps<DieHandles>) {
  const angle = useMotionValue(0)
  const lift = useMotionValue(0)
  const sx = useMotionValue(1)
  const sy = useMotionValue(1)
  const handles = React.useMemo(() => ({ angle, lift, sx, sy }), [angle, lift, sx, sy])
  const play = React.useCallback((anim: Anim) => variant.play(handles, anim), [variant, handles])
  const rest = React.useCallback(() => {
    angle.set(angle.get() % 360)
    lift.set(0)
    sx.set(1)
    sy.set(1)
  }, [angle, lift, sx, sy])
  const { run, replay, enabled } = useRun(token)
  useLoop(play, rest, { loop, enabled, token, run, delay })
  return (
    <Frame variant={variant} onReplay={replay}>
      y
      <span data-slot="title-piece" data-kind="die" className="title-piece">
        <DieCube angle={angle} lift={lift} scaleX={sx} scaleY={sy} />
      </span>
      u
    </Frame>
  )
}

function CoinCard({ variant, loop, token, delay }: CardProps<CoinHandles>) {
  const angle = useMotionValue(0)
  const wobble = useMotionValue(0)
  const scale = useMotionValue(1)
  const handles = React.useMemo(() => ({ angle, wobble, scale }), [angle, wobble, scale])
  const play = React.useCallback((anim: Anim) => variant.play(handles, anim), [variant, handles])
  const rest = React.useCallback(() => {
    angle.set(angle.get() % 360)
    wobble.set(0)
    scale.set(1)
  }, [angle, wobble, scale])
  const { run, replay, enabled } = useRun(token)
  useLoop(play, rest, { loop, enabled, token, run, delay })
  return (
    <Frame variant={variant} onReplay={replay}>
      b
      <span data-slot="title-piece" data-kind="coin" className="title-piece">
        <CoinSides angle={angle} wobble={wobble} scale={scale} />
      </span>
      a
    </Frame>
  )
}

function useLayer(): Layer {
  const y = useMotionValue(0)
  const s = useMotionValue(1)
  const sy = useMotionValue(1)
  const r = useMotionValue(0)
  const o = useMotionValue(1)
  // One object for as long as the card lives: the loop starts over when what it plays with changes
  return React.useMemo(() => ({ y, s, sy, r, o }), [y, s, sy, r, o])
}

/** A suit in the window of the reel, placed by the motion values of its layer. */
function ReelSuit({ layer, suit }: { layer: Layer; suit: SuitName }) {
  const y = useTransform(layer.y, (ems) => `${ems}em`)
  return (
    <motion.span className="absolute -top-[10%] -left-[10%] block h-[120%] w-[120%]" style={{ y, scale: layer.s, scaleY: layer.sy, rotate: layer.r, opacity: layer.o }}>
      <Suit suit={suit} className="size-full" style={{ fill: suit === "spade" || suit === "club" ? "var(--piece-black)" : "var(--piece-red)" }} />
    </motion.span>
  )
}

function ReelCard({ variant, loop, token, delay }: CardProps<ReelHandles>) {
  const first = useLayer()
  const second = useLayer()
  const [shown, setShown] = React.useState<readonly [number, number]>([0, 1])
  const step = React.useRef(0)
  const play = React.useCallback(
    async (anim: Anim) => {
      const firstIsOut = step.current % 2 === 0
      const next = (step.current + 1) % SUITS.length
      // The layer that comes in is out of the window, so it can take the next suit without anyone seeing it change
      setShown((current) => (firstIsOut ? [current[0], next] : [next, current[1]]))
      await variant.play(firstIsOut ? { out: first, in: second } : { out: second, in: first }, anim)
      step.current += 1
    },
    [variant, first, second]
  )
  const rest = React.useCallback(() => {
    const firstIsOut = step.current % 2 === 0
    showLayer(firstIsOut ? first : second)
    parkLayer(firstIsOut ? second : first)
  }, [first, second])
  const { run, replay, enabled } = useRun(token)
  useLoop(play, rest, { loop, enabled, token, run, delay })
  return (
    <Frame variant={variant} onReplay={replay}>
      v
      <span data-slot="title-piece" data-kind="reel" className="title-piece h-[0.58em] w-[0.62em] align-[-0.005em] [clip-path:inset(-10%)]">
        <ReelSuit layer={first} suit={SUITS[shown[0]]} />
        <ReelSuit layer={second} suit={SUITS[shown[1]]} />
      </span>
      r
    </Frame>
  )
}

function Group({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-xl">{title}</h3>
        <p className="max-w-reading text-sm text-muted-foreground">{intro}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

/** The lab: the three pieces, five ways each. */
export function TitleMotionLab() {
  const [loop, setLoop] = React.useState(true)
  const [token, setToken] = React.useState(0)
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={loop ? "default" : "outline"} onClick={() => setLoop((value) => !value)}>
          Loop: {loop ? "on" : "off"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setToken((value) => value + 1)}>
          Replay all
        </Button>
        <p className="text-sm text-muted-foreground">Each card plays, rests a moment and plays again. Say which letter you keep for each piece.</p>
      </div>
      <Group title="The die" intro="Rolls from the left to the right, three turns and a quarter, and lands on the next side. Every roll here is the same size, so the times can be compared.">
        {DIE.map((variant, index) => (
          <DieCard key={variant.id} variant={variant} loop={loop} token={token} delay={index * 0.2} />
        ))}
      </Group>
      <Group title="The coin" intro="Five whole turns from the top to the bottom, then the profile on top again. The long ones are the real length: a coin that spins for eight seconds is slow on purpose.">
        {COIN.map((variant, index) => (
          <CoinCard key={variant.id} variant={variant} loop={loop} token={token} delay={index * 0.2} />
        ))}
      </Group>
      <Group title="The suits" intro="The suit that is shown goes out by the top and the next one comes in from the bottom, red then black. Same window, same distance: only the easing and the duration change.">
        {REEL.map((variant, index) => (
          <ReelCard key={variant.id} variant={variant} loop={loop} token={token} delay={index * 0.2} />
        ))}
      </Group>
    </div>
  )
}
