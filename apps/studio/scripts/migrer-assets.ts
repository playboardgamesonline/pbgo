import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { getCliClient } from "sanity/cli"
import { REGLES_ROLES_DEFAUT, TEXTES_REGLES_DEFAUT } from "../../web/src/lib/regles-defaut"

const client = getCliClient({ apiVersion: "2026-09-27" })
const PUBLIC = path.resolve(process.cwd(), "../web/public")

type Doc = Record<string, unknown> | null
type Image = { _type: "image"; asset: { _type: "reference"; _ref: string } }

const VISUELS_REGLES: Record<string, string> = {
  visuelTable: "regles/table-exemple.webp",
  exempleEspion: "regles/espion-exemple.webp",
  exempleAssassin: "regles/assassin-exemple.webp",
  decompteTable: "regles/decompte-table.webp",
  decompteDomaine: "regles/decompte-domaine.webp",
}
const ANCIENS_NOMS: Record<string, string> = { visuelTable: "table", visuelMissions: "missions" }

async function televerser(fichier: string): Promise<Image | null> {
  const chemin = path.join(PUBLIC, fichier)
  if (!existsSync(chemin)) return null
  const asset = await client.assets.upload("image", createReadStream(chemin), { filename: path.basename(fichier) })
  return { _type: "image", asset: { _type: "reference", _ref: asset._id } }
}

const premier = (...valeurs: unknown[]) => valeurs.find((v) => v !== undefined && v !== null)

async function main() {
  const ids = ["reglages", "assets", "board", "rules", "textes", "interface", "game"]
  const [reglages, assets, board, rules, textes, iface, game] = await Promise.all(ids.map((id) => client.fetch<Doc>(`*[_id == $id][0]`, { id })))
  const tx = client.transaction()

  const interfaceChamps: Record<string, unknown> = {}
  for (const champ of ["logo", "banquetHaut", "banquetBas"]) {
    const v = premier(iface?.[champ], assets?.[champ], reglages?.[champ])
    if (v) interfaceChamps[champ] = v
  }
  tx.createIfNotExists({ _id: "interface", _type: "interface" })
  if (Object.keys(interfaceChamps).length) tx.patch("interface", (p) => p.set(interfaceChamps))

  const gameChamps: Record<string, unknown> = {}
  for (const champ of ["dosCourtisan", "dosMissionBlanche", "dosMissionBleue"]) {
    const v = premier(game?.[champ], assets?.[champ], reglages?.[champ])
    if (v) gameChamps[champ] = v
  }
  const tapis = premier(game?.tapis, board?.tapis, assets?.tapis, reglages?.tapis) ?? (await televerser("tapis.jpg"))
  if (tapis) gameChamps.tapis = tapis
  const decorations = premier(game?.decorations, board?.decorations)
  if (decorations) gameChamps.decorations = decorations
  tx.createIfNotExists({ _id: "game", _type: "game" })
  if (Object.keys(gameChamps).length) tx.patch("game", (p) => p.set(gameChamps))

  if (!textes) tx.createIfNotExists({ _id: "textes", _type: "textes", phrasesVainqueur: (reglages?.phrasesVainqueur as string[] | undefined) ?? [] })

  const reglesChamps: Record<string, unknown> = {}
  for (const [champ, defaut] of Object.entries(TEXTES_REGLES_DEFAUT)) if (!rules?.[champ]) reglesChamps[champ] = defaut
  for (const [champ, ancien] of Object.entries(ANCIENS_NOMS)) if (!rules?.[champ] && rules?.[ancien]) reglesChamps[champ] = rules[ancien]
  for (const [champ, fichier] of Object.entries(VISUELS_REGLES)) {
    if (rules?.[champ] || reglesChamps[champ]) continue
    const image = await televerser(fichier)
    if (image) reglesChamps[champ] = image
  }
  tx.createIfNotExists({ _id: "rules", _type: "rules" })
  if (Object.keys(reglesChamps).length) tx.patch("rules", (p) => p.set(reglesChamps))
  tx.patch("rules", (p) => p.unset(["table", "missions", "noble", "garde", "espion", "assassin"]))

  const roles = await client.fetch<{ _id: string; cle?: string; visuel?: unknown; regle?: string }[]>(`*[_type == "role"]{ _id, cle, visuel, regle }`)
  for (const role of roles) {
    const cle = role.cle as keyof typeof REGLES_ROLES_DEFAUT | undefined
    if (!cle || !(cle in REGLES_ROLES_DEFAUT)) continue
    const champs: Record<string, unknown> = {}
    if (!role.regle) champs.regle = REGLES_ROLES_DEFAUT[cle]
    if (!role.visuel) {
      const visuel = rules?.[cle] ?? (await televerser(`regles/${cle}.webp`))
      if (visuel) champs.visuel = visuel
    }
    if (Object.keys(champs).length) tx.patch(role._id, (p) => p.set(champs))
  }

  for (const id of ["reglages", "assets", "board"]) {
    tx.delete(id)
    tx.delete(`drafts.${id}`)
  }
  const chateaux = await client.fetch<string[]>(`*[_type == "chateau"]._id`)
  for (const id of chateaux) tx.delete(id)

  await tx.commit()
  console.log("Interface, Game, Rules et Texts prêts ; visuels et règles des rôles renseignés ; anciens documents supprimés.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
