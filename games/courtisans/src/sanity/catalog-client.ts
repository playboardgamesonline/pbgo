import "server-only"
import type { Family, Role } from "@courtisans/engine"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { type Localized, only } from "@pbgo/core/lib/i18n"
import { type SanityImageSource, urlFor } from "@pbgo/core/sanity/image"
import { defaultCatalog, type ClientCatalog, cardKey, ROLE_VISUAL_FAMILIES, RULES_MISSION_VISUALS, type RoleRules } from "../lib/catalog"
import type { RuleTexts } from "../lib/default-rules"
import { getCatalog } from "./catalog"

/** Catalog given to the board (card images, families, roles, game texts): Sanity, completed by the defaults of the code. */
export async function getClientCatalog({ game: module, locale, sanity }: LoaderContext): Promise<ClientCatalog> {
  const d = defaultCatalog(locale)
  if (!sanity) return d
  // An SVG cannot be resized by the CDN (transformation parameters → 400 errors): the file is served as is.
  const isSvg = (source: SanityImageSource) => JSON.stringify(source).includes("-svg")
  const url = (source: SanityImageSource | null | undefined, width: number) =>
    source ? (isSvg(source) ? urlFor(module, source).url() : urlFor(module, source).width(width).url()) : null
  try {
    const { game, rules, texts, families, roles, courtiers, missions } = await getCatalog(sanity)

    const familiesMap = { ...d.families }
    for (const f of families) {
      const key = f.key as Family | undefined
      if (!key || !familiesMap[key]) continue
      familiesMap[key] = {
        ...familiesMap[key],
        name: only(f.name, locale) ?? familiesMap[key].name,
        color: f.color ?? familiesMap[key].color,
        pictogramUrl: url(f.pictogram, 128) ?? familiesMap[key].pictogramUrl,
      }
    }
    const rolesMap = { ...d.roles }
    const roleRules: Record<Role, RoleRules> = { ...d.rules.roles }
    for (const r of roles) {
      const key = r.key as Role | undefined
      if (!key || !rolesMap[key]) continue
      const name = only(r.name, locale) ?? rolesMap[key].name
      rolesMap[key] = { ...rolesMap[key], name, pictogramUrl: url(r.pictogram, 128) ?? rolesMap[key].pictogramUrl }
      roleRules[key] = {
        ...roleRules[key],
        name,
        count: r.countPerFamily ?? roleRules[key].count,
        text: only(r.rule, locale) || roleRules[key].text,
        letteringUrl: r.lettering ?? null,
        pictogramUrl: rolesMap[key].pictogramUrl,
      }
    }

    const cards: Record<string, string> = { ...d.cards }
    for (const c of courtiers) {
      const imageUrl = url(c.card, 360)
      if (c.family && imageUrl) cards[cardKey(c.family as Family, (c.role as Role | null) ?? null)] = imageUrl
    }
    for (const r of Object.keys(roleRules) as Role[])
      roleRules[r] = { ...roleRules[r], cards: ROLE_VISUAL_FAMILIES[r].map((f) => cards[cardKey(f, r)]) as [string, string] }
    const missionsMap: Record<string, string> = { ...d.missions }
    for (const m of missions) {
      const imageUrl = url(m.card, 520)
      if (imageUrl) missionsMap[m._id] = imageUrl
    }

    return {
      families: familiesMap,
      roles: rolesMap,
      cards,
      missions: missionsMap,
      matUrl: url(game?.mat, 2000) ?? d.matUrl,
      clothUrl: url(game?.matTexture, 1024) ?? d.clothUrl,
      courtierBackUrl: url(game?.courtierBack, 360) ?? d.courtierBackUrl,
      whiteMissionBackUrl: url(game?.whiteMissionBack, 520) ?? d.whiteMissionBackUrl,
      blueMissionBackUrl: url(game?.blueMissionBack, 520) ?? d.blueMissionBackUrl,
      arrowUpUrl: url(game?.arrowUp, 256) ?? d.arrowUpUrl,
      arrowDownUrl: url(game?.arrowDown, 256) ?? d.arrowDownUrl,
      rules: {
        texts: Object.fromEntries(
          Object.entries(d.rules.texts).map(([key, defaultValue]) => {
            const raw = rules?.[key as keyof typeof rules] as unknown
            // plain text in Sanity = the French version
            const value = typeof raw === "string" ? (locale === "fr" ? raw : undefined) : only(raw as Localized, locale)
            return [key, value?.trim() ? value : defaultValue]
          }),
        ) as RuleTexts,
        roles: roleRules,
        families: d.rules.families.map((f) => ({
          ...f,
          name: familiesMap[f.key].name,
          color: familiesMap[f.key].color,
          pictogramUrl: familiesMap[f.key].pictogramUrl,
          cardUrl: cards[cardKey(f.key, null)] ?? f.cardUrl,
        })),
        missions: RULES_MISSION_VISUALS.map((id, i) => missionsMap[id] ?? d.rules.missions[i]!) as [string, string],
        pictoFrame: url(game?.pictogramFrame, 240) ?? d.rules.pictoFrame,
      },
      missionTexts: {
        ...d.missionTexts,
        ...Object.fromEntries(missions.flatMap((m) => (only(m.text, locale)?.trim() ? [[m._id, only(m.text, locale)!.trim()]] : []))),
      },
      missionsButtonText: only(texts?.missionsButton, locale)?.trim() || d.missionsButtonText,
      banquetStartText: only(texts?.banquetStarts, locale)?.trim() || d.banquetStartText,
    }
  } catch (error) {
    console.error("Sanity catalog unavailable", error)
    return d
  }
}
