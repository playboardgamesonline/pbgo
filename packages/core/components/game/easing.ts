/** Courbes d'easing partagées (u de 0 à 1). Utilisées pour les vols de cartes et réglables dans le debug (onglet SCENE → Card → easing). */
const c1 = 1.70158
const c3 = c1 + 1
const c4 = (2 * Math.PI) / 3

export const EASINGS = {
  linear: (u: number) => u,
  /** Départ et arrivée très doux, vitesse quasi constante au milieu : le réglage par défaut des vols de cartes. */
  gentle: (u: number) => u + (u * u * (3 - 2 * u) - u) * 0.55,
  smoothstep: (u: number) => u * u * (3 - 2 * u),
  easeInOutSine: (u: number) => -(Math.cos(Math.PI * u) - 1) / 2,
  easeInOutQuad: (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  easeInOutCubic: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  easeInOutQuart: (u: number) => (u < 0.5 ? 8 * u * u * u * u : 1 - Math.pow(-2 * u + 2, 4) / 2),
  easeInOutQuint: (u: number) => (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2),
  easeInOutExpo: (u: number) => (u === 0 ? 0 : u === 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2),
  easeOutCubic: (u: number) => 1 - Math.pow(1 - u, 3),
  easeOutQuint: (u: number) => 1 - Math.pow(1 - u, 5),
  easeOutBack: (u: number) => 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2),
  easeInOutBack: (u: number) => (u < 0.5 ? (Math.pow(2 * u, 2) * ((c1 * 1.525 + 1) * 2 * u - c1 * 1.525)) / 2 : (Math.pow(2 * u - 2, 2) * ((c1 * 1.525 + 1) * (u * 2 - 2) + c1 * 1.525) + 2) / 2),
  easeOutElastic: (u: number) => (u === 0 ? 0 : u === 1 ? 1 : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * c4) + 1),
} as const

export type EasingName = keyof typeof EASINGS
export const EASING_NAMES = Object.keys(EASINGS) as EasingName[]
export const DEFAULT_EASING: EasingName = "gentle"

export function ease(name: string, u: number): number {
  return (EASINGS[name as EasingName] ?? EASINGS[DEFAULT_EASING])(u)
}
