import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })

const CHAMPS_ASSETS = ["logo", "tapis", "dosCourtisan", "dosMissionBlanche", "dosMissionBleue"] as const

async function main() {
  const reglages = await client.fetch<Record<string, unknown> | null>(`*[_id == "reglages"][0]`)
  const tx = client.transaction()
  if (reglages) {
    const assets: Record<string, unknown> = { _id: "assets", _type: "assets" }
    for (const champ of CHAMPS_ASSETS) if (reglages[champ]) assets[champ] = reglages[champ]
    tx.createIfNotExists(assets as { _id: string; _type: string })
    tx.createIfNotExists({ _id: "textes", _type: "textes", phrasesVainqueur: (reglages.phrasesVainqueur as string[] | undefined) ?? [] })
    tx.delete("reglages")
    tx.delete("drafts.reglages")
  }
  const chateaux = await client.fetch<string[]>(`*[_type == "chateau"]._id`)
  for (const id of chateaux) tx.delete(id)
  await tx.commit()
  console.log(`Assets et Textes créés${reglages ? "" : " (aucun document Réglages trouvé)"}, ${chateaux.length} château(x) supprimé(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
