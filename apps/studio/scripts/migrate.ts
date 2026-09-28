import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"
import { REGLES_ROLES_DEFAUT, TEXTES_REGLES_DEFAUT } from "../../web/src/lib/regles-defaut"
import { FAMILIES, ROLES } from "../schemaTypes/constants"

const client = getCliClient({ apiVersion: "2026-09-27" }).withConfig({ perspective: "raw" })
const PUBLIC = path.resolve(process.cwd(), "../web/public")

type Doc = Record<string, any>
type Image = { _type: "image"; asset: { _type: "reference"; _ref: string } }

const COUNT_PER_FAMILY: Record<string, number> = { noble: 4, garde: 3, espion: 2, assassin: 2 }
const LEGACY_TEXT: Record<string, string[]> = {
  goalIntro: ["butIntro"],
  goalFamilies: ["butFamilles"],
  goalMissions: ["butMissions"],
  turnIntro: ["tourIntro"],
  turnTable: ["tourTable"],
  turnDomain: ["tourDomaine"],
  turnOpponent: ["tourAdverse"],
  turnEnd: ["tourFin"],
  rolesIntro: [],
  spyCaption: ["legendeEspion"],
  assassinCaption: ["legendeAssassin"],
  scoringIntro: ["decompteIntro"],
  scoringReveal: ["decompteRevelation"],
  scoringStatus: ["decompteStatut"],
  scoringPoints: ["decomptePoints"],
  domainCaption: ["legendeDomaine"],
}
const CAPTIONS = new Set(["spyCaption", "assassinCaption", "domainCaption"])
const LEGACY_VISUAL: Record<string, { old: string[]; file?: string }> = {
  tableVisual: { old: ["visuelTable", "table"], file: "regles/table-exemple.webp" },
  missionsVisual: { old: ["visuelMissions", "missions"] },
  spyExample: { old: ["exempleEspion"], file: "regles/espion-exemple.webp" },
  assassinExample: { old: ["exempleAssassin"], file: "regles/assassin-exemple.webp" },
  scoringTable: { old: ["decompteTable"], file: "regles/decompte-table.webp" },
  scoringDomain: { old: ["decompteDomaine"], file: "regles/decompte-domaine.webp" },
}

const first = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== "")
const fr = (value: unknown, fallback?: string) => {
  if (value && typeof value === "object") return value
  const text = (value as string | undefined) || fallback
  return text ? { fr: text } : undefined
}
const clean = (doc: Doc) => Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== undefined))
const slugOf = (list: { value: string; slug: string }[], key: unknown) => list.find((i) => i.value === key)?.slug

async function upload(file: string): Promise<Image | undefined> {
  const full = path.join(PUBLIC, file)
  if (!existsSync(full)) return undefined
  const asset = await client.assets.upload("image", createReadStream(full), { filename: path.basename(file) })
  return { _type: "image", asset: { _type: "reference", _ref: asset._id } }
}

function convertCondition(c: Doc | undefined): Doc | undefined {
  if (!c) return undefined
  return clean({
    _type: "condition",
    _key: c._key,
    type: c.type,
    family: first(c.family, c.famille),
    status: first(c.status, c.statut),
    familyFilter: first(c.familyFilter, c.filtreFamille),
    roleFilter: first(c.roleFilter, c.filtreRole),
    level: first(c.level, c.niveau),
    comparator: first(c.comparator, c.comparateur),
    value: first(c.value, c.valeur),
    opponent: first(c.opponent, c.adversaire),
    mode: c.mode,
    conditions: c.conditions?.map(convertCondition),
  })
}

