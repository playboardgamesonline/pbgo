import type { PictureLinks } from "./notion/reader.ts"
import { describe, expect, it, vi } from "vitest"
import { artJobs, fetchArt, formatFetchReport, stemOf } from "./art-files.ts"
import type { Downloaded } from "./art-files.ts"
import { notionGame, publisherRow, source } from "./data/test-fixtures.ts"

const LINK = (name: string) => `https://files.example.com/${name}?X-Amz-Signature=secret`

const links = (): PictureLinks =>
  new Map([
    ["page-hanabi", { editedAt: "", links: { logo: LINK("hanabi-logo"), icon: null, background: LINK("hanabi-bg") } }],
    ["page-the-mind", { editedAt: "", links: { logo: LINK("mind-logo"), icon: LINK("mind-icon"), background: null } }],
  ])

describe("artJobs", () => {
  const { games, publishers } = source()

  it("names every picture the rows hold after the slot it fills, a game's from its page and a publisher's from its row", () => {
    const { jobs, problems } = artJobs(games, links(), publishers)
    expect(problems).toEqual([])
    expect(jobs).toEqual([
      { name: "game-hanabi-logo", link: LINK("hanabi-logo") },
      { name: "game-hanabi-background", link: LINK("hanabi-bg") },
      { name: "game-the-mind-logo", link: LINK("mind-logo") },
      { name: "game-the-mind-icon", link: LINK("mind-icon") },
      { name: "publisher-cocktail-games-logo", link: "https://files.example.com/cocktail.png" },
    ])
  })

  it("leaves a publisher no game lists, and one whose row has no logo", () => {
    const names = artJobs(games, links(), publishers).jobs.map((job) => job.name)
    expect(names.some((name) => name.includes("nobody") || name.includes("pandasaurus"))).toBe(false)
  })

  it("says so when a picture the first read flagged has no link in the second, and does not guess one", () => {
    const missing: PictureLinks = new Map([["page-hanabi", { editedAt: "", links: { logo: null, icon: null, background: LINK("hanabi-bg") } }]])
    const { jobs, problems } = artJobs([notionGame("hanabi", { name: "Hanabi", art: { logo: true, icon: false, background: true } })], missing, [])
    expect(jobs.map((job) => job.name)).toEqual(["game-hanabi-background"])
    expect(problems).toEqual(["Hanabi: its logo has no link any more (the row was edited while it was read)"])
  })

  it("has no job for a row that holds no picture, whatever the links say", () => {
    expect(artJobs([notionGame("bare")], links(), []).jobs).toEqual([])
  })

  it("takes the first of two Editors rows that have one name", () => {
    const rows = [publisherRow("Cocktail Games", { id: "one", logo: "https://files.example.com/one.png" }), publisherRow("Cocktail Games", { id: "two", logo: "https://files.example.com/two.png" })]
    const { jobs } = artJobs(source().games, links(), rows)
    expect(jobs.filter((job) => job.name.startsWith("publisher-"))).toEqual([{ name: "publisher-cocktail-games-logo", link: "https://files.example.com/one.png" }])
  })
})

describe("stemOf", () => {
  it("reads a file the way the art step does: case, spaces and underscores aside, without the extension", () => {
    expect(stemOf("Game_Hanabi Logo.PNG")).toBe("game-hanabi-logo")
    expect(stemOf("game-hanabi-logo.webp")).toBe("game-hanabi-logo")
  })
})

