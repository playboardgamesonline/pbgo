// `pnpm catalog:list`: what the hub would list right now, and why a Notion row is not in it. Reads NOTION_API_KEY from the
// environment (the script loads apps/web/.env.local), calls Notion once and caches nothing. Run by Node, which strips the types,
// hence the `.ts` extensions below. Exits 1 when Notion cannot be read; the token is never printed.

import { GAMES } from "@pbgo/games/registry"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { buildCatalog, type PlannedGame } from "../src/catalog.ts"
import { readPlannedGames } from "../src/notion.ts"

const token = process.env.NOTION_API_KEY?.trim()

let planned: PlannedGame[] = []
let header = "NOTION_API_KEY is not set (environment or apps/web/.env.local): only the live games of the registry are listed."
const notes: string[] = []
if (token) {
  try {
    const read = await readPlannedGames({ token })
    planned = read.games
    header = `Notion read: ${read.games.length} games with a slug, ${read.expansions} expansions left out, ${read.skipped.length} rows skipped.`
    for (const row of read.skipped) notes.push(`skipped  ${row.name || row.id}: ${row.reason}`)
    for (const warning of read.warnings) notes.push(`warning  ${warning}`)
  } catch (error) {
    console.error(`Notion could not be read: ${error instanceof Error ? error.message : "unknown error"}`)
    process.exit(1)
  }
}

/** "L - B": the labels that are there, a dash of the same width for the others. */
const marks = (items: [label: string, present: boolean][]) => items.map(([label, present]) => (present ? label : "-".repeat(label.length))).join(" ")

const players = (value: PlannedGame["players"]) => (!value ? "" : value.max === null ? `${value.min}+` : value.min === value.max ? `${value.min}` : `${value.min}-${value.max}`)

const rows = buildCatalog(GAMES, planned).map((entry) =>
  entry.live
    ? [entry.slug, entry.game.name, "live", "", "", "", "", "", "", "", ""]
    : [
        entry.slug,
        entry.game.name,
        "planned",
        marks([["L", entry.game.art.logo], ["I", entry.game.art.icon], ["B", entry.game.art.background]]),
        marks(LANGUAGES.map((language): [string, boolean] => [language.id, Boolean(entry.game.descriptions[language.id])])),
        players(entry.game.players),
        entry.game.duration === null ? "" : `${entry.game.duration}min`,
        entry.game.age === null ? "" : `${entry.game.age}+`,
        entry.game.authors.join(", "),
        entry.game.illustrators.join(", "),
        entry.game.publishers.map((publisher) => publisher.name).join(", "),
      ],
)
const heads = ["slug", "name", "kind", "art", "text", "players", "time", "age", "authors", "illustrators", "publisher"]
const widths = heads.map((head, column) => Math.max(head.length, ...rows.map((row) => (row[column] ?? "").length)))
const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join("  ").trimEnd()

console.log(header)
console.log()
console.log(line(heads))
for (const row of rows) console.log(line(row))
if (planned.length > 0) console.log("\nart: Logo, Icon, Background · text: the languages that have a description")
if (notes.length > 0) console.log(`\n${notes.join("\n")}`)
