// The rules spec of a game (GAM-33, `.claude/skills/game-rules-spec`): `docs/games/<slug>/rules.md`, the page that says what is in the box and how the game is played, in the
// words the engine will follow, and `docs/games/<slug>/index.md`, its landing page (the docs of the site need one for each folder). This file is the one definition of their shape: the
// skill writes them, `pnpm check:rules` judges them with `rulesSpecProblems` and `indexProblems`, `pnpm add-game` reads the verdict, and `engine-rules` and `game-assets` rely on it
// (the component list is what the assets are looked for from, the open points are what the engine asks the owner). Pure and made of what Node strips as it is (type stripping), like
// `scout.ts` that it builds on, so that the test and the scripts cannot disagree. The page comes from an agent that has read web pages and a rulebook: nothing in it is trusted, and a
// sentence about it is made printable.
import { printable } from "./scout.ts"
import { slugProblem } from "./slug.ts"

/** The sections of the page, in this order and no others: every game's spec has the same shape, so that the engine's plan and the assets read them the same way. */
export const SPEC_SECTIONS = [
  "Edition and sources",
  "At a glance",
  "Components",
  "Setup",
  "How a game goes",
  "Rules",
  "End and scoring",
  "Who sees what",
  "Not in this spec",
  "Open points",
  "Glossary",
] as const
export type SpecSection = (typeof SPEC_SECTIONS)[number]

/** The sections that say what the rulebook says: each cites its pages at least once, `(p. 4)`, `(pp. 4–5)` or, for a rulebook that is a web page, `(web)`. */
export const CITING_SECTIONS: readonly SpecSection[] = ["Setup", "How a game goes", "Rules", "End and scoring"]

/** The kinds of component of the table: what `game-assets` looks for art by (a board, a card face and its back, a tile, a token, a die, a sheet), and the rulebook itself. */
export const COMPONENT_KINDS = ["board", "card", "tile", "token", "die", "sheet", "rulebook", "other"] as const
export type ComponentKind = (typeof COMPONENT_KINDS)[number]

/** The columns of the table of the components, and of the glossary. */
export const COMPONENT_COLUMNS = ["Kind", "Component", "Count", "Description", "Page"] as const
export const GLOSSARY_COLUMNS = ["Term", "Meaning"] as const

/** The keys of the lines that open the page: what the rulebook is and how far the spec goes. */
export const EDITION_KEYS = ["Edition", "Rulebook", "Type", "Covers", "Status"] as const

/** The sentence of the section of the open points when there are none. */
export const NO_OPEN_POINT = "None found."

/** The four labelled paragraphs of an open point, in this order. */
export const OPEN_POINT_LABELS = ["Question", "Reading", "Basis", "Status"] as const

/** How long the page may be, and how much of the rulebook it may quote: it says the rules in its own words. */
export const MAX_LENGTH = 120_000
export const MAX_QUOTED = 1_000
const MAX_PROBLEMS = 12

/** How much a section says at the least: a sentence. Two of them may be short, "Nothing." where the spec leaves nothing out and "Nothing is hidden." where no one holds a secret. */
const MIN_SENTENCE = 40
const MIN_CONTENT: Partial<Record<SpecSection, number>> = { Setup: MIN_SENTENCE, "How a game goes": MIN_SENTENCE, Rules: MIN_SENTENCE, "End and scoring": MIN_SENTENCE, "Who sees what": 8, "Not in this spec": 8 }

/** What a terminal obeys or what does not show: control and format characters (zero-width, bidirectional), line and paragraph separators, lone surrogates. A tab is a space. */
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u

