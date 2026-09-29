import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const PUBLIC = path.resolve(process.cwd(), "../web/public")

const FAMILIES = [
  ["butterfly", "butterfly"],
  ["toad", "toad"],
  ["nightingale", "nightingale"],
  ["hare", "hare"],
  ["stag", "stag"],
  ["carp", "carp"],
]
const ROLES = [
  ["BASE", "base"],
  ["GUARD", "guard"],
  ["NOBLE", "noble"],
  ["ASSASSIN", "assassin"],
  ["SPY", "spy"],
]
const ROLE_PICTOGRAMS = [
  ["noble", "noble"],
  ["spy", "spy"],
  ["assassin", "assassin"],
  ["guard", "guard"],
]

type Target = { ids: string[]; field: string; file: string }

const targets: Target[] = [
  ...FAMILIES.flatMap(([f, fe]) =>
    ROLES.map(([r, re]) => ({ ids: [`courtier-${re}-${fe}`], field: "card", file: `cards/${r}_${fe.toUpperCase()}.webp` })),
  ),
  ...Array.from({ length: 10 }, (_, i) => [
    { ids: [`mission-light-${i + 1}`, `drafts.mission-light-${i + 1}`], field: "card", file: `cards/MISSION_LIGHT_${i + 1}.webp` },
    { ids: [`mission-dark-${i + 1}`, `drafts.mission-dark-${i + 1}`], field: "card", file: `cards/MISSION_DARK_${i + 1}.webp` },
  ]).flat(),
  { ids: ["game", "drafts.game"], field: "courtierBack", file: "cards/COURTIER_BACK.webp" },
  { ids: ["game", "drafts.game"], field: "whiteMissionBack", file: "cards/MISSION_BACK_LIGHT.webp" },
  { ids: ["game", "drafts.game"], field: "blueMissionBack", file: "cards/MISSION_BACK_DARK.webp" },
  { ids: ["settings", "drafts.settings"], field: "logo", file: "LOGO.webp" },
  ...FAMILIES.map(([f, fe]) => ({
    ids: [`family-${fe}`, `drafts.family-${fe}`],
    field: "pictogram",
    file: `pictograms/PICTOGRAM_${fe.toUpperCase()}.webp`,
  })),
  ...ROLE_PICTOGRAMS.map(([r, re]) => ({
    ids: [`role-${re}`, `drafts.role-${re}`],
    field: "pictogram",
    file: `pictograms/PICTOGRAM_${re.toUpperCase()}.webp`,
  })),
]

async function main() {
  const allIds = [...new Set(targets.flatMap((c) => c.ids))]
  const existing = new Set((await client.getDocuments(allIds)).filter(Boolean).map((d) => d!._id))

  let updated = 0
  for (const { ids, field, file } of targets) {
    const docs = ids.filter((id) => existing.has(id))
    const filePath = path.join(PUBLIC, file)
    if (docs.length === 0 || !existsSync(filePath)) {
      console.log(`⏭  ${file} ignoré (${docs.length === 0 ? "document absent" : "fichier absent"})`)
      continue
    }
    const asset = await client.assets.upload("image", createReadStream(filePath), { filename: path.basename(file) })
    const transaction = client.transaction()
    for (const id of docs) {
      transaction.patch(id, (p) => p.set({ [field]: { _type: "image", asset: { _type: "reference", _ref: asset._id } } }))
    }
    await transaction.commit()
    updated += docs.length
    console.log(`✓ ${file} → ${docs.join(", ")}`)
  }
  console.log(`\n${updated} image(s) mise(s) à jour. Pour supprimer les anciens PNG devenus inutiles : pnpm sanity:nettoyer-png`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
