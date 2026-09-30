import * as binding from "@pbgo/binding"
import { UI_TEXTS, type UiTextKey } from "@pbgo/studio-kit/constants"
import { ERROR_TRANSLATIONS, UI_TRANSLATIONS } from "@pbgo/studio-kit/translations"
import { DEFAULT_LOCALE, type Locale } from "./i18n"

/** Image de décor (URL prête à l'emploi) et son ratio largeur / hauteur, pour caler l'interface dessus. */
export type DecorImage = { url: string; srcSet?: string; ratio: number | null }

/**
 * Habillage d'un jeu : tout ce qui change l'apparence des écrans communs sans toucher au code.
 * Source : Sanity (`interface` + `texts`), puis valeurs par défaut du jeu (`DEFAULT_SKIN` exporté par @pbgo/binding), puis celles de core.
 */
export type Skin = {
  /** Langue dans laquelle cet habillage (textes) a été résolu */
  locale: Locale
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
  locale: DEFAULT_LOCALE,
  decor: { background: null, pattern: null, top: null, bottom: null, hero: null },
  hostIcon: null,
  playerColors: DEFAULT_PLAYER_COLORS,
  desktopOnly: true,
  home: { title: null, intro: null, tagline: null },
  victoryPhrases: ["Victoire de", "Bravo à", "La partie est remportée par", "Champion·ne du jour"],
  texts: DEFAULT_TEXTS,
  errors: {},
}

const VICTORY_PHRASES: Record<Exclude<Locale, "fr">, string[]> = {
  en: ["Victory for", "Congratulations to", "The game is won by", "Champion of the day:"],
  es: ["Victoria de", "Enhorabuena a", "La partida la gana", "Campeón del día:"],
  de: ["Sieg für", "Glückwunsch an", "Die Partie gewinnt", "Champion des Tages:"],
}

/** Ce qu'un jeu fournit pour chaque langue autre que le français : export facultatif `I18N` de @pbgo/binding. */
export type GameI18n = {
  skin?: SkinDefaults
  /** Description par défaut (SEO, partage) */
  description?: string
  /** Auteurs par défaut du pied de page (« un jeu de … ») */
  authors?: string
  /** Messages d'erreur du moteur */
  errors?: Record<string, string>
}

export const gameI18n = (binding as { I18N?: Partial<Record<Locale, GameI18n>> }).I18N ?? {}

/**
 * Habillage de base d'une langue : libellés communs traduits, puis valeurs du jeu. Les textes français du jeu (`DEFAULT_SKIN` du jeu)
 * ne s'appliquent qu'en français ; dans les autres langues, seul `I18N[langue].skin` du jeu compte pour les textes.
 */
export function baseSkin(locale: Locale): Skin {
  const gameDefaults = (binding as { DEFAULT_SKIN?: SkinDefaults }).DEFAULT_SKIN
  if (locale === DEFAULT_LOCALE) return mergeSkin(DEFAULT_SKIN, gameDefaults)
  const generic: Skin = { ...DEFAULT_SKIN, locale, texts: { ...DEFAULT_TEXTS, ...UI_TRANSLATIONS[locale] }, victoryPhrases: VICTORY_PHRASES[locale], errors: ERROR_TRANSLATIONS[locale] }
  const { texts: _t, home: _h, victoryPhrases: _v, errors: _e, ...visual } = gameDefaults ?? {}
  void [_t, _h, _v, _e]
  return mergeSkin(mergeSkin(generic, visual), { ...gameI18n[locale]?.skin, errors: { ...gameI18n[locale]?.skin?.errors, ...gameI18n[locale]?.errors } })
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