/** A page reference: `(p. 4)`, `(pp. 4–5)`, `(p. 4, 6)` or `(web)`. In the table, the cell alone: `4`, `4–5`, `web`. */
const PAGE_RANGE = String.raw`\d+(?:\s?[–-]\s?\d+)?`
const PAGE_REF = new RegExp(String.raw`\((?:pp?\.\s?${PAGE_RANGE}(?:,\s?${PAGE_RANGE})*|web)\)`)
const PAGE_CELL = new RegExp(String.raw`^(?:${PAGE_RANGE}(?:,\s?${PAGE_RANGE})*|web)$`)

const DATE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
const COUNT = /^[1-9]\d{0,3}(?: per player)?$/
const HTML_TAG = /<\/?[A-Za-z][^<>\n]*>/
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME)\b|lorem ipsum/i
const LINK = /\[[^\]\n]*\]\(([^)\n]*)\)/g

/** The type of the game the spec is of, as the scout names it. An expansion and a reimplementation say the game they come from. */
export type SpecType = { type: "base-game" } | { type: "expansion" | "reimplementation"; baseGame: string }

export type SpecComponent = { kind: ComponentKind; name: string; count: string; description: string; page: string }

export type SpecOpenPoint = { title: string; status: "to validate" | "validated" }

export type RulesSpec = {
  /** the name of the game, from the title of the page (`<name>: rules spec`) */
  name: string
  type: SpecType
  /** `null` while the owner has not validated the spec, else the day they did */
  validatedOn: string | null
  players: { min: number; max: number }
  components: SpecComponent[]
  openPoints: SpecOpenPoint[]
}

type Heading = { level: number; text: string; line: number }
/** A section of the page: its heading's line, its body (the lines under the heading, up to the next section) and where the body starts and ends. */
type Section = { name: string; line: number; lines: string[]; first: number; end: number }

/** A bar that is not a cell's edge (`\|`) while the row is cut into cells. */
const ESCAPED_BAR = "@@bar@@"

const isFence = (line: string): string | null => /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1] ?? null

