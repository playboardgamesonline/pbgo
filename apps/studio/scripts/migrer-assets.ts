import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-27" })
const PUBLIC = path.resolve(process.cwd(), "../web/public")

const CHAMPS_ASSETS = ["logo", "dosCourtisan", "dosMissionBlanche", "dosMissionBleue"] as const
const VISUELS_REGLES: Record<string, string> = {
  noble: "regles/noble.webp",
  garde: "regles/garde.webp",
  espion: "regles/espion.webp",
  assassin: "regles/assassin.webp",
  table: "regles/table-exemple.webp",
  exempleEspion: "regles/espion-exemple.webp",
  exempleAssassin: "regles/assassin-exemple.webp",
  decompteTable: "regles/decompte-table.webp",
  decompteDomaine: "regles/decompte-domaine.webp",
}

type Doc = Record<string, unknown> | null

async function televerser(fichier: string) {
  const chemin = path.join(PUBLIC, fichier)
  if (!existsSync(chemin)) return null
  const asset = await client.assets.upload("image", createReadStream(chemin), { filename: path.basename(fichier) })
  return { _type: "image", asset: { _type: "reference", _ref: asset._id } }
}

async function main() {
  const [reglages, assets, board, rules] = await Promise.all(
    ["reglages", "assets", "board", "rules"].map((id) => client.fetch<Doc>(`*[_id == $id][0]`, { id })),
  )
  const tx = client.transaction()

  if (reglages) {
    const nouveaux: Record<string, unknown> = { _id: "assets", _type: "assets" }
    for (const champ of CHAMPS_ASSETS) if (reglages[champ]) nouveaux[champ] = reglages[champ]
    tx.createIfNotExists(nouveaux as { _id: string; _type: string })
    tx.createIfNotExists({ _id: "textes", _type: "textes", phrasesVainqueur: (reglages.phrasesVainqueur as string[] | undefined) ?? [] })
    tx.delete("reglages")
    tx.delete("drafts.reglages")
  }

  const tapis = reglages?.tapis ?? assets?.tapis ?? (board?.tapis ? null : await televerser("tapis.jpg"))
  tx.createIfNotExists({ _id: "board", _type: "board" })
  if (tapis && !board?.tapis) tx.patch("board", (p) => p.set({ tapis }))
  if (assets?.tapis) tx.patch("assets", (p) => p.unset(["tapis"]))

  tx.createIfNotExists({ _id: "rules", _type: "rules" })
  const visuels: Record<string, unknown> = {}
  for (const [champ, fichier] of Object.entries(VISUELS_REGLES)) {
    if (rules?.[champ]) continue
    const image = await televerser(fichier)
    if (image) visuels[champ] = image
  }
  if (Object.keys(visuels).length) tx.patch("rules", (p) => p.set(visuels))

  const chateaux = await client.fetch<string[]>(`*[_type == "chateau"]._id`)
  for (const id of chateaux) tx.delete(id)

  await tx.commit()
  console.log(
    `Assets, Board, Rules et Texts prêts : ${Object.keys(visuels).length} visuel(s) de règles importé(s), ${chateaux.length} château(x) supprimé(s).`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
