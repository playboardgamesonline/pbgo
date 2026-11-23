// The pure half of a veil, the dark the table is put in so that one thing stands out: how dark, how fast it comes on and how fast it goes. No three.js and no React: `veil.tsx` draws it and `staging.test.ts` holds it.

/** How a veil is unless a game says another: how dark it is (0 to 1), the seconds it takes to come on, the seconds it takes to go, and where it is drawn: how far in front of the camera and in what order, so that what is drawn after it stays lit */
export const VEIL = { opacity: 0.5, fade: 0.2, away: 0.2, distance: 5, order: 10 } as const

/** Where a veil is going and how fast: the darkness it is asked for while it is on and nothing while it is off, and the time it takes to get there (the time constant of the easing, in seconds), which is its own for coming on and for going */
export function veilTarget(active: boolean, { opacity = VEIL.opacity, fade = VEIL.fade, away = VEIL.away }: { opacity?: number; fade?: number; away?: number } = {}): { to: number; time: number } {
  return active ? { to: Math.min(1, Math.max(0, opacity)), time: fade } : { to: 0, time: away }
}
