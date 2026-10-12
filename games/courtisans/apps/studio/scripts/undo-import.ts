import { readFileSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const args = process.argv.slice(2)
const option = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const SEED = path.resolve(process.cwd(), option("seed") ?? "../../assets/sanity-seed/data.ndjson")
const minutes = option("minutes")
const before = option("before") ?? (minutes ? new Date(Date.now() - Number(minutes) * 60_000).toISOString() : undefined)
const confirm = args.includes("--confirm")

async function main() {
  if (!before || Number.isNaN(Date.parse(before))) {
    console.error('Specify when to roll back to: --minutes 60  or  --before "2026-09-27T10:30:00+02:00"')
    process.exit(1)
  }
  const ids: string[] = readFileSync(SEED, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line)._id)
  const { dataset } = client.config()

  const olds = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20)
    const res = await client.request<{ documents: Record<string, unknown>[] }>({
      uri: `/data/history/${dataset}/documents/${batch.map(encodeURIComponent).join(",")}?time=${encodeURIComponent(new Date(before).toISOString())}`,
    })
    for (const doc of res.documents ?? []) if (doc && doc._id) olds.set(doc._id as string, doc)
  }

  const transaction = client.transaction()
  let restored = 0
  let deleted = 0
  for (const id of ids) {
    const old = olds.get(id)
    if (old) {
      const { _rev, _updatedAt, _createdAt, ...doc } = old
      transaction.createOrReplace(doc as { _id: string; _type: string })
      restored++
      console.log(`↺ ${id} restored`)
    } else {
      transaction.delete(id)
      deleted++
      console.log(`✕ ${id} deleted (it did not exist at ${before})`)
    }
  }

  console.log(`\n${restored} document(s) to restore, ${deleted} to delete (state at ${before}).`)
  if (!confirm) {
    console.log("Dry run only: re-run with --confirm to apply.")
    return
  }
  await transaction.commit()
  console.log("Done.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
