/**
 * Moves Courtisans onto @pbgo/core: English values and the shared skin.
 *   pnpm sanity:migrate-core              → dry run (shows the changes)
 *   pnpm sanity:migrate-core --confirm    → applies them (one transaction)
 *
 * - families, roles: `key` in English (papillon → butterfly, espion → spy…)
 * - missions: color (blanche → white) and conditions (types, statuses, levels, opponents, counting)
 * - interface → shared skin: banquetTop → decorTop, banquetBottom → decorBottom, queen → hero;
 *   logo → settings.logo; paper, pictogramFrame, arrowUp, arrowDown → game
 * - texts: winnerPhrases → victoryPhrases, guestsSettling → ui_game.waiting
 * - game: removal of `decorations` (never read)
 * Idempotent: running it again changes nothing. Also handles drafts (drafts.*).
 */
import { getCliClient } from "sanity/cli"

const client = getCliClient({ apiVersion: "2026-09-29" }).withConfig({ perspective: "raw" })
const confirm = process.argv.includes("--confirm")

const VALUES: Record<string, string> = {
  papillon: "butterfly",
  crapaud: "toad",
  rossignol: "nightingale",
  lievre: "hare",
  cerf: "stag",
  carpe: "carp",
  espion: "spy",
  garde: "guard",
  lumiere: "light",
  neutre: "neutral",
  statutFamille: "familyStatus",
  nombreFamillesStatut: "familiesWithStatus",
  nombreCartesDomaine: "domainCards",
  nombreCartesTable: "tableCards",
  comparaisonJoueurs: "playerComparison",
  et: "and",
  ou: "or",
  non: "not",
  sansRole: "noRole",
  haut: "up",
  bas: "down",
  voisinGauche: "leftNeighbor",
  voisinDroite: "rightNeighbor",
  tousLesAdversaires: "allOpponents",
  auMoinsUnAdversaire: "anyOpponent",
  cartes: "cards",
  poids: "weight",
  blanche: "white",
  bleue: "blue",
}
const CONDITION_FIELDS = ["type", "family", "status", "familyFilter", "roleFilter", "level", "opponent", "mode"]
const en = (v: unknown) => (typeof v === "string" && VALUES[v] ? VALUES[v] : v)

type Condition = Record<string, unknown> & { conditions?: Condition[] }
function translateCondition(c: Condition | undefined): Condition | undefined {
  if (!c || typeof c !== "object") return c
  const out: Condition = { ...c }
  for (const f of CONDITION_FIELDS) if (f in out) out[f] = en(out[f])
  if (Array.isArray(c.conditions)) out.conditions = c.conditions.map((x) => translateCondition(x)!)
  return out
}

type Doc = Record<string, unknown> & { _id: string; _type: string }
type Change = { id: string; set: Record<string, unknown>; unset: string[]; create?: Doc }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const changes: Change[] = []
function change(id: string, set: Record<string, unknown>, unset: string[] = []) {
  const s = Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined))
  if (Object.keys(s).length || unset.length) changes.push({ id, set: s, unset })
}

async function main() {
  const docs = await client.fetch<Doc[]>(
    `*[_type in ["family", "role", "mission", "interface", "texts", "game", "settings"]]`,
  )
  const byId = new Map(docs.map((d) => [d._id, d]))

  for (const d of docs) {
    if (d._type === "family" || d._type === "role") {
      if (en(d.key) !== d.key) change(d._id, { key: en(d.key) })
    }
    if (d._type === "mission") {
      const condition = translateCondition(d.condition as Condition)
      change(d._id, { color: en(d.color) !== d.color ? en(d.color) : undefined, condition: same(condition, d.condition) ? undefined : condition })
    }
    if (d._type === "game" && "decorations" in d) change(d._id, {}, ["decorations"])
    if (d._type === "texts") {
      const set: Record<string, unknown> = {}
      const unset: string[] = []
      if (d.winnerPhrases) {
        if (!d.victoryPhrases) set.victoryPhrases = d.winnerPhrases
        unset.push("winnerPhrases")
      }
      if (d.guestsSettling) {
        const ui = (d.ui_game as Record<string, unknown> | undefined) ?? {}
        if (!ui.waiting) set.ui_game = { ...ui, waiting: d.guestsSettling }
        unset.push("guestsSettling")
      }
      change(d._id, set, unset)
    }
    if (d._type === "interface") {
      const draft = d._id.startsWith("drafts.")
      const set: Record<string, unknown> = {}
      const unset: string[] = []
      for (const [from, to] of [["banquetTop", "decorTop"], ["banquetBottom", "decorBottom"], ["queen", "hero"]]) {
        if (d[from]) {
          if (!d[to]) set[to] = d[from]
          unset.push(from)
        }
      }
      // to the "game" document
      const gameId = draft ? "drafts.game" : "game"
      const toGame: Record<string, unknown> = {}
      for (const f of ["paper", "pictogramFrame", "arrowUp", "arrowDown"]) {
        if (d[f]) {
          if (!byId.get(gameId)?.[f]) toGame[f] = d[f]
          unset.push(f)
        }
      }
      if (Object.keys(toGame).length) {
        if (byId.has(gameId)) change(gameId, toGame)
        else changes.push({ id: gameId, set: {}, unset: [], create: { _id: gameId, _type: "game", ...toGame } })
      }
      // to the "settings" document
      if (d.logo) {
        const settingsId = draft ? "drafts.settings" : "settings"
        if (byId.has(settingsId)) {
          if (!byId.get(settingsId)!.logo) change(settingsId, { logo: d.logo })
        } else changes.push({ id: settingsId, set: {}, unset: [], create: { _id: settingsId, _type: "settings", logo: d.logo } })
        unset.push("logo")
      }
      change(d._id, set, unset)
    }
  }

  if (!changes.length) {
    console.log("Nothing to migrate: the dataset is already up to date.")
    return
  }
  for (const c of changes) {
    if (c.create) console.log(`+ ${c.id} (create) ${JSON.stringify(c.create).slice(0, 200)}`)
    else console.log(`~ ${c.id}${Object.keys(c.set).length ? ` set ${Object.keys(c.set).join(", ")}` : ""}${c.unset.length ? ` unset ${c.unset.join(", ")}` : ""}`)
  }
  console.log(`\n${changes.length} document(s) to modify.`)
  if (!confirm) {
    console.log("Dry run only: re-run with --confirm to apply.")
    return
  }
  const tx = client.transaction()
  for (const c of changes) {
    if (c.create) tx.createIfNotExists(c.create)
    else tx.patch(c.id, (p) => p.set(c.set).unset(c.unset))
  }
  await tx.commit()
  console.log("Migration applied.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
