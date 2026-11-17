import { readFileSync } from "node:fs"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { addressOf, buildSections, frontMatterOf, type DocFile } from "./docs"
import { Markdown } from "./markdown"

// The rules spec of a game is a page of the docs (`docs/games/<slug>/rules.md`, written by the skill `game-rules-spec`): what the skill shows as its example must be what the site can draw,
// since a page that the renderer or the menu refuses stops the build of the whole site once it is committed.
const SKILL = readFileSync(new URL("../../../.claude/skills/game-rules-spec/SKILL.md", import.meta.url), "utf8")
const block = (info: string) => new RegExp(`\`\`\`markdown ${info}\\n([\\s\\S]*?)\\n\`\`\``).exec(SKILL)?.[1] ?? ""
const RULES = block("rules")
const INDEX = block("index")

const render = (markdown: string, dir: readonly string[]) => renderToStaticMarkup(React.createElement(Markdown, { markdown, dir }))

describe("the rules spec of a game, as a page of the docs", () => {
  it("is drawn: the title, a table for the components and one for the glossary, an anchor for each open point", () => {
    const html = render(RULES, ["games", "orchard-run"])
    expect(html).toContain('<h1 id="orchard-run-rules-spec"')
    expect(html.match(/<table/g)).toHaveLength(2)
    expect(html).toContain("Fruit card")
    expect(html).toContain('data-slot="table"')
    for (const id of ["the-draw-pile-is-empty", "a-crow-completes-two-sets", "open-points", "components"]) expect(html, id).toContain(`id="${id}"`)
    expect(html.match(/<h2[\s>]/g)).toHaveLength(11)
    expect(html).toMatch(/<strong[^>]*>Question\.<\/strong>/)
  })

  it("has a landing page that links to the spec: the menu of the folder lists it, and the link is the page's", () => {
    const files: DocFile[] = [
      { dir: ["games"], file: "index", markdown: "# Games" },
      { dir: ["games", "orchard-run"], file: "index", markdown: frontMatterOf(INDEX).markdown },
      { dir: ["games", "orchard-run"], file: "rules", markdown: RULES },
    ]
    const sections = buildSections(files)
    const games = sections.find((section) => section.slug === "games")
    expect(games?.pages.map((page) => [page.title, page.href, page.pages.map((child) => [child.title, child.href])])).toEqual([["Orchard Run", "/docs/games/orchard-run", [["Orchard Run: rules spec", "/docs/games/orchard-run/rules"]]]])
    expect(addressOf(files[2] as DocFile)).toEqual(["games", "orchard-run", "rules"])
    expect(render(INDEX, ["games", "orchard-run"])).toContain('href="/docs/games/orchard-run/rules"')
  })
})
