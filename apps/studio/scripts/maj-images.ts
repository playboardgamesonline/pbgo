import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const DOSSIER = path.resolve(process.cwd(), "../web/public/cartes")

const FAMILLES = ["papillon", "crapaud", "rossignol", "lievre", "cerf", "carpe"]
const ROLES = ["BASE", "GARDE", "NOBLE", "ASSASSIN", "ESPION"]

type Cible = { ids: string[]; champ: string; fichier: string }

const cibles: Cible[] = [
  ...FAMILLES.flatMap((f) => ROLES.map((r) => ({ ids: [`courtisan-${r.toLowerCase()}-${f}`], champ: "carte", fichier: `${r}_${f.toUpperCase()}.webp` }))),
  ...Array.from({ length: 10 }, (_, i) => [
    { ids: [`mission-light-${i + 1}`, `drafts.mission-light-${i + 1}`], champ: "carte", fichier: `MISSION_LIGHT_${i + 1}.webp` },
    { ids: [`mission-dark-${i + 1}`, `drafts.mission-dark-${i + 1}`], champ: "carte", fichier: `MISSION_DARK_${i + 1}.webp` },
  ]).flat(),
  { ids: ["reglages", "drafts.reglages"], champ: "dosCourtisan", fichier: "DOS_COURTISAN.webp" },
  { ids: ["reglages", "drafts.reglages"], champ: "dosMissionBlanche", fichier: "DOS_MISSION_LIGHT.webp" },
  { ids: ["reglages", "drafts.reglages"], champ: "dosMissionBleue", fichier: "DOS_MISSION_DARK.webp" },
]

async function main() {
  const tousLesIds = [...new Set(cibles.flatMap((c) => c.ids))]
  const existants = new Set((await client.getDocuments(tousLesIds)).filter(Boolean).map((d) => d!._id))

  let mis = 0
  for (const { ids, champ, fichier } of cibles) {
    const docs = ids.filter((id) => existants.has(id))
    const chemin = path.join(DOSSIER, fichier)
    if (docs.length === 0 || !existsSync(chemin)) {
      console.log(`⏭  ${fichier} ignoré (${docs.length === 0 ? "document absent" : "fichier absent"})`)
      continue
    }
    const asset = await client.assets.upload("image", createReadStream(chemin), { filename: fichier })
    const transaction = client.transaction()
    for (const id of docs) {
      transaction.patch(id, (p) => p.set({ [champ]: { _type: "image", asset: { _type: "reference", _ref: asset._id } } }))
    }
    await transaction.commit()
    mis += docs.length
    console.log(`✓ ${fichier} → ${docs.join(", ")}`)
  }
  console.log(`\n${mis} image(s) mise(s) à jour. Les anciens fichiers restent dans la médiathèque (Media) et peuvent y être supprimés.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
