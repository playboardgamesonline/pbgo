import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  CITING_SECTIONS,
  COMPONENT_COLUMNS,
  COMPONENT_KINDS,
  describeSpec,
  EDITION_KEYS,
  GLOSSARY_COLUMNS,
  indexProblems,
  MAX_LENGTH,
  MAX_QUOTED,
  NO_OPEN_POINT,
  OPEN_POINT_LABELS,
  readRulesSpec,
  rulesSpecProblems,
  SPEC_SECTIONS,
  specPathsOf,
  stampValidated,
} from "./rules-spec.ts"

// The spec of a game as the skill `game-rules-spec` writes it, and every way for it to be wrong: what the pipeline, the engine and the assets read must be what `rulesSpecProblems`
// accepts, and nothing else. The page the tests start from is the skill's own example, so that the skill and the contract cannot disagree.
const REPO = new URL("../../../", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, REPO), "utf8")
const skill = read(".claude/skills/game-rules-spec/SKILL.md")
const block = (info: string) => new RegExp(`\`\`\`markdown ${info}\\n([\\s\\S]*?)\\n\`\`\``).exec(skill)?.[1] ?? ""
const SPEC = block("rules")
const INDEX = block("index")

/** A character by its code point: the ones that hide are not written out in this file. */
const char = (code: number) => String.fromCodePoint(code)

/** The page with `from` changed to `to`; a change that finds nothing is a mistake of the test, not a pass. */
function changed(from: string | RegExp, to: string | ((substring: string, ...groups: string[]) => string), text = SPEC): string {
  if (typeof from === "string" ? !text.includes(from) : !new RegExp(from.source, from.flags.replace("g", "")).test(text)) throw new Error(`the example has nothing to change at ${String(from)}`)
  return text.replace(from, to as string)
}

/** The body of a section of the example, and the page with that body replaced. */
const sectionRule = (name: string) => new RegExp(`(\\n## ${name}\\n)([\\s\\S]*?)(?=\\n## |$)`)
const bodyOf = (name: string) => sectionRule(name).exec(SPEC)?.[2] ?? ""
const withBody = (name: string, body: string, text = SPEC) => changed(sectionRule(name), (_all, heading: string) => `${heading}${body}`, text)
const without = (name: string) => changed(sectionRule(name), "")

const has = (text: string, sentence: string | RegExp) => {
  const problems = rulesSpecProblems(text)
  expect(problems.length, "a problem").toBeGreaterThan(0)
  if (typeof sentence === "string") expect(problems.join("\n")).toContain(sentence)
  else expect(problems.join("\n")).toMatch(sentence)
}

describe("the example of the skill", () => {
  it("is a spec that the validator accepts, with what it says it holds", () => {
    const { spec, problems } = readRulesSpec(SPEC)
    expect(problems).toEqual([])
    expect(spec).toMatchObject({ name: "Orchard Run", type: { type: "base-game" }, validatedOn: null, players: { min: 2, max: 4 } })
    expect(spec?.components.map((component) => [component.kind, component.name, component.count])).toEqual([
      ["card", "Fruit card", "36"],
      ["card", "Crow card", "6"],
      ["token", "First player token", "1"],
      ["sheet", "Score pad", "1"],
      ["rulebook", "Rulebook", "1"],
    ])
    expect(spec?.openPoints).toEqual([
      { title: "The draw pile is empty", status: "to validate" },
      { title: "A crow completes two sets", status: "to validate" },
    ])
  })

  it("has a landing page that the validator accepts", () => {
    expect(indexProblems(INDEX, "Orchard Run")).toEqual([])
    expect(indexProblems(INDEX)).toEqual([])
  })

  it("uses every section the validator asks for, and the columns it asks for", () => {
    for (const section of SPEC_SECTIONS) expect(skill, section).toContain(`- **${section}.**`)
    expect(skill).toContain(`| ${COMPONENT_COLUMNS.join(" | ")} |`)
    expect(skill).toContain(`| ${GLOSSARY_COLUMNS.join(" | ")} |`)
    for (const kind of COMPONENT_KINDS) expect(skill, kind).toContain(`\`${kind}\``)
    for (const key of EDITION_KEYS) expect(skill, key).toContain(`\`${key}\``)
    for (const label of OPEN_POINT_LABELS) expect(skill, label).toContain(`**${label}.**`)
  })
})

