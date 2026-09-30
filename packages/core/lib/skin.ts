import { UI_TEXTS, type UiTextKey } from "@pgo/studio-kit/constants"

/** Image de décor (URL prête à l'emploi) et son ratio largeur / hauteur, pour caler l'interface dessus. */
export type DecorImage = { url: string; srcSet?: string; ratio: number | null }

/**
 * Habillage d'un jeu : tout ce qui change l'apparence des écrans communs sans toucher au code.
 * Source : Sanity (`interface` + `texts`), puis valeurs par défaut du jeu (`DEFAULT_SKIN` exporté par @pgo/binding), puis celles de core.
 */
export type Skin = {
  decor: {
    background: string | null
    pattern: string | null
    top: DecorImage | null
    bottom: DecorImage | null
    hero: string | null
  }
  hostIcon: string | null
  playerColors: string[]
  desktopOnly: boolean
  home: { title: string | null; intro: string | null; tagline: string | null }
  victoryPhrases: string[]
  texts: UiTexts
  /** Messages d'erreur remplacés dans l'admin (code → message) */
  errors: Record<string, string>
}

export type UiTexts = Record<UiTextKey, string>

export type SkinDefaults = Partial<Omit<Skin, "decor" | "texts" | "home" | "errors">> & {
  errors?: Record<string, string>
  decor?: Partial<Skin["decor"]>
  texts?: Partial<UiTexts>
  home?: Partial<Skin["home"]>
}

export const DEFAULT_TEXTS = Object.fromEntries(UI_TEXTS.map((t) => [t.key, t.fr])) as UiTexts

export const DEFAULT_PLAYER_COLORS = ["#e8795a", "#9d8cf2", "#e56fa4", "#6fb4e5", "#e8b43a", "#6fd3a8"]

export const DEFAULT_SKIN: Skin = {
  decor: { background: null, pattern: null, top: null, bottom: null, hero: null },
  hostIcon: null,
  playerColors: DEFAULT_PLAYER_COLORS,
  desktopOnly: true,
  home: { title: null, intro: null, tagline: null },
  victoryPhrases: ["Victoire de", "Bravo à", "La partie est remportée par", "Champion·ne du jour"],
  texts: DEFAULT_TEXTS,
  errors: {},
}

/** Remplace les variables `{nom}` d'un libellé. */
export function fill(text: string, params: Record<string, string | number> = {}) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
}

export function mergeSkin(base: Skin, over: SkinDefaults | undefined): Skin {
  if (!over) return base
  return {
    ...base,
    ...Object.fromEntries(Object.entries(over).filter(([k, v]) => v != null && !["decor", "texts", "home", "errors"].includes(k))),
    decor: { ...base.decor, ...Object.fromEntries(Object.entries(over.decor ?? {}).filter(([, v]) => v != null)) },
    home: { ...base.home, ...Object.fromEntries(Object.entries(over.home ?? {}).filter(([, v]) => v != null)) },
    texts: { ...base.texts, ...Object.fromEntries(Object.entries(over.texts ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) },
    errors: { ...base.errors, ...Object.fromEntries(Object.entries(over.errors ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) },
  }
}