/** The headings that are not in a fenced block, and which lines are in one. */
function scan(lines: readonly string[]): { headings: Heading[]; fenced: boolean[] } {
  const headings: Heading[] = []
  const fenced: boolean[] = []
  let open: string | null = null
  lines.forEach((line, index) => {
    const fence = isFence(line)
    if (open !== null) {
      fenced.push(true)
      const closes = fence !== null && fence[0] === open[0] && fence.length >= open.length && /^ {0,3}[`~]+\s*$/.test(line)
      if (closes) open = null
      return
    }
    if (fence !== null) {
      open = fence
      fenced.push(true)
      return
    }
    fenced.push(false)
    const heading = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line)
    if (heading) headings.push({ level: (heading[1] ?? "").length, text: (heading[2] ?? "").trim(), line: index })
  })
  return { headings, fenced }
}

/** The cells of a row of a table (`| a | b |`), the escaped bars kept. */
function cellsOf(line: string): string[] {
  const text = line.trim().replace(/^\|/, "").replace(/\|$/, "").replace(/\\\|/g, ESCAPED_BAR)
  return text.split("|").map((cell) => cell.split(ESCAPED_BAR).join("|").trim())
}

const isSeparator = (cells: readonly string[]): boolean => cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))

/** The first table of a section: its header and its rows (the line of the separator is not one). */
function tableOf(section: Section): { header: string[]; rows: { cells: string[]; line: number }[] } | null {
  const start = section.lines.findIndex((line) => line.trim().startsWith("|"))
  if (start < 0) return null
  const header = cellsOf(section.lines[start] ?? "")
  const rows: { cells: string[]; line: number }[] = []
  for (let at = start + 1; at < section.lines.length; at += 1) {
    const line = section.lines[at] ?? ""
    if (!line.trim().startsWith("|")) break
    const cells = cellsOf(line)
    if (!isSeparator(cells)) rows.push({ cells, line: section.first + at })
  }
  return { header, rows }
}

/** The `- Key: value` lines of a section, the first of each key. */
function keysOf(section: Section): Map<string, { value: string; count: number }> {
  const keys = new Map<string, { value: string; count: number }>()
  for (const line of section.lines) {
    const found = /^- ([A-Z][A-Za-z ]*): (.+?)\s*$/.exec(line)
    if (!found) continue
    const key = found[1] ?? ""
    const seen = keys.get(key)
    if (seen) seen.count += 1
    else keys.set(key, { value: found[2] ?? "", count: 1 })
  }
  return keys
}

const textOf = (section: Section): string => section.lines.join("\n").trim()
const httpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.hostname.includes(".")
  } catch {
    return false
  }
}

function typeOf(value: string, add: (sentence: string) => void): SpecType | null {
  if (value === "base-game") return { type: "base-game" }
  const found = /^(expansion|reimplementation) of ([a-z0-9-]+)$/.exec(value)
  if (!found) {
    add(`Edition and sources, Type: "${value}" is not base-game, "expansion of <slug>" or "reimplementation of <slug>"`)
    return null
  }
  const baseGame = found[2] ?? ""
  const problem = slugProblem(baseGame)
  if (problem) {
    add(`Edition and sources, Type: the game it comes from: ${problem}`)
    return null
  }
  return { type: found[1] === "expansion" ? "expansion" : "reimplementation", baseGame }
}

/**
 * The spec of a game read from its page: the spec, or what is wrong with the page (at most a dozen sentences, each printable). A page that is not a spec is not judged any further than
 * its sections: the first thing to put right is its shape.
 */
export function readRulesSpec(markdown: string): { spec: RulesSpec | null; problems: string[] } {
  const problems: string[] = []
  const add = (sentence: string) => {
    if (problems.length < MAX_PROBLEMS) problems.push(printable(sentence, 240))
  }
  if (typeof markdown !== "string" || markdown.trim() === "") return { spec: null, problems: ["The page is empty"] }
  if (markdown.length > MAX_LENGTH) return { spec: null, problems: [`The page is ${markdown.length} characters long, ${MAX_LENGTH} at most: it says the rules, it does not copy the rulebook`] }
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  lines.forEach((line, index) => {
    if (HIDDEN.test(line.replace(/\t/g, " "))) add(`Line ${index + 1} has a control character, or one that does not show`)
  })

  const { headings, fenced } = scan(lines)
  const title = headings[0]
  const firstLine = lines.findIndex((line) => line.trim() !== "")
  if (!title || title.level !== 1 || title.line !== firstLine) add("The page starts with its title, a heading of level 1: `# <Game name>: rules spec`")
  if (headings.filter((heading) => heading.level === 1).length > 1) add("There is one heading of level 1, the title: the sections are of level 2")
  const name = /^(.+): rules spec$/.exec(title?.text ?? "")?.[1]?.trim() ?? null
  if (title && title.level === 1 && name === null) add(`The title is "<Game name>: rules spec", not "${title.text}"`)

  // the sections: exactly these, in this order
  const level2 = headings.filter((heading) => heading.level === 2)
  const names = level2.map((heading) => heading.text)
  for (const heading of level2) {
    if (!(SPEC_SECTIONS as readonly string[]).includes(heading.text)) add(`Line ${heading.line + 1}: "${heading.text}" is not a section of the spec (${SPEC_SECTIONS.join(", ")})`)
  }
  for (const wanted of SPEC_SECTIONS) {
    const count = names.filter((found) => found === wanted).length
    if (count === 0) add(`The section "${wanted}" is missing`)
    else if (count > 1) add(`The section "${wanted}" is there ${count} times`)
  }
  const known = names.filter((found): found is SpecSection => (SPEC_SECTIONS as readonly string[]).includes(found))
  const expectedOrder = SPEC_SECTIONS.filter((wanted) => known.includes(wanted))
  if (known.length > 0 && known.join("|") !== expectedOrder.join("|") && new Set(known).size === known.length) add(`The sections are out of order: they come as ${SPEC_SECTIONS.join(", ")}`)

  const sections = new Map<string, Section>()
  for (const heading of level2) {
    if (sections.has(heading.text)) continue
    const next = headings.slice(headings.indexOf(heading) + 1).find((candidate) => candidate.level <= 2)
    const end = next ? next.line : lines.length
    sections.set(heading.text, { name: heading.text, line: heading.line, lines: lines.slice(heading.line + 1, end), first: heading.line + 1, end })
  }
  const section = (wanted: SpecSection): Section | null => sections.get(wanted) ?? null

  for (const [wanted, least] of Object.entries(MIN_CONTENT) as [SpecSection, number][]) {
    const found = section(wanted)
    if (found && textOf(found).length < least) add(`The section "${wanted}" has no content: it says what the rulebook says there${least < MIN_SENTENCE ? ", or in one word that there is nothing to say" : ""}`)
  }

  // the lines that open the page
  let type: SpecType | null = null
  let validatedOn: string | null = null
  let statusOk = false
  const edition = section("Edition and sources")
  if (edition) {
    const keys = keysOf(edition)
    for (const key of EDITION_KEYS) {
      const found = keys.get(key)
      if (!found) add(`Edition and sources: the line "- ${key}: …" is missing`)
      else if (found.count > 1) add(`Edition and sources: "- ${key}:" is there ${found.count} times`)
    }
    const rulebook = keys.get("Rulebook")?.value
    if (rulebook !== undefined && !/https:\/\/\S+/.test(rulebook) && !/file supplied/i.test(rulebook)) add('Edition and sources, Rulebook: gives the address it was read at (https) or says "file supplied"')
    for (const url of (rulebook ?? "").match(/https?:\/\/[^\s),]+/g) ?? []) if (!httpsUrl(url)) add(`Edition and sources, Rulebook: ${url} is not a public https address`)
    const typeValue = keys.get("Type")?.value
    if (typeValue !== undefined) type = typeOf(typeValue, add)
    const status = keys.get("Status")?.value
    if (status !== undefined) {
      const found = /^validated (\S+)$/.exec(status)
      if (status === "draft") statusOk = true
      else if (found && DATE.test(found[1] ?? "")) {
        statusOk = true
        validatedOn = found[1] ?? null
      } else add(`Edition and sources, Status: "${status}" is "draft" or "validated YYYY-MM-DD"`)
    }
  }

  // at a glance
  let players: { min: number; max: number } | null = null
  const glance = section("At a glance")
  if (glance) {
    const keys = keysOf(glance)
    for (const key of ["Players", "Goal"]) if (!keys.has(key)) add(`At a glance: the line "- ${key}: …" is missing`)
    const value = keys.get("Players")?.value
    if (value !== undefined) {
      const found = /^(\d+)(?:\s?[–-]\s?(\d+))?(?:\D|$)/.exec(value)
      const min = Number(found?.[1])
      const max = found?.[2] === undefined ? min : Number(found[2])
      if (!found || min < 1 || max < min || max > 99) add(`At a glance, Players: "${value}" starts with the number of players, "2–4" or "3"`)
      else players = { min, max }
    }
  }

  // the components
  const components: SpecComponent[] = []
  const box = section("Components")
  if (box) {
    const table = tableOf(box)
    if (!table) add(`Components: a table of the components with the columns ${COMPONENT_COLUMNS.join(" | ")}`)
    else if (table.header.join("|").toLowerCase() !== COMPONENT_COLUMNS.join("|").toLowerCase()) add(`Components: the columns of the table are ${COMPONENT_COLUMNS.join(" | ")}, not ${table.header.join(" | ")}`)
    else {
      if (table.rows.length === 0) add("Components: the table has no row")
      for (const row of table.rows) {
        const [kind = "", component = "", count = "", description = "", page = ""] = row.cells
        const where = `Line ${row.line + 1}`
        if (row.cells.length !== COMPONENT_COLUMNS.length) {
          add(`${where}: a row of the components has ${COMPONENT_COLUMNS.length} cells, this one ${row.cells.length}`)
          continue
        }
        if (!(COMPONENT_KINDS as readonly string[]).includes(kind)) add(`${where}: the kind "${kind}" is not one of ${COMPONENT_KINDS.join(", ")}`)
        if (component === "") add(`${where}: a component has a name`)
        if (!COUNT.test(count)) add(`${where}: the count "${count}" is a number, or a number and "per player"`)
        if (description === "") add(`${where}: ${component || "a component"} has a description`)
        if (!PAGE_CELL.test(page)) add(`${where}: the page "${page}" is a page, "4–5" or "web"`)
        components.push({ kind: kind as ComponentKind, name: component, count, description, page })
      }
    }
  }

  // the pages the rulebook is cited by
  for (const wanted of CITING_SECTIONS) {
    const found = section(wanted)
    if (found && textOf(found).length >= MIN_SENTENCE && !PAGE_REF.test(textOf(found))) add(`${wanted}: cites no page of the rulebook, "(p. 4)", "(pp. 4–5)" or "(web)"`)
  }

  // the open points
  const openPoints: SpecOpenPoint[] = []
  const open = section("Open points")
  if (open && textOf(open) !== NO_OPEN_POINT) {
    const own = headings.filter((heading) => heading.level === 3 && heading.line > open.line && heading.line < open.end)
    if (own.length === 0) add(`Open points: one heading of level 3 for each case the rulebook leaves open, or the line "${NO_OPEN_POINT}" when it leaves none`)
    own.forEach((heading, index) => {
      const end = own[index + 1]?.line ?? open.end
      const body = lines.slice(heading.line + 1, end)
      const label = (wanted: string): string | null => {
        const found = body.find((line) => line.startsWith(`**${wanted}.** `))
        return found ? found.slice(`**${wanted}.** `.length).trim() : null
      }
      let status: SpecOpenPoint["status"] = "to validate"
      for (const wanted of OPEN_POINT_LABELS) {
        const value = label(wanted)
        if (value === null || value === "") add(`Open point "${heading.text}": the paragraph "**${wanted}.** …" is missing`)
        else if (wanted === "Status") {
          if (value === "to validate") status = "to validate"
          else if (/^validated \d{4}-\d{2}-\d{2}$/.test(value) && DATE.test(value.slice("validated ".length))) status = "validated"
          else add(`Open point "${heading.text}": its status is "to validate" or "validated YYYY-MM-DD", not "${value}"`)
        }
      }
      openPoints.push({ title: heading.text, status })
    })
  }

  // the glossary
  const glossary = section("Glossary")
  if (glossary) {
    const table = tableOf(glossary)
    if (!table) add(`Glossary: a table with the columns ${GLOSSARY_COLUMNS.join(" | ")}`)
    else if (table.header.join("|").toLowerCase() !== GLOSSARY_COLUMNS.join("|").toLowerCase()) add(`Glossary: the columns of the table are ${GLOSSARY_COLUMNS.join(" | ")}, not ${table.header.join(" | ")}`)
    else if (table.rows.length === 0) add("Glossary: the table has no row")
    else for (const row of table.rows) if (row.cells.length !== GLOSSARY_COLUMNS.length || row.cells.some((cell) => cell === "")) add(`Line ${row.line + 1}: a row of the glossary is a term and its meaning`)
  }

  // what a page of the docs may not hold: markup the renderer does not take, a placeholder, a picture, an address that is not https, more of the rulebook than a few words
  let quoted = 0
  lines.forEach((line, index) => {
    const where = `Line ${index + 1}`
    if (fenced[index]) return
    if (/^\s*>/.test(line)) quoted += line.length
    if (HTML_TAG.test(line)) add(`${where} has an HTML tag or a <placeholder>: the page is markdown`)
    if (PLACEHOLDER.test(line)) add(`${where} has a placeholder (TODO, TBD…): say what the rulebook says or put the case in the open points`)
    if (/!\[[^\]]*\]\(/.test(line)) add(`${where} has a picture: the spec is text, the art is the owner's`)
    if (/http:\/\//i.test(line)) add(`${where} has an address that is not https`)
    for (const found of line.matchAll(LINK)) {
      const target = found[1] ?? ""
      if (!target.startsWith("https://") && !target.startsWith("#")) add(`${where} links to "${target}": a link is an https address or an anchor of the page`)
    }
  })
  if (quoted > MAX_QUOTED) add(`The page quotes ${quoted} characters of the rulebook, ${MAX_QUOTED} at most: it says the rules in its own words`)

  if (problems.length > 0 || name === null || type === null || !statusOk || players === null) return { spec: null, problems }
  return { spec: { name, type, validatedOn, players, components, openPoints }, problems: [] }
}

/** What is wrong with a spec page, or an empty list. */
export const rulesSpecProblems = (markdown: string): string[] => readRulesSpec(markdown).problems

/** The page that says what the spec is, in the docs: its title is the game's name and it links to the spec. A folder of the docs needs one. */
export function indexProblems(markdown: string, name?: string): string[] {
  const problems: string[] = []
  const add = (sentence: string) => problems.push(printable(sentence, 240))
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  if (lines.some((line) => HIDDEN.test(line.replace(/\t/g, " ")))) add("The page has a control character, or one that does not show")
  const first = lines.find((line) => line.trim() !== "") ?? ""
  const title = /^# (.+?)\s*$/.exec(first)?.[1]
  if (title === undefined) add("The page starts with its title, a heading of level 1: `# <Game name>`")
  else if (name !== undefined && title !== name) add(`The title is "${title}", the name of the game is "${name}"`)
  if (!markdown.includes("](./rules.md)")) add("The page links to the spec: [Rules spec](./rules.md)")
  if (lines.filter((line) => line.trim() !== "").length > 12) add("The landing page is a few lines: the spec is rules.md")
  return problems
}

/** What the spec of a game is called in the docs, and where it is. */
export function specPathsOf(docsGames: string, slug: string): { dir: string; rules: string; index: string } {
  const dir = `${docsGames.replace(/\/$/, "")}/${slug}`
  return { dir, rules: `${dir}/rules.md`, index: `${dir}/index.md` }
}

/**
 * The spec as the owner validated it: the status of the page and of every case that waited for the owner's word become "validated" with the day. Validating the spec is accepting
 * the readings it proposes, which the gate says. A page that is validated already is left as it is.
 */
export function stampValidated(markdown: string, date: string): string {
  if (!DATE.test(date)) throw new Error(`"${date}" is not a day (YYYY-MM-DD)`)
  return markdown.replace(/^- Status: draft[ \t]*$/m, `- Status: validated ${date}`).replace(/^(\*\*Status\.\*\* )to validate[ \t]*$/gm, `$1validated ${date}`)
}

/** One line for a report: what the spec holds. */
export function describeSpec(spec: RulesSpec): string {
  const kinds = new Set(spec.components.map((component) => component.kind)).size
  const waiting = spec.openPoints.filter((point) => point.status === "to validate").length
  const open = spec.openPoints.length === 0 ? "no open point" : `${spec.openPoints.length} open point${spec.openPoints.length === 1 ? "" : "s"} (${waiting} to validate)`
  return `${spec.name}: ${spec.players.min === spec.players.max ? spec.players.min : `${spec.players.min}–${spec.players.max}`} players, ${spec.components.length} component${spec.components.length === 1 ? "" : "s"} of ${kinds} kind${kinds === 1 ? "" : "s"}, ${open}, ${spec.validatedOn ? `validated ${spec.validatedOn}` : "draft"}`
}
