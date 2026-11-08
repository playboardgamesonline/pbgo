import type { UiTextKey } from "@pbgo/studio-kit/constants"
import { ERROR_TRANSLATIONS, UI_TRANSLATIONS } from "@pbgo/studio-kit/translations"
import type { GameBinding } from "./binding"
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./i18n"
import { missing } from "./missing"

/** Decor image (ready-to-use URL) and its width / height ratio, to fit the interface on it. */
export type DecorImage = { url: string; srcSet?: string; ratio: number | null }

/**
 * Skin of a game: everything that changes the look of the shared screens without touching code.
 * Source: Sanity (`interface` + `texts`), then the behaviour the game declares (`DEFAULT_SKIN` of its binding: no text, no image), then core's chrome.
 * A required text that Sanity does not hold yet reads `[missing: <key>]` (`lib/missing.ts`).
 */
export type Skin = {
  /** Language in which this skin (texts) was resolved */
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
  victoryPhrases: string[]
  texts: UiTexts
  /** Error messages replaced in the admin (code → message) */
  errors: Record<string, string>
  /** The words of the engine's options, presets and score lines, written in Sanity (key → text; the keys are those of `engineTextKeys` in engine-kit) */
  engineTexts: Record<string, string>
}

export type UiTexts = Record<UiTextKey, string>

export type SkinDefaults = Partial<Omit<Skin, "decor" | "texts" | "errors" | "engineTexts">> & {
  errors?: Record<string, string>
  engineTexts?: Record<string, string>
  decor?: Partial<Skin["decor"]>
  texts?: Partial<UiTexts>
}

/**
 * What a game declares in `DEFAULT_SKIN`: how its skin behaves (player colours, desktop only), never a text and never an image.
 * Texts and their translations come from Sanity (`texts`), pictures from Sanity (`interface`), so a missing one shows as missing
 * instead of being covered by a copy in the code.
 */
export type GameSkinDefaults = Partial<Pick<Skin, "playerColors" | "desktopOnly">>

/** The platform's chrome in the default language, English: the base of every skin, which a language of the games then replaces with its own translations. */
export const DEFAULT_TEXTS: UiTexts = UI_TRANSLATIONS[DEFAULT_LOCALE]

export const DEFAULT_PLAYER_COLORS = ["#e8795a", "#9d8cf2", "#e56fa4", "#6fb4e5", "#e8b43a", "#6fd3a8"]

/**
 * The skin of a game that Sanity holds nothing for, in the default language (English): the platform's chrome (`UI_TRANSLATIONS`) and the behaviour defaults.
 * A game's own texts are not in it: the victory sentences read `[missing: <key>]` until Sanity has them.
 */
export const DEFAULT_SKIN: Skin = {
  locale: DEFAULT_LOCALE,
  decor: { background: null, pattern: null, top: null, bottom: null, hero: null },
  hostIcon: null,
  playerColors: DEFAULT_PLAYER_COLORS,
  desktopOnly: true,
  victoryPhrases: [missing("victoryPhrases")],
  texts: DEFAULT_TEXTS,
  errors: {},
  engineTexts: {},
}

/**
 * Base skin of a language: the platform's chrome in that language, then the behaviour the game declares. Nothing of the game's
 * texts: they come from Sanity only, in the visitor's language.
 */
export function baseSkin(binding: GameBinding, locale: Locale): Skin {
  const base: Skin =
    locale === DEFAULT_LOCALE ? DEFAULT_SKIN : { ...DEFAULT_SKIN, locale, texts: { ...DEFAULT_TEXTS, ...UI_TRANSLATIONS[locale] }, errors: ERROR_TRANSLATIONS[locale] }
  return mergeSkin(base, binding.DEFAULT_SKIN)
}

/** Labels of the credits line of the footer of the game's screens (« Unofficial, free online adaptation of … »), shown by the admin's Identity preview. */
export const CREDIT_KEYS = ["creditsAdaptation", "creditsBy", "creditsPublishedBy", "creditsRightsPublisher", "creditsRights", "developedBy"] as const satisfies readonly UiTextKey[]

export type CreditTexts = Record<(typeof CREDIT_KEYS)[number], string>

/** The credits labels of a game in every language, plain data that a server page can hand to the client. */
export function creditTexts(binding: GameBinding): Record<Locale, CreditTexts> {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const { texts } = baseSkin(binding, locale)
      return [locale, Object.fromEntries(CREDIT_KEYS.map((key) => [key, texts[key]]))]
    }),
  ) as Record<Locale, CreditTexts>
}

/** Replaces the `{name}` variables of a label. */
export function fill(text: string, params: Record<string, string | number> = {}) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
}

/**
 * The words of one of the engine's options, presets or score lines: the game's Sanity, else the words its engine still carries (`legacy`, for a game that has not moved them), else the marker
 * of a missing text. `params` fills the variables (`Round {n}`).
 */
export function engineText(skin: Pick<Skin, "engineTexts">, key: string, legacy?: string | null, params?: Record<string, string | number>): string {
  const text = skin.engineTexts[key] ?? legacy
  return text ? fill(text, params) : missing(key)
}

/** As `engineText` for words that are optional, such as the help of an option: nothing when there are none. */
export function optionalEngineText(skin: Pick<Skin, "engineTexts">, key: string, legacy?: string | null, params?: Record<string, string | number>): string | null {
  const text = skin.engineTexts[key] ?? legacy
  return text ? fill(text, params) : null
}

export function mergeSkin(base: Skin, over: SkinDefaults | undefined): Skin {
  if (!over) return base
  return {
    ...base,
    ...Object.fromEntries(Object.entries(over).filter(([k, v]) => v != null && !["decor", "texts", "errors", "engineTexts"].includes(k))),
    decor: { ...base.decor, ...Object.fromEntries(Object.entries(over.decor ?? {}).filter(([, v]) => v != null)) },
    texts: { ...base.texts, ...Object.fromEntries(Object.entries(over.texts ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) },
    errors: { ...base.errors, ...Object.fromEntries(Object.entries(over.errors ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) },
    engineTexts: { ...base.engineTexts, ...Object.fromEntries(Object.entries(over.engineTexts ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) },
  }
}
