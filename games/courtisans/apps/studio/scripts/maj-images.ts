import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const PUBLIC = path.resolve(process.cwd(), "../web/public")

const FAMILLES = [
  ["papillon", "butterfly"],
  ["crapaud", "toad"],
  ["rossignol", "nightingale"],
  ["lievre", "hare"],
  ["cerf", "stag"],
  ["carpe", "carp"],
]
const ROLES = [
  ["BASE", "base"],
  ["GUARD", "guard"],
  ["NOBLE", "noble"],
  ["ASSASSIN", "assassin"],
  ["SPY", "spy"],
]
const ROLES_PICTO = [
  ["noble", "noble"],
  ["espion", "spy"],
  ["assassin", "assassin"],
  ["garde", "guard"],
]

type Cible = { ids: string[]; champ: string; fichier: string }

const cibles: Cible[] = [
  ...FAMILLES.flatMap(([f, fe]) =>
    ROLES.map(([r, re]) => ({ ids: [`courtier-${re}-${fe}`], champ: "card", fichier: `cards/${r}_${fe.toUpperCase()}.webp` })),
  ),
  ...Array.from({ length: 10 }, (_, i) => [
    { ids: [`mission-light-${i + 1}`, `drafts.mission-light-${i + 1}`], champ: "card", fichier: `cards/MISSION_LIGHT_${i + 1}.webp` },
    { ids: [`mission-dark-${i + 1}`, `drafts.mission-dark-${i + 1}`], champ: "card", fichier: `cards/MISSION_DARK_${i + 1}.webp` },
  ]).flat(),
  { ids: ["game", "drafts.game"], champ: "courtierBack", fichier: "cards/COURTIER_BACK.webp" },
  { ids: ["game", "drafts.game"], champ: "whiteMissionBack", fichier: "cards/MISSION_BACK_LIGHT.webp" },
  { ids: ["game", "drafts.game"], champ: "blueMissionBack", fichier: "cards/MISSION_BACK_DARK.webp" },
  { ids: ["interface", "drafts.interface"], champ: "logo", fichier: "LOGO.webp" },
  ...FAMILLES.map(([f, fe]) => ({
    ids: [`family-${fe}`, `drafts.family-${fe}`],
    champ: "pictogram",
    fichier: `pictograms/PICTOGRAM_${fe.toUpperCase()}.webp`,
  })),
  ...ROLES_PICTO.map(([r, re]) => ({
    ids: [`role-${re}`, `drafts.role-${re}`],
    champ: "pictogram",
    fichier: `pictograms/PICTOGRAM_${re.toUpperCase()}.webp`,
  })),
]

async function main() {
  const tousLesIds = [...new Set(cibles.flatMap((c) => c.ids))]
  const existants = new Set((await client.getDocuments(tousLesIds)).filter(Boolean).map((d) => d!._id))

  let mis = 0
  for (const { ids, champ, fichier } of cibles) {
    const docs = ids.filter((id) => existants.has(id))
    const chemin = path.join(PUBLIC, fichier)
    if (docs.length === 0 || !existsSync(chemin)) {
      console.log(`⏭  ${fichier} ignoré (${docs.length === 0 ? "document absent" : "fichier absent"})`)
      continue
    }
    const asset = await client.assets.upload("image", createReadStream(chemin), { filename: path.basename(fichier) })
    const transaction = client.transaction()
    for (const id of docs) {
      transaction.patch(id, (p) => p.set({ [champ]: { _type: "image", asset: { _type: "reference", _ref: asset._id } } }))
    }
    await transaction.commit()
    mis += docs.length
    console.log(`✓ ${fichier} → ${docs.join(", ")}`)
  }
  console.log(`\n${mis} image(s) mise(s) à jour. Pour supprimer les anciens PNG devenus inutiles : pnpm sanity:nettoyer-png`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
