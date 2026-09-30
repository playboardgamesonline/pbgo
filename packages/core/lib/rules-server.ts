import "server-only"
import * as serverBinding from "@pbgo/binding-server"
import { client } from "../sanity/client"
import { urlFor } from "../sanity/image"
import { type Locale, type Localized, only } from "./i18n"
import { getLocale } from "./locale-server"
import { type RulesContent, DEFAULT_RULES, DEFAULT_RULES_I18N } from "./rules"

type RulesSanity = {
  intro?: Localized
  videoId?: string
  sections?: { title?: Localized; body?: Localized; image?: Parameters<typeof urlFor>[0] }[]
} | null

/** Règles propres au jeu (forme libre, lue par le `RulesButton` du jeu) : export facultatif `loadRules()` de @pbgo/binding-server. */
const gameRules = (serverBinding as { loadRules?: () => Promise<unknown> }).loadRules

export async function loadRules(): Promise<RulesContent> {
  if (gameRules) return (await gameRules()) as RulesContent
  const locale = await getLocale()
  const fallback = locale === "fr" ? DEFAULT_RULES : DEFAULT_RULES_I18N[locale]
  if (!client) return fallback
  try {
    const rules = await client.fetch<RulesSanity>(`*[_id == "rules"][0]{ intro, videoId, sections[]{ title, body, image } }`, {}, { next: { revalidate: 60 } })
    // règles saisies dans la langue du joueur, sinon celles en français (elles décrivent le vrai jeu), sinon celles par défaut
    const build = (l: Locale) =>
      (rules?.sections ?? [])
        .map((s) => ({ title: only(s.title, l) ?? "", text: only(s.body, l) ?? "", image: s.image ? urlFor(s.image).width(1200).url() : null }))
        .filter((s) => s.title)
    const own = build(locale)
    const sections = own.length ? own : build("fr")
    return {
      intro: only(rules?.intro, locale) || only(rules?.intro, "fr") || fallback.intro,
      videoId: rules?.videoId || fallback.videoId,
      sections: sections.length ? sections : fallback.sections,
    }
  } catch {
    return fallback
  }
}
