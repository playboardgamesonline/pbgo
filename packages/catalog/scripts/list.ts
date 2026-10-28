// `pnpm catalog:list`: what the hub would list right now, and why a Notion row is not in it. Reads NOTION_API_KEY from the
// environment (the script loads apps/web/.env.local), calls Notion once and caches nothing. Run by Node, which strips the types,
// hence the `.ts` extensions below. Exits 1 when Notion cannot be read; the token is never printed.

import { GAMES } from "@pbgo/games/registry"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { buildCatalog, type NotionGame } from "../src/catalog.ts"
import { readNotionGames } from "../src/notion.ts"

const token = process.env.NOTION_API_KEY?.trim()

let notionGames: NotionGame[] = []
let header = "NOTION_API_KEY is not set (environment or apps/web/.env.local): only the live games of the registry are listed, with what the registry knows of them."
const notes: string[] = []
if (token) {
  try {
    const read = await readNotionGames({ token })
    notionGames = read.games
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

const players = (value: NotionGame["players"]) => (!value ? "" : value.max === null ? `${value.min}+` : value.min === value.max ? `${value.min}` : `${value.min}-${value.max}`)

/** "P1 · Now / Engine / M": what the Games Development database says of a game, a dash for each column it is empty in; nothing for a game it does not rank at all. */
const development = (value: NotionGame["development"]) => {
  const names = [value.priority, value.status, value.effort].map((rank) => rank?.name ?? "-")
  return names.every((name) => name === "-") ? "" : names.join(" / ")
}

const catalog = buildCatalog(GAMES, notionGames)
// A live game that Notion has no row for is listed with what the registry knows of it (`registryRow`): its figures, no picture, no text
const fromRegistry = (slug: string) => !notionGames.some((game) => game.slug === slug)

const heads = ["slug", "name", "kind", "development", "art", "text", "players", "time", "weight", "age", "categories", "authors", "illustrators", "publisher", "related"]
const rows = catalog.map((entry) => [
  entry.slug,
  entry.game.name,
  entry.live ? (fromRegistry(entry.slug) ? "live (registry)" : "live") : "planned",
  development(entry.game.development),
  marks([["L", entry.game.art.logo], ["I", entry.game.art.icon], ["B", entry.game.art.background]]),
  marks(LANGUAGES.map((language): [string, boolean] => [language.id, Boolean(entry.game.descriptions[language.id])])),
  players(entry.game.players),
  entry.game.duration === null ? "" : `${entry.game.duration}min`,
  entry.game.complexity === null ? "" : entry.game.complexity.toFixed(2),
  entry.game.age === null ? "" : `${entry.game.age}+`,
  entry.game.categories.join(", "),
  entry.game.authors.join(", "),
  entry.game.illustrators.join(", "),
  entry.game.publishers.map((publisher) => publisher.name).join(", "),
  entry.related.join(", "),
])
const widths = heads.map((head, column) => Math.max(head.length, ...rows.map((row) => (row[column] ?? "").length)))
const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join("  ").trimEnd()

console.log(header)
console.log()
console.log(line(heads))
for (const row of rows) console.log(line(row))
if (catalog.some((entry) => entry.live && fromRegistry(entry.slug))) {
  console.log("\nkind: live (registry) is a live game that Notion has no row for, listed with what the registry knows of it")
}
if (notionGames.length > 0) {
  console.log("\ndevelopment: Priority / Status / Effort of the Games Development database, the order of the coming-soon games (a live game keeps its place in the registry)")
  console.log("art: Logo, Icon, Background · text: the languages that have a description · weight: the Complexity column, BoardGameGeek's weight from 1 to 5")
  console.log("related: the games the page of a game lists as related, both ways: the row of either one says so (Related Games, or the base game of a standalone expansion)")
}
if (notes.length > 0) console.log(`\n${notes.join("\n")}`)
