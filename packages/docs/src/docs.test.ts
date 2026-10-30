import { describe, expect, it } from "vitest"
import { LANDING, buildSections, hrefOf, isDocName, pageNameOf, resolveLink, summaryOf, titleOf, type DocFile } from "./docs"

describe("isDocName and pageNameOf", () => {
  it("accept words of lowercase letters and digits joined by dashes", () => {
    for (const name of ["design", "game-ui", "plan-9", "a"]) expect(isDocName(name), name).toBe(true)
  })

  it("refuse anything that could be a path, a hidden file or a different spelling", () => {
    for (const name of ["", "Design", "game_ui", "-a", "a-", "a--b", "../x", "a/b", ".hidden", "a b", "é"]) expect(isDocName(name), JSON.stringify(name)).toBe(false)
  })

  it("read the name of a markdown file and nothing else", () => {
    expect(pageNameOf("game-ui.md")).toBe("game-ui")
    for (const file of ["README.MD", "notes.txt", "Game.md", ".md", "a.md.bak", "a b.md", "index"]) expect(pageNameOf(file), file).toBeNull()
  })
})

describe("titleOf", () => {
  it("is the first level one heading, in plain words", () => {
    expect(titleOf("intro\n\n# Design system\n\n# Another", "x")).toBe("Design system")
    expect(titleOf("# `@pbgo/ui` and **tokens** [docs](https://x.test)", "x")).toBe("@pbgo/ui and tokens docs")
  })

  it("ignores a heading in a fenced block, and the other levels", () => {
    expect(titleOf("```md\n# Not this\n```\n\n## Nor this\n\n# This one", "x")).toBe("This one")
  })

  it("is the fallback when there is no heading", () => {
    expect(titleOf("just text\n## Level two", "Fallback")).toBe("Fallback")
  })
})

describe("summaryOf", () => {
  it("is the first paragraph, in plain words, after the title", () => {
    const text = "# Title\n\nThe `first` paragraph,\nover two lines.\n\nThe second."
    expect(summaryOf(text)).toBe("The first paragraph, over two lines.")
  })

  it("skips a heading, a list, a table, a quote and a fenced block", () => {
    const text = "# Title\n## Sub\n- item\n| a | b |\n> quote\n\n```\ncode\n```\n\nThe paragraph."
    expect(summaryOf(text)).toBe("The paragraph.")
  })

  it("is cut at a word", () => {
    const text = `# T\n\n${"word ".repeat(100)}`
    const summary = summaryOf(text, 50)
    expect(summary.length).toBeLessThanOrEqual(51)
    expect(summary.endsWith("…")).toBe(true)
    expect(summary).not.toMatch(/wor…$/)
  })

  it("is empty when there is no paragraph", () => {
    expect(summaryOf("# Only a title")).toBe("")
  })
})

describe("hrefOf", () => {
  it("makes the landing page the address of the section", () => {
    expect(hrefOf("design", LANDING)).toBe("/docs/design")
    expect(hrefOf("design", "tokens")).toBe("/docs/design/tokens")
  })
})

describe("buildSections", () => {
  const file = (section: string, name: string, markdown: string): DocFile => ({ section, file: name, markdown })

  it("makes a section of each folder, by name, with the landing page first and the others by name", () => {
    const sections = buildSections([
      file("engine", "rules", "# Rules"),
      file("engine", "index", "# Engine\n\nThe guides."),
      file("design", "index", "# Design system\n\nThe tokens."),
      file("engine", "boards", "# Boards"),
      file("design", "page-10", "# Ten"),
      file("design", "page-2", "# Two"),
    ])
    expect(sections.map((section) => section.slug)).toEqual(["design", "engine"])
    expect(sections[1]?.pages.map((page) => page.file)).toEqual(["index", "boards", "rules"])
    expect(sections[0]?.pages.map((page) => page.file)).toEqual(["index", "page-2", "page-10"])
  })

  it("takes the title, the summary and the address of a section from its landing page", () => {
    const [section] = buildSections([file("design", "index", "# Design system\n\nThe tokens and the rules.")])
    expect(section).toMatchObject({ slug: "design", title: "Design system", summary: "The tokens and the rules.", href: "/docs/design" })
    expect(section?.pages).toEqual([{ file: "index", title: "Design system", href: "/docs/design" }])
  })

  it("names a page after its file when it has no heading", () => {
    const [section] = buildSections([file("engine", "index", "# Engine"), file("engine", "game-ui", "text only")])
    expect(section?.pages[1]).toMatchObject({ title: "Game ui", href: "/docs/engine/game-ui" })
  })

  it("stops on a folder with no landing page", () => {
    expect(() => buildSections([file("lonely", "notes", "# Notes")])).toThrow("docs/lonely/ has no index.md")
  })

  it("has no section for no file", () => {
    expect(buildSections([])).toEqual([])
  })
})

describe("resolveLink", () => {
  const from = { section: "design" }

  it("keeps an anchor and an external link as they are", () => {
    expect(resolveLink("#tokens", from)).toEqual({ kind: "anchor", href: "#tokens" })
    expect(resolveLink("https://example.com/a?b=1", from)).toEqual({ kind: "external", href: "https://example.com/a?b=1" })
    expect(resolveLink("mailto:hey@example.com", from)).toEqual({ kind: "external", href: "mailto:hey@example.com" })
  })

  it("leads a relative link to a page of the docs to that page, with its anchor", () => {
    expect(resolveLink("./tokens.md", from)).toEqual({ kind: "page", href: "/docs/design/tokens" })
    expect(resolveLink("tokens.md#colors", from)).toEqual({ kind: "page", href: "/docs/design/tokens#colors" })
    expect(resolveLink("../engine/index.md", from)).toEqual({ kind: "page", href: "/docs/engine" })
    expect(resolveLink("../engine/rules.md#a", from)).toEqual({ kind: "page", href: "/docs/engine/rules#a" })
  })

  it("shows a file of the repo that has no page as a name", () => {
    expect(resolveLink("../../packages/ui/README.md", from)).toEqual({ kind: "file", path: "../../packages/ui/README.md" })
    expect(resolveLink("../catalog.md", from)).toEqual({ kind: "file", path: "../catalog.md" })
    expect(resolveLink("diagram.png", from)).toEqual({ kind: "file", path: "diagram.png" })
  })

  it("refuses what is empty or could run something", () => {
    for (const href of [undefined, "", "javascript:alert(1)", "data:text/html,x", "//evil.example/x", "vbscript:x"]) expect(resolveLink(href, from), String(href)).toEqual({ kind: "none" })
  })

  it("does not climb out of docs/", () => {
    expect(resolveLink("../../../etc/passwd.md", from)).toEqual({ kind: "file", path: "../../../etc/passwd.md" })
  })
})
