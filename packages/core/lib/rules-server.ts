import "server-only"
import * as serverBinding from "@pgo/binding-server"
import { client } from "../sanity/client"
import { urlFor } from "../sanity/image"
import { type Localized, translate } from "./i18n"
import { type RulesContent, DEFAULT_RULES } from "./rules"

type RulesSanity = {
  intro?: Localized
  videoId?: string
  sections?: { title?: Localized; body?: Localized; image?: Parameters<typeof urlFor>[0] }[]
} | null

/** Règles propres au jeu (forme libre, lue par le `RulesButton` du jeu) : export facultatif `loadRules()` de @pgo/binding-server. */
const gameRules = (serverBinding as { loadRules?: () => Promise<unknown> }).loadRules

export async function loadRules(): Promise<RulesContent> {
  if (gameRules) return (await gameRules()) as RulesContent
  if (!client) return DEFAULT_RULES
  try {
    const rules = await client.fetch<RulesSanity>(`*[_id == "rules"][0]{ intro, videoId, sections[]{ title, body, image } }`, {}, { next: { revalidate: 60 } })
    const sections = (rules?.sections ?? [])
      .map((s) => ({ title: translate(s.title) ?? "", text: translate(s.body) ?? "", image: s.image ? urlFor(s.image).width(1200).url() : null }))
      .filter((s) => s.title)
    return {
      intro: translate(rules?.intro) || DEFAULT_RULES.intro,
      videoId: rules?.videoId || DEFAULT_RULES.videoId,
      sections: sections.length ? sections : DEFAULT_RULES.sections,
    }
  } catch {
    return DEFAULT_RULES
  }
}
