import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { PLAY_PARTS } from "../defaults"
import { type DocLink, docHref, filterParts, GROUPS, matches, PARTS, TUNING_DOCS } from "./catalog"
import { PRESETS } from "./presets"

const COMPONENTS = join(__dirname, "../../../../../../../../../docs/engine/02-components")
const slug = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().replace(/ /g, "-")

/** The anchors of a page: the slug of each of its headings, as the docs make them */
function anchorsOf(page: string): Set<string> | null {
  const file = readdirSync(COMPONENTS).find((name) => name.replace(/^\d+-/, "") === `${page}.md`)
  if (!file) return null
  return new Set(
    readFileSync(join(COMPONENTS, file), "utf8")
      .split("\n")
      .filter((line) => /^#{1,6} /.test(line))
      .map((line) => slug(line.replace(/^#+ /, ""))),
  )
}

describe("the parts", () => {
  it("name every part of the table once, in a group that exists", () => {
    expect(Object.keys(PARTS).sort()).toEqual([...PLAY_PARTS].sort())
    for (const part of PLAY_PARTS) expect(GROUPS, part).toContain(PARTS[part].group)
  })

  it("link to pages and anchors of the docs that exist", () => {
    const links: DocLink[] = [...Object.values(PARTS).map((part) => part.doc), ...Object.values(TUNING_DOCS)]
    for (const link of links) {
      const anchors = anchorsOf(link.page)
      expect(anchors, link.page).not.toBeNull()
      if (link.anchor) expect(anchors?.has(link.anchor), `${link.page}#${link.anchor}`).toBe(true)
    }
    expect(docHref({ page: "cards", anchor: "glows" })).toBe("/docs/engine/components/cards#glows")
  })

  it("are all switched on by a scene or reachable from the Parts tab", () => {
    for (const preset of Object.values(PRESETS)) for (const part of preset.parts) expect(PLAY_PARTS).toContain(part)
  })
})

describe("matches and filterParts", () => {
  it("need every word of the query, in any order and any case", () => {
    expect(matches("Hand FAN", "the hand as a fan")).toBe(true)
    expect(matches("hand pile", "the hand as a fan")).toBe(false)
    expect(matches("   ", "anything")).toBe(true)
  })

  it("find a part by its name, its words or its group", () => {
    expect(filterParts("hex")).toEqual(["board"])
    expect(filterParts("bottom left")).toEqual(["hand"])
    expect(filterParts("flip 7")).toEqual(["floor", "seats"])
    expect(filterParts("dice")).toContain("dice")
    expect(filterParts("nothing like this")).toEqual([])
    expect(filterParts("")).toHaveLength(PLAY_PARTS.length)
  })
})
