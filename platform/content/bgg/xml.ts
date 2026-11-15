// What BoardGameGeek's XML API 2 answers, read for the few figures the catalog wants (PLT-78). A small tolerant reader and no XML library: the answers are flat
// (`<item id="…" type="…"> <name type="primary" value="…"/> <minplayers value="2"/> … <statistics><ratings> … </ratings></statistics> </item>`), every figure is
// the `value` attribute of a tag, and a figure BGG does not have is 0 (or missing), which the reader turns into `null`.

/** The figures of one item (`/xmlapi2/thing?id=…&stats=1`). A figure BGG does not have is `null`. */
export type BggThing = {
  id: number
  /** `boardgame` or `boardgameexpansion` */
  type: string
  /** The primary name */
  name: string | null
  /** Every name BGG knows it by, the primary one first: "Take 5" is also "6 nimmt!", and the Studio may use any of them */
  names: string[]
  year: number | null
  minPlayers: number | null
  maxPlayers: number | null
  /** The playing time in minutes (`playingtime`) */
  playingTime: number | null
  minAge: number | null
  /** How hard it is, 1 to 5 (`averageweight`), null when nobody weighed the game */
  weight: number | null
  /** How many weighed it (`numweights`) */
  weights: number
  /** The average rating, out of 10, and how many rated (`usersrated`) */
  rating: number | null
  ratings: number
  /** The place in BGG's ranking of board games, null when it has none */
  rank: number | null
}

/** One result of a search (`/xmlapi2/search?query=…&type=boardgame`). */
export type BggCandidate = { id: number; name: string; year: number | null }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

/** The text of an attribute, with the entities of XML undone. */
export function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
    return ENTITIES[name.toLowerCase()] ?? whole
  })
}

/** The value of an attribute in the text of a tag (`name="primary"` → `primary`), null when the tag has none. */
function attribute(tag: string, name: string): string | null {
  const found = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag)
  const raw = found ? (found[2] ?? found[3] ?? "") : null
  return raw === null ? null : decode(raw)
}

