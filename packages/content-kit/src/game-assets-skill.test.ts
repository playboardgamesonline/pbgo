import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { HELP } from "./cli.ts"

// The skill that brings a game's art into its own Sanity project (`.claude/skills/game-assets`, GAM-34): what it shows and names must be what exists. The seed is this package's.
const REPO = new URL("../../../", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, REPO), "utf8")

describe("the skill game-assets", () => {
  const skill = read(".claude/skills/game-assets/SKILL.md")

  it("is named after its folder and says which agent carries it out", () => {
    const front = /^---\nname: (.+)\ndescription: "(.+)"\n---\n/.exec(skill)
    expect(front?.[1]).toBe("game-assets")
    expect(front?.[2]).toMatch(/^\[GAME agent\] /)
  })

  it("uses the flags of the seed, which the seed says it has", () => {
    for (const flag of ["--dry-run", "--apply", "--art-dir", "--overwrite", "--only"]) {
      expect(skill, flag).toContain(flag)
      expect(HELP, flag).toContain(flag)
    }
  })

  it("names commands that exist: the gate of the game, and the seed that a game has as `content:seed`", () => {
    const root = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    expect(skill).toContain("pnpm check:game")
    expect(root.scripts).toHaveProperty("check:game")
    expect(skill).toContain("pnpm -C games/<slug> content:seed")
    for (const game of ["hanabi", "flip-7", "skyjo", "exploding-kittens"]) expect((JSON.parse(read(`games/${game}/package.json`)) as { scripts: Record<string, string> }).scripts).toHaveProperty("content:seed")
  })

  it("keeps to the layout of the art folder in `docs/content-pipeline.md`: outside the repo, top level only, named after the slot, never touched by the seed", () => {
    const doc = read("docs/content-pipeline.md")
    expect(doc).toContain("Put the images in one folder outside the repo")
    expect(doc).toContain("Only the top level is read")
    expect(skill).toContain("~/Companies/PBGO/assets/<slug>")
    expect(skill).toContain("top level")
    expect(skill).toContain("named after its slot")
  })

  it("asks before anything is uploaded, makes no picture and touches no original of the owner's", () => {
    expect(skill).toContain("## 6. Ask, then wait")
    expect(skill).toContain("never make a picture")
    expect(skill).toContain("Never move, rename, edit or delete one of the owner's originals")
    expect(skill).toContain("No `--overwrite` without `--only` and the owner's yes")
  })

  it("is in the list of the skills, and in the table of a game from A to Z as written", () => {
    const readme = read(".claude/skills/README.md")
    expect(readme).toContain("- `game-assets` — ")
    expect(readme).toMatch(/\| `game-assets` \(GAM-34\) \| [^|]+ \| written \|/)
  })

  it("has nothing in it that hides", () => {
    expect(skill.replace(/[\t\n]/g, " ")).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u)
  })
})