async function main() {
  const byId = async (id: string) => (await client.fetch<Doc | null>(`*[_id == $id][0]`, { id })) ?? {}
  const [reglages, assets, board, iface, game, rules, textes, texts] = await Promise.all(
    ["reglages", "assets", "board", "interface", "game", "rules", "textes", "texts"].map(byId),
  )
  const tx = client.transaction()
  const obsolete = new Set<string>()

  tx.createOrReplace(
    clean({
      _id: "interface",
      _type: "interface",
      logo: first(iface.logo, assets.logo, reglages.logo),
      banquetTop: first(iface.banquetTop, iface.banquetHaut, assets.banquetHaut),
      banquetBottom: first(iface.banquetBottom, iface.banquetBas, assets.banquetBas),
    }) as { _id: string; _type: string },
  )

  const decorations = (first(game.decorations, board.decorations) as Doc[] | undefined)?.map((d) =>
    clean({ _key: d._key, _type: "decoration", name: first(d.name, d.nom), image: d.image }),
  )
  tx.createOrReplace(
    clean({
      _id: "game",
      _type: "game",
      mat: first(game.mat, game.tapis, board.tapis, assets.tapis, reglages.tapis) ?? (await upload("tapis.jpg")),
      decorations,
      courtierBack: first(game.courtierBack, game.dosCourtisan, assets.dosCourtisan, reglages.dosCourtisan),
      whiteMissionBack: first(game.whiteMissionBack, game.dosMissionBlanche, assets.dosMissionBlanche, reglages.dosMissionBlanche),
      blueMissionBack: first(game.blueMissionBack, game.dosMissionBleue, assets.dosMissionBleue, reglages.dosMissionBleue),
    }) as { _id: string; _type: string },
  )

  const legacyPhrases = (first(textes.phrasesVainqueur, reglages.phrasesVainqueur) as string[] | undefined) ?? []
  tx.createOrReplace({
    _id: "texts",
    _type: "texts",
    missionsButton: texts.missionsButton ?? { _type: "localeString", fr: "Missions comprises", en: "Missions understood" },
    banquetStarts: texts.banquetStarts ?? { _type: "localeString", fr: "Le banquet peut commencer !", en: "Let the banquet begin!" },
    winnerPhrases: texts.winnerPhrases ?? { _type: "localeStringList", fr: legacyPhrases },
  })

  const rulesDoc: Doc = { _id: "rules", _type: "rules", videoId: first(rules.videoId, TEXTES_REGLES_DEFAUT.videoId) }
  for (const [field, legacy] of Object.entries(LEGACY_TEXT)) {
    const defaut = TEXTES_REGLES_DEFAUT[field as keyof typeof TEXTES_REGLES_DEFAUT]
    const value = fr(first(rules[field], ...legacy.map((l) => rules[l])), defaut) as Doc
    rulesDoc[field] = { ...value, _type: CAPTIONS.has(field) ? "localeString" : "localeText" }
  }
  for (const [field, { old, file }] of Object.entries(LEGACY_VISUAL)) {
    rulesDoc[field] = first(rules[field], ...old.map((o) => rules[o])) ?? (file ? await upload(file) : undefined)
  }
  tx.createOrReplace(clean(rulesDoc) as { _id: string; _type: string })

  const families = await client.fetch<Doc[]>(`*[_type in ["famille", "family"] && !(_id in path("drafts.**"))]`)
  const familyIds = new Map<string, string>()
  for (const f of families) {
    const key = first(f.key, f.cle) as string
    const slug = slugOf(FAMILIES, key)
    if (!slug) continue
    const id = `family-${slug}`
    familyIds.set(key, id)
    tx.createOrReplace(
      clean({
        _id: id,
        _type: "family",
        name: fr(first(f.name, f.nom)),
        key,
        color: first(f.color, f.couleur),
        pictogram: first(f.pictogram, f.picto),
      }) as {
        _id: string
        _type: string
      },
    )
    if (f._id !== id) obsolete.add(f._id)
  }

  const roles = await client.fetch<Doc[]>(`*[_type == "role" && !(_id in path("drafts.**"))]`)
  const roleIds = new Map<string, string>()
  for (const r of roles) {
    const key = first(r.key, r.cle) as string
    const slug = slugOf(ROLES, key)
    if (!slug) continue
    const id = `role-${slug}`
    roleIds.set(key, id)
    tx.createOrReplace(
      clean({
        _id: id,
        _type: "role",
        name: fr(first(r.name, r.nom)),
        key,
        countPerFamily: first(r.countPerFamily, COUNT_PER_FAMILY[key]),
        pictogram: first(r.pictogram, r.picto),
        lettering: r.lettering,
        rule: fr(first(r.rule, r.regle), REGLES_ROLES_DEFAUT[key as keyof typeof REGLES_ROLES_DEFAUT]),
      }) as { _id: string; _type: string },
    )
    if (r._id !== id) obsolete.add(r._id)
  }

  const courtiers = await client.fetch<Doc[]>(
    `*[_type in ["courtisan", "courtier"] && !(_id in path("drafts.**"))]{ ..., "familyKey": coalesce(family->key, famille->cle), "roleKey": coalesce(role->key, role->cle) }`,
  )
  for (const c of courtiers) {
    const familySlug = slugOf(FAMILIES, c.familyKey)
    const familyId = familyIds.get(c.familyKey)
    if (!familySlug || !familyId) continue
    const id = `courtier-${slugOf(ROLES, c.roleKey) ?? "base"}-${familySlug}`
    const roleId = c.roleKey ? roleIds.get(c.roleKey) : undefined
    tx.createOrReplace(
      clean({
        _id: id,
        _type: "courtier",
        family: { _type: "reference", _ref: familyId },
        role: roleId ? { _type: "reference", _ref: roleId } : undefined,
        card: first(c.card, c.carte),
        quantity: first(c.quantity, c.quantite, 1),
      }) as { _id: string; _type: string },
    )
    if (c._id !== id) obsolete.add(c._id)
  }

  const missions = await client.fetch<Doc[]>(`*[_type == "mission"]`)
  for (const m of missions) {
    tx.patch(m._id, (p) =>
      p
        .set(
          clean({
            color: first(m.color, m.couleur),
            text: { ...(fr(first(m.text, m.texte)) as Doc), _type: "localeText" },
            card: first(m.card, m.carte),
            condition: convertCondition(m.condition),
          }),
        )
        .unset(["couleur", "texte", "carte"]),
    )
  }

  const drafts = await client.fetch<string[]>(`*[_type in ["famille", "courtisan", "role", "textes", "chateau"] && _id in path("drafts.**")]._id`)
  const legacy = await client.fetch<string[]>(`*[_type in ["textes", "chateau"] || _id in ["reglages", "assets", "board"]]._id`)
  const courtierIds = [...obsolete].filter((id) => courtiers.some((c) => c._id === id))
  for (const id of [...drafts, ...courtierIds, ...[...obsolete].filter((id) => !courtierIds.includes(id)), ...legacy]) tx.delete(id)

  await tx.commit()
  console.log(`Done: ${families.length} families, ${roles.length} roles, ${courtiers.length} courtiers, ${missions.length} missions migrated.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