describe("fetchArt", () => {
  const jobs = [
    { name: "game-a-logo", link: LINK("a") },
    { name: "game-b-logo", link: LINK("b") },
    { name: "game-c-icon", link: LINK("c") },
  ]
  const png = (): Downloaded => ({ bytes: new Uint8Array([1, 2, 3]), type: "image/png" })

  it("downloads nothing and writes nothing without --apply, and says what would be", async () => {
    const download = vi.fn(async () => png())
    const write = vi.fn(async () => {})
    const report = await fetchArt({ jobs, existing: ["game-a-logo.png"], apply: false, download, write })
    expect(download).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(report).toMatchObject({ wanted: 3, present: ["game-a-logo"], pending: ["game-b-logo", "game-c-icon"], downloaded: [] })
  })

  it("downloads what is not in the folder and writes each picture under its slot's name with the extension of its own bytes", async () => {
    const types: Record<string, string> = { [LINK("b")]: "image/jpeg", [LINK("c")]: "image/avif" }
    const written: string[] = []
    const report = await fetchArt({
      jobs,
      existing: ["Game_A_Logo.PNG"],
      apply: true,
      download: async (link) => ({ bytes: new Uint8Array([1]), type: types[link] ?? "image/png" }),
      write: async (file) => {
        written.push(file)
      },
    })
    expect(written.sort()).toEqual(["game-b-logo.jpg", "game-c-icon.avif"])
    expect(report).toMatchObject({ present: ["game-a-logo"], downloaded: expect.arrayContaining(["game-b-logo", "game-c-icon"]), failed: [], unsupported: [] })
  })

  it("says which pictures are of a kind the art step does not read, and does not write them", async () => {
    const write = vi.fn(async () => {})
    const report = await fetchArt({ jobs: [jobs[0] ?? { name: "x", link: "" }], existing: [], apply: true, download: async () => ({ bytes: new Uint8Array([1]), type: "image/gif" }), write })
    expect(write).not.toHaveBeenCalled()
    expect(report.unsupported).toEqual([{ name: "game-a-logo", type: "image/gif" }])
  })

  it("goes on when one picture fails, names it, and never repeats a link or what an error says", async () => {
    class PictureError extends Error {
      constructor(message: string) {
        super(message)
        this.name = "PictureError"
      }
    }
    const download = async (link: string): Promise<Downloaded> => {
      if (link === LINK("a")) throw new PictureError("files.example.com answered 403")
      if (link === LINK("b")) throw new Error(`boom ${link}`)
      return png()
    }
    const written: string[] = []
    const report = await fetchArt({ jobs, existing: [], apply: true, download, write: async (file) => void written.push(file) })
    expect(written).toEqual(["game-c-icon.png"])
    expect(report.failed).toEqual([
      { name: "game-a-logo", reason: "files.example.com answered 403" },
      { name: "game-b-logo", reason: "the download failed" },
    ])
    expect(JSON.stringify(report)).not.toContain("X-Amz-Signature")
  })

  it("downloads a few at a time, never more than it was told", async () => {
    let running = 0
    let peak = 0
    const many = Array.from({ length: 9 }, (_, index) => ({ name: `game-${index}-logo`, link: LINK(String(index)) }))
    await fetchArt({
      jobs: many,
      existing: [],
      apply: true,
      concurrency: 3,
      download: async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 5))
        running -= 1
        return png()
      },
      write: async () => {},
    })
    expect(peak).toBe(3)
  })

  it("has nothing to do for no job", async () => {
    const report = await fetchArt({ jobs: [], existing: [], apply: true, download: async () => png(), write: async () => {} })
    expect(report).toEqual({ wanted: 0, present: [], pending: [], downloaded: [], unsupported: [], failed: [] })
  })
})

describe("formatFetchReport", () => {
  const base = { wanted: 3, present: ["game-a-logo"], pending: ["game-b-logo", "game-c-icon"], downloaded: [], unsupported: [], failed: [] }

  it("tells a dry run from a download, and says how to go on", () => {
    expect(formatFetchReport(base, { apply: false, folder: "/art", problems: [] })).toContain("DRY RUN: nothing was downloaded. 2 to download, 1 already there, of 3 in Notion.")
    expect(formatFetchReport(base, { apply: false, folder: "/art", problems: [] })).toContain("Run again with --apply")
    expect(formatFetchReport({ ...base, downloaded: ["game-b-logo", "game-c-icon"], pending: [] }, { apply: true, folder: "/art", problems: [] })).toContain("2 downloaded, 1 already there, of 3 in Notion.")
  })

  it("lists what failed, what is not read, and the warnings, and never a link", () => {
    const text = formatFetchReport(
      { ...base, pending: [], failed: [{ name: "game-b-logo", reason: "files.example.com answered 403" }], unsupported: [{ name: "game-c-icon", type: "image/gif" }] },
      { apply: true, folder: "/art", problems: ["Hanabi: its logo has no link any more"] },
    )
    expect(text).toContain("failed: game-b-logo: files.example.com answered 403")
    expect(text).toContain("not read by the art step (image/gif): game-c-icon")
    expect(text).toContain("warning: Hanabi: its logo has no link any more")
    expect(text).toContain("Run it again")
    expect(text).not.toContain("https://")
  })
})
