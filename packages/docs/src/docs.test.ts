import { describe, expect, it } from "vitest"
import { LANDING, addressOf, buildSections, filterPages, findPage, flatten, frontMatterOf, hrefOf, isDocName, matchesQuery, neighboursOf, pageNameOf, parseName, resolveLink, specimensOf, splitSpecimen, titleOf, type DocFile, type DocPage } from "./docs"

describe("isDocName and pageNameOf", () => {
  it("accept words of lowercase letters and digits joined by dashes", () => {
    for (const name of ["design", "game-ui", "plan-9", "a", "03-components"]) expect(isDocName(name), name).toBe(true)
  })

  it("refuse anything that could be a path, a hidden file or a different spelling", () => {
    for (const name of ["", "Design", "game_ui", "-a", "a-", "a--b", "../x", "a/b", ".hidden", "a b", "é"]) expect(isDocName(name), JSON.stringify(name)).toBe(false)
  })

  it("read the name of a markdown file and nothing else", () => {
    expect(pageNameOf("game-ui.md")).toBe("game-ui")
    for (const file of ["README.MD", "notes.txt", "Game.md", ".md", "a.md.bak", "a b.md", "index"]) expect(pageNameOf(file), file).toBeNull()
  })
})

describe("parseName", () => {
  it("takes the number in front of a name off its address and keeps it as its place", () => {
    expect(parseName("03-components")).toEqual({ order: 3, slug: "components" })
    expect(parseName("01-controls")).toEqual({ order: 1, slug: "controls" })
    expect(parseName("10-in-game")).toEqual({ order: 10, slug: "in-game" })
  })

  it("leaves a name that has no number as it is, and a number that is part of a word", () => {
    expect(parseName("controls")).toEqual({ order: null, slug: "controls" })
    expect(parseName("2d-board")).toEqual({ order: null, slug: "2d-board" })
    expect(parseName("12")).toEqual({ order: null, slug: "12" })
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

describe("frontMatterOf", () => {
  it("takes the block at the top off the text and reads its keys", () => {
    const text = '---\nicon: paint-board\ndescription: "How a screen is built: colour, type."\n---\n\n# Design\n\nText.'
    expect(frontMatterOf(text)).toEqual({ meta: { icon: "paint-board", description: "How a screen is built: colour, type." }, markdown: "# Design\n\nText." })
  })

  it("reads a value in plain words or between either quotes, and Windows line ends", () => {
    expect(frontMatterOf("---\r\ndescription: Plain words.\r\n---\r\n# T").meta).toEqual({ description: "Plain words." })
    expect(frontMatterOf("---\ndescription: 'Single.'\nicon: \"double\"\n---\n# T").meta).toEqual({ description: "Single.", icon: "double" })
  })

  it("is no front matter for a text that has no block at its very top", () => {
    for (const text of ["# Title\n\n---\nicon: x\n---\n", "\n---\nicon: x\n---\n# T", "---\nicon: x\nnever closed", "just text"]) expect(frontMatterOf(text), text).toEqual({ meta: {}, markdown: text })
  })

  it("stops on a key it does not know, on a line that is not a pair and on a value that says nothing, naming the file", () => {
    expect(() => frontMatterOf("---\ncolor: red\n---\n# T", "docs/a/index.md")).toThrow('docs/a/index.md: "color: red" is not a line of the front matter')
    expect(() => frontMatterOf("---\nnot a pair\n---\n# T", "f.md")).toThrow("f.md: ")
    expect(() => frontMatterOf("---\ndescription:\n---\n# T", "f.md")).toThrow("f.md: the front matter says nothing for description")
  })
})

describe("matchesQuery and filterPages", () => {
  const page = (title: string, pages: DocPage[] = []): DocPage => ({ segments: [title.toLowerCase()], title, href: `/docs/${title.toLowerCase()}`, pages })
  const tree = [page("Guidelines"), page("Components", [page("Controls"), page("Overlays"), page("Social")]), page("In-game UI")]
  const titles = (pages: readonly DocPage[]): string[] => pages.map((entry) => (entry.pages.length > 0 ? `${entry.title} > ${titles(entry.pages).join(", ")}` : entry.title))

  it("read a text without its case and its accents, every word of the search having to be in it", () => {
    expect(matchesQuery("Écran de Contrôle", "ecran controle")).toBe(true)
    expect(matchesQuery("Guidelines", "GUIDE")).toBe(true)
    expect(matchesQuery("Guidelines", "guide rules")).toBe(false)
    expect(matchesQuery("anything", "   ")).toBe(true)
  })

  it("keep the whole menu for a search with no word", () => {
    expect(titles(filterPages(tree, "  "))).toEqual(titles(tree))
  })

  it("keep a page whose title matches, and a group with the pages of it that match", () => {
    expect(titles(filterPages(tree, "over"))).toEqual(["Components > Overlays"])
    expect(titles(filterPages(tree, "in-game"))).toEqual(["In-game UI"])
  })

  it("keep a group whose own title matches with all of its pages", () => {
    expect(titles(filterPages(tree, "component"))).toEqual(["Components > Controls, Overlays, Social"])
  })

  it("keep nothing when nothing matches", () => {
    expect(filterPages(tree, "zebra")).toEqual([])
  })
})

describe("splitSpecimen", () => {
  it("takes the first line as the name and the lines after it as what the specimen is given", () => {
    expect(splitSpecimen("token-table\n--a | b | c\n--d | e | f\n")).toEqual({ name: "token-table", body: "--a | b | c\n--d | e | f" })
    expect(splitSpecimen("  glass-lab  \n")).toEqual({ name: "glass-lab", body: "" })
  })
})

describe("specimensOf", () => {
  it("lists the names of the specimen blocks in order, and a name used twice twice", () => {
    const text = "# T\n\n```specimen\nbutton-variants\n```\n\ntext\n\n```specimen\n  glass-lab  \n```\n\n```specimen\nbutton-variants\n```"
    expect(specimensOf(text)).toEqual(["button-variants", "glass-lab", "button-variants"])
  })

  it("lists the name of a specimen that is given lines, and not the lines", () => {
    expect(specimensOf("```specimen\ntoken-table\n--a | b | c\n```")).toEqual(["token-table"])
  })

  it("is not fooled by another language, by a specimen inside a longer fence, or by a block that is not closed", () => {
    expect(specimensOf("```ts\nbutton\n```")).toEqual([])
    expect(specimensOf("````md\n```specimen\nnested\n```\n````")).toEqual([])
    expect(specimensOf("~~~specimen\ntilde\n~~~")).toEqual(["tilde"])
    expect(specimensOf("```specimen\nnever closed")).toEqual([])
  })

  it("is empty for a text with no block", () => {
    expect(specimensOf("just text")).toEqual([])
  })
})

describe("addressOf and hrefOf", () => {
  it("make the landing page of a folder the address of the folder, and a page the folder's and its own word", () => {
    expect(addressOf({ dir: ["design"], file: LANDING })).toEqual(["design"])
    expect(addressOf({ dir: ["design"], file: "tokens" })).toEqual(["design", "tokens"])
    expect(addressOf({ dir: ["design", "03-components"], file: "01-controls" })).toEqual(["design", "components", "controls"])
    expect(addressOf({ dir: ["design", "03-components"], file: LANDING })).toEqual(["design", "components"])
  })

  it("write the address on the site", () => {
    expect(hrefOf(["design"])).toBe("/docs/design")
    expect(hrefOf(["design", "components", "controls"])).toBe("/docs/design/components/controls")
  })
})

describe("buildSections", () => {
  const file = (path: string, markdown: string): DocFile => {
    const parts = path.split("/")
    return { dir: parts.slice(0, -1), file: parts.at(-1) ?? "", markdown }
  }

  it("makes a section of each folder, by name, with the landing page as the section and the other pages by name", () => {
    const sections = buildSections([
      file("engine/rules", "# Rules"),
      file("engine/index", "# Engine\n\nThe guides."),
      file("design/index", "# Design system\n\nThe tokens."),
      file("engine/boards", "# Boards"),
      file("design/page-10", "# Ten"),
      file("design/page-2", "# Two"),
    ])
    expect(sections.map((section) => section.slug)).toEqual(["design", "engine"])
    expect(sections[1]?.pages.map((page) => page.title)).toEqual(["Boards", "Rules"])
    expect(sections[0]?.pages.map((page) => page.href)).toEqual(["/docs/design/page-2", "/docs/design/page-10"])
  })

  it("takes the title, the description, the icon and the address of a section from its landing page", () => {
    const landing: DocFile = { ...file("design/index", "# Design system\n\nThe tokens."), meta: { icon: "paint-board", description: "The tokens and the rules." } }
    const [section] = buildSections([landing])
    expect(section).toMatchObject({ slug: "design", title: "Design system", description: "The tokens and the rules.", icon: "paint-board", href: "/docs/design", segments: ["design"], pages: [] })
  })

  it("leaves the description empty and the icon null when the landing page says none", () => {
    const [section] = buildSections([file("design/index", "# Design system\n\nThe tokens.")])
    expect(section).toMatchObject({ description: "", icon: null })
  })

  it("names a page after its file when it has no heading", () => {
    const [section] = buildSections([file("engine/index", "# Engine"), file("engine/game-ui", "text only")])
    expect(section?.pages[0]).toMatchObject({ title: "Game ui", href: "/docs/engine/game-ui" })
  })

  it("puts the numbered entries first in their order, a folder among them, and takes the numbers off the addresses", () => {
    const [section] = buildSections([
      file("design/index", "# Design"),
      file("design/04-in-game", "# In-game"),
      file("design/zebra", "# Zebra"),
      file("design/01-guidelines", "# Guidelines"),
      file("design/03-components/index", "# Components"),
      file("design/03-components/02-navigation", "# Navigation"),
      file("design/03-components/01-controls", "# Controls"),
      file("design/02-foundations", "# Foundations"),
      file("design/apple", "# Apple"),
    ])
    expect(section?.pages.map((page) => page.href)).toEqual([
      "/docs/design/guidelines",
      "/docs/design/foundations",
      "/docs/design/components",
      "/docs/design/in-game",
      "/docs/design/apple",
      "/docs/design/zebra",
    ])
    const components = section?.pages.find((page) => page.title === "Components")
    expect(components?.segments).toEqual(["design", "components"])
    expect(components?.pages.map((page) => page.href)).toEqual(["/docs/design/components/controls", "/docs/design/components/navigation"])
  })

  it("orders the sections by their numbers too", () => {
    expect(buildSections([file("b/index", "# B"), file("02-a/index", "# A"), file("01-c/index", "# C")]).map((section) => section.slug)).toEqual(["c", "a", "b"])
  })

  it("stops on a folder with no landing page, in a section or in a group", () => {
    expect(() => buildSections([file("lonely/notes", "# Notes")])).toThrow("docs/lonely/ has no index.md")
    expect(() => buildSections([file("design/index", "# Design"), file("design/group/page", "# Page")])).toThrow("docs/design/group/ has no index.md")
  })

  it("stops on two entries that have the same address, and on a page that is called index", () => {
    expect(() => buildSections([file("design/index", "# D"), file("design/01-a", "# A"), file("design/a", "# A")])).toThrow("two entries that are called a")
    expect(() => buildSections([file("design/index", "# D"), file("design/a/index", "# A"), file("design/01-a", "# A")])).toThrow("two entries that are called a")
    expect(() => buildSections([file("design/index", "# D"), file("design/01-index", "# I")])).toThrow("landing page, not of a page")
  })

  it("has no section for no file, and leaves out a file that is not in a folder", () => {
    expect(buildSections([])).toEqual([])
    expect(buildSections([{ dir: [], file: "loose", markdown: "# Loose" }])).toEqual([])
  })
})

describe("flatten and findPage", () => {
  const sections = buildSections([
    { dir: ["design"], file: "index", markdown: "# Design" },
    { dir: ["design", "components"], file: "index", markdown: "# Components" },
    { dir: ["design", "components"], file: "controls", markdown: "# Controls" },
    { dir: ["engine"], file: "index", markdown: "# Engine" },
  ])

  it("lists every page, each one before its own pages", () => {
    expect(flatten(sections).map((page) => page.href)).toEqual(["/docs/design", "/docs/design/components", "/docs/design/components/controls", "/docs/engine"])
  })

  it("finds a page by its address, and nothing else", () => {
    expect(findPage(sections, ["design", "components", "controls"])?.title).toBe("Controls")
    expect(findPage(sections, ["design"])?.title).toBe("Design")
    for (const address of [[], ["design", "controls"], ["design", "components", "controls", "x"], ["nope"], ["design", "index"]]) expect(findPage(sections, address), address.join("/")).toBeNull()
  })

  it("reads a section page by page: the neighbours of a page are the ones before and after it in the order of the menu, inside its section", () => {
    const [design] = sections
    if (!design) throw new Error("no section")
    const titles = (segments: string[]) => {
      const { previous, next } = neighboursOf(design, segments)
      return [previous?.title ?? null, next?.title ?? null]
    }
    expect(titles(["design"])).toEqual([null, "Components"])
    expect(titles(["design", "components"])).toEqual(["Design", "Controls"])
    expect(titles(["design", "components", "controls"])).toEqual(["Components", null])
    expect(titles(["engine"])).toEqual([null, null])
    expect(titles(["design", "nope"])).toEqual([null, null])
  })
})

describe("resolveLink", () => {
  const from = { dir: ["design"] }

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

  it("reads the names the way the disk has them and gives the address of the page", () => {
    expect(resolveLink("02-foundations.md#radius", from)).toEqual({ kind: "page", href: "/docs/design/foundations#radius" })
    expect(resolveLink("03-components/index.md", from)).toEqual({ kind: "page", href: "/docs/design/components" })
    const group = { dir: ["design", "03-components"] }
    expect(resolveLink("01-controls.md#button", group)).toEqual({ kind: "page", href: "/docs/design/components/controls#button" })
    expect(resolveLink("../02-foundations.md", group)).toEqual({ kind: "page", href: "/docs/design/foundations" })
    expect(resolveLink("../index.md", group)).toEqual({ kind: "page", href: "/docs/design" })
    expect(resolveLink("index.md", group)).toEqual({ kind: "page", href: "/docs/design/components" })
  })

  it("leads a full address under /docs, such as the playground's, to that address", () => {
    expect(resolveLink("/docs/playground", from)).toEqual({ kind: "route", href: "/docs/playground" })
    expect(resolveLink("/docs", from)).toEqual({ kind: "route", href: "/docs" })
    expect(resolveLink("/docs/engine/components#a", from)).toEqual({ kind: "route", href: "/docs/engine/components#a" })
  })

  it("does not take any other address of the site for a route", () => {
    for (const href of ["/gamemaster", "/docs/../gamemaster", "/docs/a b", "/docsx", "/docs/Play"]) expect(resolveLink(href, from).kind, href).not.toBe("route")
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
