// `pnpm catalog:list`: what the hub would list right now, and why a game of the Studio is not in it. Reads the platform's Sanity project
// (its dataset is public: no token) once and caches nothing. Run by Node, which strips the types, hence the `.ts` extensions below. Exits 1
// when the project cannot be read.

import { GAMES } from "@pbgo/games/registry"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { buildCatalog, type CatalogGame } from "../src/catalog.ts"
import { readSanityGames } from "../src/sanity.ts"

let sanityGames: CatalogGame[] = []
let header = ""
const notes: string[] = []
try {
  const read = await readSanityGames({ init: { cache: "no-store" } })
  sanityGames = read.games
  header = `Sanity read: ${read.games.length} games, ${read.skipped.length} skipped.`
  for (const game of read.skipped) notes.push(`skipped  ${game.name || game.id}: ${game.reason}`)
  if (read.expansions > 0) notes.push(`expansions  ${read.expansions} left out: a game of the Studio whose kind is expansion is played with another game, so the hub lists no page for it`)
  for (const warning of read.warnings) notes.push(`warning  ${warning}`)
} catch (error) {
  console.error(`The platform's Sanity project could not be read: ${error instanceof Error ? error.message : "unknown error"}`)
  process.exit(1)
}

/** "L - B": the labels that are there, a dash of the same width for the others. */
const marks = (items: [label: string, present: boolean][]) => items.map(([label, present]) => (present ? label : "-".repeat(label.length))).join(" ")

const players = (value: CatalogGame["players"]) => (!value ? "" : value.max === null ? `${value.min}+` : value.min === value.max ? `${value.min}` : `${value.min}-${value.max}`)

const catalog = buildCatalog(GAMES, sanityGames)
// A live game that the Studio has no game for is listed with what the registry knows of it (`registryRow`)
const fromRegistry = (slug: string) => !sanityGames.some((game) => game.slug === slug)

const heads = ["slug", "name", "kind", "order", "pictures", "text", "players", "time", "weight", "age", "categories", "creators", "publishers", "related"]
const rows = catalog.map((entry) => [
  entry.slug,
  entry.game.name,
  entry.live ? (fromRegistry(entry.slug) ? "live (registry)" : "live") : "planned",
  entry.game.order === null ? "" : String(entry.game.order),
  marks([["L", entry.game.pictures.logo !== null], ["I", entry.game.pictures.icon !== null], ["B", entry.game.pictures.background !== null]]),
  marks(LANGUAGES.map((language): [string, boolean] => [language.id, Boolean(entry.game.descriptions[language.id])])),
  players(entry.game.players),
  entry.game.duration === null ? "" : `${entry.game.duration}min`,
  entry.game.complexity === null ? "" : entry.game.complexity.toFixed(2),
  entry.game.age === null ? "" : `${entry.game.age}+`,
  entry.game.categories.join(", "),
  entry.game.creators.map((creator) => `${creator.name} (${creator.roles.join("/")})`).join(", "),
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
  console.log("\nkind: live (registry) is a live game that the Studio has no game for, listed with what the registry knows of it")
}
console.log("\norder: the `order` of the game in the Studio, lowest first: the order of the games to come (a live game keeps its place in the registry)")
console.log("pictures: Logo, Icon, Background · text: the languages that have a description · weight: the complexity, BoardGameGeek's weight from 1 to 5")
console.log("creators: each person with what they did on the game · related: the games the page of a game recommends, the most relevant first: its family (both ways: the game of either one says so, its related games or its base game), then the games that look like it by their categories")
if (notes.length > 0) console.log(`\n${notes.join("\n")}`)
