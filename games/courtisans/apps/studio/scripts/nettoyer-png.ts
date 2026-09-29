import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const confirmer = process.argv.includes("--confirmer")

type Asset = { _id: string; originalFilename?: string; size?: number; references: number }

async function main() {
  const assets = await client.fetch<Asset[]>(
    `*[_type == "sanity.imageAsset" && mimeType == "image/png"]{ _id, originalFilename, size, "references": count(*[references(^._id)]) }`,
  )
  const inutilises = assets.filter((a) => a.references === 0)
  const utilises = assets.filter((a) => a.references > 0)

  for (const a of utilises) console.log(`● ${a.originalFilename ?? a._id} conservé (encore utilisé ${a.references}×)`)
  for (const a of inutilises) console.log(`✕ ${a.originalFilename ?? a._id} (${Math.round((a.size ?? 0) / 1024)} Ko)`)

  const total = inutilises.reduce((s, a) => s + (a.size ?? 0), 0)
  console.log(`\n${inutilises.length} PNG inutilisé(s) à supprimer (${(total / 1e6).toFixed(1)} Mo), ${utilises.length} conservé(s).`)
  if (!confirmer) {
    console.log("Simulation uniquement : relance avec --confirmer pour supprimer.")
    return
  }
  for (let i = 0; i < inutilises.length; i += 50) {
    const transaction = client.transaction()
    for (const a of inutilises.slice(i, i + 50)) transaction.delete(a._id)
    await transaction.commit()
  }
  console.log("C'est fait.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
