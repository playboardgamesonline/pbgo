import { readFileSync } from "node:fs"
import { PICTURE_NAMES } from "@pbgo/catalog/pictures"
import { describe, expect, it } from "vitest"
import { pictureSlots } from "./data/art.ts"

// The skill that places a game's pictures in its catalog entry (`.claude/skills/platform-assets`, PLT-99): what it shows and names must be what exists.
const REPO = new URL("../../", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, REPO), "utf8")

describe("the skill platform-assets", () => {
  const skill = read(".claude/skills/platform-assets/SKILL.md")

  it("is named after its folder and says which agent carries it out", () => {
    const front = /^---\nname: (.+)\ndescription: "(.+)"\n---\n/.exec(skill)
    expect(front?.[1]).toBe("platform-assets")
    expect(front?.[2]).toMatch(/^\[PLATFORM agent\] /)
  })

  it("names the five pictures of the catalog, the ones the Studio and the command have", () => {
    for (const name of PICTURE_NAMES) expect(skill, name).toContain(`\`${name}\``)
    expect(PICTURE_NAMES).toEqual(["cover", "logo", "icon", "background", "boxFront"])
  })

  it("names the files as the command reads them: game-<slug>-<picture>", () => {
    expect(skill).toContain("game-<slug>-<picture>")
    for (const slot of pictureSlots("flip-7", "Flip 7")) expect(slot.name).toMatch(/^game-flip-7-(cover|logo|icon|background|boxFront)$/)
  })

  it("names commands that exist", () => {
    const root = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    const platform = JSON.parse(read("platform/package.json")) as { scripts: Record<string, string> }
    expect(skill).toContain("pnpm catalog:pictures")
    expect(root.scripts).toHaveProperty("catalog:pictures")
    expect(skill).toContain("pnpm --filter @pbgo/platform content:attach-art")
    expect(platform.scripts).toHaveProperty("content:attach-art")
  })

  it("asks twice before anything leaves the machine and before anything is public, and downloads nothing without the owner", () => {
    expect(skill).toContain("## 6. Ask, then wait")
    expect(skill).toContain("## 8. Publish, only after a second yes")
    expect(skill).toContain("each approved by the owner")
    expect(skill).toContain("Never make a picture")
  })

  it("is in the list of the skills, and in the table of a game from A to Z as written", () => {
    const readme = read(".claude/skills/README.md")
    expect(readme).toContain("- `platform-assets` — ")
    expect(readme).toMatch(/\| `platform-assets` \(PLT-99\) \| [^|]+ \| written \|/)
  })

  it("has nothing in it that hides", () => {
    expect(skill.replace(/[\t\n]/g, " ")).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u)
  })
})
