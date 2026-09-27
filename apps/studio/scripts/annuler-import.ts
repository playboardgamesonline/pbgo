import { readFileSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const args = process.argv.slice(2)
const option = (nom: string) => {
  const i = args.indexOf(`--${nom}`)
  return i >= 0 ? args[i + 1] : undefined
}

const SEED = path.resolve(process.cwd(), option("seed") ?? "../../../Assets/sanity-seed/data.ndjson")
const minutes = option("minutes")
const avant = option("avant") ?? (minutes ? new Date(Date.now() - Number(minutes) * 60_000).toISOString() : undefined)
const confirmer = args.includes("--confirmer")

async function main() {
  if (!avant || Number.isNaN(Date.parse(avant))) {
    console.error('Indique quand revenir : --minutes 60  ou  --avant "2026-09-27T10:30:00+02:00"')
    process.exit(1)
  }
  const ids: string[] = readFileSync(SEED, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((ligne) => JSON.parse(ligne)._id)
  const { dataset } = client.config()

  const anciens = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < ids.length; i += 20) {
    const lot = ids.slice(i, i + 20)
    const res = await client.request<{ documents: Record<string, unknown>[] }>({
      uri: `/data/history/${dataset}/documents/${lot.map(encodeURIComponent).join(",")}?time=${encodeURIComponent(new Date(avant).toISOString())}`,
    })
    for (const doc of res.documents ?? []) if (doc && doc._id) anciens.set(doc._id as string, doc)
  }

  const transaction = client.transaction()
  let restaures = 0
  let supprimes = 0
  for (const id of ids) {
    const ancien = anciens.get(id)
    if (ancien) {
      const { _rev, _updatedAt, _createdAt, ...doc } = ancien
      transaction.createOrReplace(doc as { _id: string; _type: string })
      restaures++
      console.log(`↺ ${id} restauré`)
    } else {
      transaction.delete(id)
      supprimes++
      console.log(`✕ ${id} supprimé (il n'existait pas le ${avant})`)
    }
  }

  console.log(`\n${restaures} document(s) à restaurer, ${supprimes} à supprimer (état au ${avant}).`)
  if (!confirmer) {
    console.log("Simulation uniquement : relance avec --confirmer pour appliquer.")
    return
  }
  await transaction.commit()
  console.log("C'est fait.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