describe("the shape of the page", () => {
  it.each([...SPEC_SECTIONS])("has the section %s", (section) => {
    has(without(section), `The section "${section}" is missing`)
  })

  it("has the sections in their order, and no other", () => {
    const swapped = changed(/(\n## Components\n[\s\S]*?)(\n## Setup\n[\s\S]*?)(?=\n## How a game goes)/, (_all, first: string, second: string) => `${second}${first}`)
    has(swapped, "The sections are out of order")
    has(`${SPEC}\n## Extra\n\nA section that is not in the list of the spec.\n`, '"Extra" is not a section of the spec')
    has(`${SPEC}\n## Glossary\n\n| Term | Meaning |\n| --- | --- |\n| A | b |\n`, 'The section "Glossary" is there 2 times')
  })

  it("starts with its title, `<name>: rules spec`, and has one", () => {
    has(changed("# Orchard Run: rules spec", "# Orchard Run"), 'The title is "<Game name>: rules spec", not "Orchard Run"')
    has(changed("# Orchard Run: rules spec", "Some text before the title.\n\n# Orchard Run: rules spec"), "The page starts with its title")
    has(changed("## Setup", "# A second title\n\n## Setup"), "There is one heading of level 1")
    has(changed("# Orchard Run: rules spec\n", "## Setup\n"), "The page starts with its title")
  })

  it("is not empty and not the rulebook copied", () => {
    expect(rulesSpecProblems("")).toEqual(["The page is empty"])
    expect(rulesSpecProblems("   \n\n")).toEqual(["The page is empty"])
    expect(rulesSpecProblems(`${SPEC}\n${"x".repeat(MAX_LENGTH)}`)[0]).toContain("at most")
  })

  it("does not take a heading in a fenced block for a section, nor markup in it for a problem", () => {
    const fenced = changed("### Harvest", "```\n## Not a section\n<b>raw</b>\n```\n\n### Harvest")
    expect(rulesSpecProblems(fenced)).toEqual([])
    expect(rulesSpecProblems(changed("### Harvest", "~~~\n## Not a section\n~~~\n\n### Harvest"))).toEqual([])
  })

  it("says the same of a page with windows line ends", () => {
    expect(rulesSpecProblems(SPEC.replace(/\n/g, "\r\n"))).toEqual([])
  })

  it("is judged in a dozen sentences at most, however little there is", () => {
    const problems = rulesSpecProblems("# Stub\n\nNothing here.\n")
    expect(problems.length).toBeGreaterThan(5)
    expect(problems.length).toBeLessThanOrEqual(12)
  })

  it("is made of sentences that print as they are: what the page holds that hides is shown as its code", () => {
    const hidden = changed("## Who sees what", `## Who sees what\n\nA${char(0x202e)}B${char(0x200b)}\n`)
    const problems = rulesSpecProblems(hidden)
    expect(problems.join("\n")).toContain("has a control character")
    expect(problems.join("\n")).not.toMatch(/\p{Cf}/u)
    expect(rulesSpecProblems(changed("## Setup", `## Setup\n\nTab\there${char(0x07)}\n`)).join("\n")).toContain("has a control character")
    // a tab is a space
    expect(rulesSpecProblems(changed("1. Shuffle the 42", "1.\tShuffle the 42"))).toEqual([])
  })
})

describe("the lines that open the page", () => {
  it.each([...EDITION_KEYS])("asks for the line %s, once", (key) => {
    has(changed(new RegExp(`^- ${key}: .*\\n`, "m"), ""), `the line "- ${key}: …" is missing`)
    has(changed(new RegExp(`^(- ${key}: .*)$`, "m"), "$1\n$1"), `"- ${key}:" is there 2 times`)
  })

  it("says the type: a base game, or an expansion or a reimplementation of a game", () => {
    const expansion = readRulesSpec(changed("- Type: base-game", "- Type: expansion of love-letter"))
    expect(expansion.problems).toEqual([])
    expect(expansion.spec?.type).toEqual({ type: "expansion", baseGame: "love-letter" })
    expect(readRulesSpec(changed("- Type: base-game", "- Type: reimplementation of flip-7")).spec?.type).toEqual({ type: "reimplementation", baseGame: "flip-7" })
    has(changed("- Type: base-game", "- Type: expansion"), 'Type: "expansion" is not base-game')
    has(changed("- Type: base-game", "- Type: game"), 'Type: "game" is not base-game')
    has(changed("- Type: base-game", "- Type: expansion of Love Letter"), "is not base-game")
    has(changed("- Type: base-game", "- Type: expansion of api"), "the game it comes from")
  })

  it("says the status: a draft, or the day the owner validated it", () => {
    expect(readRulesSpec(changed("- Status: draft", "- Status: validated 2026-11-17")).spec?.validatedOn).toBe("2026-11-17")
    for (const status of ["validated", "validated 2026-13-01", "validated 17/11/2026", "done", "Draft", "validated 2026-02-31x"]) has(changed("- Status: draft", `- Status: ${status}`), "Status:")
  })

  it("says where the rulebook was read: a public https address, or that the file was supplied", () => {
    expect(rulesSpecProblems(changed(/^- Rulebook: .*$/m, "- Rulebook: French, 12 pages, file supplied by the owner"))).toEqual([])
    has(changed(/^- Rulebook: .*$/m, "- Rulebook: English, 8 pages"), "gives the address it was read at")
    has(changed(/^- Rulebook: .*$/m, "- Rulebook: English, http://example.com/rules.pdf"), "is not a public https address")
    has(changed(/^- Rulebook: .*$/m, "- Rulebook: English, https://user:pass@example.com/rules.pdf"), "is not a public https address")
  })

  it("lets other lines follow", () => {
    expect(rulesSpecProblems(changed("- Status: draft", "- Status: draft\n- FAQ: https://example.com/faq (read)"))).toEqual([])
  })
})

describe("at a glance", () => {
  it("has the players and the goal", () => {
    has(changed(/^- Players: .*\n/m, ""), 'the line "- Players: …" is missing')
    has(changed(/^- Goal: .*\n/m, ""), 'the line "- Goal: …" is missing')
  })

  it.each([
    ["2", 2, 2],
    ["2–4", 2, 4],
    ["3-5 (with the expansion 6)", 3, 5],
    ["1 (solo)", 1, 1],
  ])("reads the players %j", (value, min, max) => {
    const { spec, problems } = readRulesSpec(changed(/^- Players: .*$/m, `- Players: ${value}`))
    expect(problems).toEqual([])
    expect(spec?.players).toEqual({ min, max })
  })

  it.each(["many", "4–2", "0–4", "2–100", "players: 2", ""])("refuses the players %j", (value) => {
    has(changed(/^- Players: .*$/m, `- Players: ${value}`.trimEnd()), /Players/)
  })
})

describe("the components", () => {
  const row = (cells: string) => changed("| rulebook | Rulebook | 1 | A booklet of eight pages | 1 |", cells)

  it("are a table, with the columns that are asked for, and a row at least", () => {
    has(withBody("Components", "\nNothing is listed.\n"), "a table of the components")
    has(changed("| Kind | Component | Count | Description | Page |", "| Type | Component | Count | Description | Page |"), "the columns of the table are Kind | Component | Count | Description | Page, not Type")
    has(withBody("Components", "\n| Kind | Component | Count | Description | Page |\n| --- | --- | --- | --- | --- |\n\nNothing.\n"), "the table has no row")
  })

  it("have a kind of the list", () => {
    for (const kind of COMPONENT_KINDS) expect(rulesSpecProblems(changed("| card | Fruit card |", `| ${kind} | Fruit card |`))).toEqual([])
    has(changed("| card | Fruit card |", "| cards | Fruit card |"), 'the kind "cards" is not one of board, card')
    has(changed("| card | Fruit card |", "|  | Fruit card |"), "the kind")
  })

  it.each([
    ["36", true],
    ["1", true],
    ["2 per player", true],
    ["9999", true],
    ["0", false],
    ["-1", false],
    ["x", false],
    ["3 per team", false],
    ["2.5", false],
    ["10000", false],
    ["", false],
  ])("have a count: %j is %s", (count, good) => {
    const text = changed("| Fruit card | 36 |", `| Fruit card | ${count} |`)
    if (good) expect(rulesSpecProblems(text)).toEqual([])
    else has(text, `the count "${count}"`)
  })

  it.each([
    ["2", true],
    ["2–3", true],
    ["2-3", true],
    ["2, 4", true],
    ["web", true],
    ["p. 2", false],
    ["two", false],
    ["", false],
  ])("have a page of the rulebook: %j is %s", (page, good) => {
    const text = changed("| A pad of sheets, one for each player, to write the points on | 2 |", `| A pad of sheets, one for each player, to write the points on | ${page} |`)
    if (good) expect(rulesSpecProblems(text)).toEqual([])
    else has(text, `the page "${page}"`)
  })

  it("have a name and a description, and a row has the cells of the table", () => {
    has(changed("| card | Fruit card |", "| card |  |"), "a component has a name")
    has(changed("| An action card that steals the top card of an opponent's basket |", "|  |"), "has a description")
    has(row("| rulebook | Rulebook | 1 | A booklet of eight pages |"), "a row of the components has 5 cells, this one 4")
  })

  it("keep a bar that is escaped inside a cell", () => {
    expect(readRulesSpec(changed("A wooden apple that marks who starts", "A wooden apple \\| or a pear, that marks who starts")).spec?.components[2]?.description).toBe("A wooden apple | or a pear, that marks who starts")
  })
})

describe("the pages the rulebook is cited by", () => {
  const cited = (name: string, replacement: string) => withBody(name, bodyOf(name).replace(/\((?:pp?\.[^)]*|web)\)/g, replacement))

  it.each([...CITING_SECTIONS])("are asked for in %s", (section) => {
    has(cited(section, ""), `${section}: cites no page of the rulebook`)
  })

  it.each(["(p. 4)", "(pp. 4–5)", "(pp. 4-5)", "(p. 4, 6)", "(p. 4, 6–7)", "(web)"])("take %s", (reference) => {
    for (const section of CITING_SECTIONS) expect(rulesSpecProblems(cited(section, reference)), section).toEqual([])
  })

  it.each(["(page 4)", "(4)", "p. 4", "(p.)", "[p. 4]"])("do not take %s", (reference) => {
    has(cited("Rules", reference), "Rules: cites no page")
  })

  it("are not asked for where the rulebook is not cited from", () => {
    expect(rulesSpecProblems(withBody("Who sees what", "\nNothing is hidden.\n"))).toEqual([])
    expect(rulesSpecProblems(withBody("Not in this spec", "\nNothing.\n"))).toEqual([])
  })

  it("have a sentence at the least in the sections that say the rules, and a word in the two that may say nothing", () => {
    has(withBody("Setup", "\nShuffle. (p. 3)\n"), 'The section "Setup" has no content')
    has(withBody("Who sees what", "\nNo.\n"), 'The section "Who sees what" has no content')
    has(withBody("Not in this spec", "\nNone.\n"), 'The section "Not in this spec" has no content')
  })
})

describe("the open points", () => {
  it("may be none, in the one line that says so", () => {
    const { spec, problems } = readRulesSpec(withBody("Open points", `\n${NO_OPEN_POINT}\n`))
    expect(problems).toEqual([])
    expect(spec?.openPoints).toEqual([])
    has(withBody("Open points", "\nNone.\n"), "Open points: one heading of level 3")
    has(withBody("Open points", "\nSome cases are open.\n"), "Open points: one heading of level 3")
  })

  it.each([...OPEN_POINT_LABELS])("have the paragraph %s", (label) => {
    has(changed(new RegExp(`^\\*\\*${label}\\.\\*\\* .*\\n`, "m"), ""), `Open point "The draw pile is empty": the paragraph "**${label}.** …" is missing`)
  })

  it("have a status: to validate, or validated on a day", () => {
    const validated = readRulesSpec(changed("**Status.** to validate", "**Status.** validated 2026-11-17"))
    expect(validated.problems).toEqual([])
    expect(validated.spec?.openPoints[0]?.status).toBe("validated")
    for (const status of ["validated", "decided", "to validate later", "validated 2026-99-99"]) has(changed("**Status.** to validate", `**Status.** ${status}`), "its status is")
  })

  it("count each case once, whatever its text", () => {
    const more = `${bodyOf("Open points")}\n### A third case\n\n**Question.** q\n**Reading.** r\n**Basis.** b\n**Status.** to validate\n`
    expect(readRulesSpec(withBody("Open points", more)).spec?.openPoints).toHaveLength(3)
  })
})

describe("the glossary", () => {
  it("is a table of terms and meanings", () => {
    has(withBody("Glossary", "\nThe words are the rulebook's.\n"), "Glossary: a table with the columns Term | Meaning")
    has(changed("| Term | Meaning |", "| Word | Meaning |"), "the columns of the table are Term | Meaning, not Word")
    has(withBody("Glossary", "\n| Term | Meaning |\n| --- | --- |\n"), "the table has no row")
    has(changed("| Basket | The row of fruit cards a player has played in front of them |", "| Basket |  |"), "a row of the glossary is a term and its meaning")
  })
})

describe("what a page of the docs may not hold", () => {
  const into = (line: string) => changed("Nothing else is needed to play (p. 2).", line)

  it("is no raw markup, and no placeholder", () => {
    has(into("Nothing else <br> is needed (p. 2)."), "has an HTML tag")
    has(into("Put the <number of cards> here (p. 2)."), "has an HTML tag or a <placeholder>")
    expect(rulesSpecProblems(into("A hand has fewer than 5 cards, and 2 < 3 (p. 2)."))).toEqual([])
    for (const word of ["TODO", "TBD", "FIXME", "Lorem ipsum"]) has(into(`${word}: to write (p. 2).`), "has a placeholder")
  })

  it("is text: no picture", () => {
    has(into("![the box](https://example.com/box.png) (p. 2)"), "has a picture")
  })

  it("links to https addresses and to its own anchors, nothing else", () => {
    expect(rulesSpecProblems(into("See [the FAQ](https://example.com/faq) and [the harvest](#harvest) (p. 2)."))).toEqual([])
    has(into("See [the FAQ](http://example.com/faq) (p. 2)."), "an address that is not https")
    has(into("See [the spec](./other.md) (p. 2)."), 'links to "./other.md"')
    has(into("See [a file](file:///etc/passwd) (p. 2)."), 'links to "file:///etc/passwd"')
    has(into("See [a script](javascript:alert(1)) (p. 2)."), "links to")
    has(into("See [mail](mailto:a@b.c) (p. 2)."), "links to")
  })

  it("quotes a few words of the rulebook, not pages of it", () => {
    expect(rulesSpecProblems(into(`> "A set." (p. 2)`))).toEqual([])
    has(into(`> ${"a rule of the booklet ".repeat(Math.ceil(MAX_QUOTED / 20))}`), "of the rulebook")
  })
})

describe("the validation", () => {
  it("stamps the page and every reading that waited with the day", () => {
    const stamped = stampValidated(SPEC, "2026-11-17")
    expect(stamped).toContain("- Status: validated 2026-11-17")
    expect(stamped.match(/^\*\*Status\.\*\* validated 2026-11-17$/gm)).toHaveLength(2)
    expect(stamped).not.toContain("to validate")
    const { spec, problems } = readRulesSpec(stamped)
    expect(problems).toEqual([])
    expect(spec?.validatedOn).toBe("2026-11-17")
    expect(spec?.openPoints.map((point) => point.status)).toEqual(["validated", "validated"])
  })

  it("leaves a page that is validated as it is, and changes nothing else", () => {
    const stamped = stampValidated(SPEC, "2026-11-17")
    expect(stampValidated(stamped, "2026-12-24")).toBe(stamped)
    expect(stamped.replace(/validated 2026-11-17/g, "x")).toBe(SPEC.replace(/^- Status: draft$/m, "- Status: x").replace(/to validate/g, "x"))
  })

  it("refuses what is not a day", () => {
    for (const day of ["", "today", "2026-13-01", "17-11-2026", "2026-11-17T10:00"]) expect(() => stampValidated(SPEC, day), day).toThrow("is not a day")
  })
})

describe("what a report says of a spec", () => {
  it("is a line: the name, the players, the components, the open points, where it stands", () => {
    expect(describeSpec(readRulesSpec(SPEC).spec!)).toBe("Orchard Run: 2–4 players, 5 components of 4 kinds, 2 open points (2 to validate), draft")
    const stamped = readRulesSpec(stampValidated(SPEC, "2026-11-17")).spec!
    expect(describeSpec(stamped)).toBe("Orchard Run: 2–4 players, 5 components of 4 kinds, 2 open points (0 to validate), validated 2026-11-17")
    const small = readRulesSpec(withBody("Open points", `\n${NO_OPEN_POINT}\n`).replace(/^- Players: .*$/m, "- Players: 2")).spec!
    expect(describeSpec(small)).toContain("2 players")
    expect(describeSpec(small)).toContain("no open point")
  })
})

describe("the landing page", () => {
  it("is the name of the game and a link to the spec, in a few lines", () => {
    expect(indexProblems("# Orchard Run\n\n[Rules spec](./rules.md)\n", "Orchard Run")).toEqual([])
    expect(indexProblems("# Orchard Run\n\n[Rules spec](./rules.md)\n", "Another Game")).toEqual(['The title is "Orchard Run", the name of the game is "Another Game"'])
    expect(indexProblems("Orchard Run\n\n[Rules spec](./rules.md)\n")).toEqual(["The page starts with its title, a heading of level 1: `# <Game name>`"])
    expect(indexProblems("# Orchard Run\n\nNo link.\n")).toEqual(["The page links to the spec: [Rules spec](./rules.md)"])
    expect(indexProblems(`# Orchard Run\n\n[Rules spec](./rules.md)\n${"a line\n".repeat(12)}`)).toEqual(["The landing page is a few lines: the spec is rules.md"])
    expect(indexProblems(`# Orchard Run${char(0x200b)}\n\n[Rules spec](./rules.md)\n`)).toContain("The page has a control character, or one that does not show")
  })
})

describe("where a spec is", () => {
  it("is docs/games/<slug>/rules.md, with its landing page next to it", () => {
    expect(specPathsOf("docs/games", "love-letter")).toEqual({ dir: "docs/games/love-letter", rules: "docs/games/love-letter/rules.md", index: "docs/games/love-letter/index.md" })
    expect(specPathsOf("/tmp/docs/games/", "x").rules).toBe("/tmp/docs/games/x/rules.md")
  })
})

describe("the skill game-rules-spec", () => {
  it("is named after its folder and says which agent carries it out", () => {
    const front = /^---\nname: (.+)\ndescription: "(.+)"\n---\n/.exec(skill)
    expect(front?.[1]).toBe("game-rules-spec")
    expect(front?.[2]).toMatch(/^\[GAME agent\] /)
  })

  it("shows the two examples once, the report and the blocked report", () => {
    expect([...skill.matchAll(/```markdown rules\n/g)]).toHaveLength(1)
    expect([...skill.matchAll(/```markdown index\n/g)]).toHaveLength(1)
    expect(skill).toContain("Validate also accepts the 3 readings of the open points. Validate, or tell me what to change: components, rules, open points.")
    expect(skill).toContain("Put it at   ~/Companies/PBGO/assets/sample-game/rules.pdf, then type retry")
  })

  it("names commands that exist", () => {
    const root = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    for (const name of ["check:rules", "check:scout"]) {
      expect(skill).toContain(`pnpm ${name}`)
      expect(root.scripts).toHaveProperty(name)
    }
  })

  it("is in the list of the skills, and in the table of a game from A to Z as written", () => {
    const readme = read(".claude/skills/README.md")
    expect(readme).toContain("- `game-rules-spec` — ")
    expect(readme).toMatch(/\| `game-rules-spec` \(GAM-33\) \| [^|]+ \| written \|/)
  })

  it("has nothing in it that hides", () => {
    expect(skill.replace(/[\t\n]/g, " ")).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u)
  })
})
