import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const confirm = process.argv.includes("--confirm")

type Asset = { _id: string; originalFilename?: string; size?: number; references: number }

async function main() {
  const assets = await client.fetch<Asset[]>(
    `*[_type == "sanity.imageAsset" && mimeType == "image/png"]{ _id, originalFilename, size, "references": count(*[references(^._id)]) }`,
  )
  const unused = assets.filter((a) => a.references === 0)
  const used = assets.filter((a) => a.references > 0)

  for (const a of used) console.log(`● ${a.originalFilename ?? a._id} conservé (encore utilisé ${a.references}×)`)
  for (const a of unused) console.log(`✕ ${a.originalFilename ?? a._id} (${Math.round((a.size ?? 0) / 1024)} Ko)`)

  const total = unused.reduce((s, a) => s + (a.size ?? 0), 0)
  console.log(`\n${unused.length} PNG inutilisé(s) à supprimer (${(total / 1e6).toFixed(1)} Mo), ${used.length} conservé(s).`)
  if (!confirm) {
    console.log("Simulation uniquement : relance avec --confirm pour supprimer.")
    return
  }
  for (let i = 0; i < unused.length; i += 50) {
    const transaction = client.transaction()
    for (const a of unused.slice(i, i + 50)) transaction.delete(a._id)
    await transaction.commit()
  }
  console.log("C'est fait.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