/** The tags `<name …>` of a text, each as the text between its `<` and its `>`. */
function tags(text: string, name: string): string[] {
  return [...text.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((found) => found[0])
}

/** A whole number from a text; null for anything else, and for 0, which is how BGG says that it has no figure. */
function count(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null
  const number = Number.parseInt(value, 10)
  return number > 0 ? number : null
}

/** A decimal number from a text; null for anything else, and for 0. */
function decimal(value: string | null): number | null {
  if (value === null || !/^\d+(\.\d+)?$/.test(value.trim())) return null
  const number = Number.parseFloat(value)
  return number > 0 ? number : null
}

/** The `value` of the first tag of this name in a text, as a whole number. */
const valueOf = (text: string, name: string): string | null => {
  const [tag] = tags(text, name)
  return tag === undefined ? null : attribute(tag, "value")
}

/** The items of an answer: for each, the text of its opening tag and what is inside. An item with no body (`<item id="1"/>`) has an empty one. */
function items(xml: string): { head: string; body: string }[] {
  return [...xml.matchAll(/<item\b([^>]*?)(\/>|>([\s\S]*?)<\/item>)/g)].map((found) => ({ head: found[1] ?? "", body: found[3] ?? "" }))
}

/** The names of an item, the primary one (the name tag marked `primary`, else the first) first. */
function namesOf(body: string): string[] {
  const all = tags(body, "name")
  const primary = all.find((tag) => attribute(tag, "type") === "primary") ?? all[0]
  const ordered = primary === undefined ? [] : [primary, ...all.filter((tag) => tag !== primary)]
  const values = ordered.map((tag) => attribute(tag, "value")).filter((value): value is string => value !== null && value !== "")
  return [...new Set(values)]
}

/** The primary name of an item. */
const nameOf = (body: string): string | null => namesOf(body)[0] ?? null

/**
 * The items of an answer to `thing`, with their figures. An answer that holds no item is an empty list; an item that has no `id` is left out. The rank is the
 * one of the board games (`name="boardgame"`), "Not Ranked" being no rank.
 */
export function parseThings(xml: string): BggThing[] {
  const things: BggThing[] = []
  for (const { head, body } of items(xml)) {
    const id = count(attribute(` ${head}`, "id"))
    if (id === null) continue
    const rank = tags(body, "rank").find((tag) => attribute(tag, "name") === "boardgame")
    things.push({
      id,
      type: attribute(` ${head}`, "type") ?? "boardgame",
      name: nameOf(body),
      names: namesOf(body),
      year: count(valueOf(body, "yearpublished")),
      minPlayers: count(valueOf(body, "minplayers")),
      maxPlayers: count(valueOf(body, "maxplayers")),
      playingTime: count(valueOf(body, "playingtime")),
      minAge: count(valueOf(body, "minage")),
      weight: decimal(valueOf(body, "averageweight")),
      weights: count(valueOf(body, "numweights")) ?? 0,
      rating: decimal(valueOf(body, "average")),
      ratings: count(valueOf(body, "usersrated")) ?? 0,
      rank: rank === undefined ? null : count(attribute(rank, "value")),
    })
  }
  return things
}

/** The results of an answer to `search`: the id, the primary name and the year of each. */
export function parseSearch(xml: string): BggCandidate[] {
  const found: BggCandidate[] = []
  for (const { head, body } of items(xml)) {
    const id = count(attribute(` ${head}`, "id"))
    const name = nameOf(body)
    if (id !== null && name !== null) found.push({ id, name, year: count(valueOf(body, "yearpublished")) })
  }
  return found
}

/**
 * A link of an item to another (`<link type="boardgamepublisher" id="…" value="…" />`): its publishers, designers and artists, the games it comes from, the
 * expansions and reimplementations it has. BGG marks `inbound="true"` the link of an expansion to its base game (a saved answer of BGG shows it), and the game
 * it comes from lists it without; a reimplementation's link to the game it reimplements is taken to work the same way, which no answer seen so far shows.
 */
export type BggLink = { type: string; id: number; name: string; inbound: boolean }

/** One version of a game (`thing?id=…&versions=1`): a printing by a publisher, in a language. */
export type BggVersion = {
  id: number
  /** What BGG calls it ("English edition", "Second edition") */
  name: string | null
  year: number | null
  publishers: string[]
  languages: string[]
  /** The code on the box (a GTIN, an ISBN, a reference of the publisher), null when BGG has none */
  productCode: string | null
}

/** The links of an item's text: one with no type, no id or no name is left out. */
function linksOf(body: string): BggLink[] {
  return tags(body, "link").flatMap((tag) => {
    const type = attribute(tag, "type")
    const id = count(attribute(tag, "id"))
    const name = attribute(tag, "value")
    return type === null || id === null || name === null || name === "" ? [] : [{ type, id, name, inbound: attribute(tag, "inbound") === "true" }]
  })
}

/** The links of the first item of an answer to `thing`. */
export function parseLinks(xml: string): BggLink[] {
  const [first] = items(xml)
  return first === undefined ? [] : linksOf(first.body)
}

/**
 * The versions in an answer to `thing?versions=1`. They are items inside the item of the game, so the block is cut out first (reading the answer as a list of items
 * would end the game's item at the first version's closing tag); an answer with no versions is an empty list.
 */
export function parseVersions(xml: string): BggVersion[] {
  const block = /<versions\b[^>]*>([\s\S]*?)<\/versions>/.exec(xml)?.[1] ?? ""
  const versions: BggVersion[] = []
  for (const { head, body } of items(block)) {
    const id = count(attribute(` ${head}`, "id"))
    if (id === null) continue
    const links = linksOf(body)
    const named = (type: string) => [...new Set(links.filter((link) => link.type === type).map((link) => link.name))]
    versions.push({
      id,
      name: nameOf(body),
      year: count(valueOf(body, "yearpublished")),
      publishers: named("boardgamepublisher"),
      languages: named("language"),
      productCode: valueOf(body, "productcode")?.trim() || null,
    })
  }
  return versions
}
