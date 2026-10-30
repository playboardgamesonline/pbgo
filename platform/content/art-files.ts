import { ART_SLOTS } from "@pbgo/catalog"
import type { NotionGame } from "@pbgo/catalog"
import type { PictureLinks, PublisherRow } from "@pbgo/catalog/notion"
import { slotName } from "./data/art.ts"
import { gameId, publisherId } from "./data/ids.ts"
import { publishers } from "./data/taxonomy.ts"

// The step before the seed's art step: the pictures of the Notion rows, downloaded into a folder under the names of the slots they fill.
// What to download and how a download is told apart are here, the command (`fetch-art.ts`) only wires them to Notion and to the disk.

/** One picture to bring: the name of the slot it fills, and the link that Notion gave for it a moment ago (good for about an hour: never kept, never printed). */
export type ArtJob = { name: string; link: string }

/**
 * The pictures the rows hold now. A game's come from the links read with its page (`links`, by the id of its Notion page), a
 * publisher's from its Editors row, and only for the publishers the games list, which are the ones the seed brings. A picture the
 * first read flagged and the second finds no link for is a problem to say, not to guess at: the row was edited between the two reads.
 */
export function artJobs(games: readonly NotionGame[], links: PictureLinks, rows: readonly PublisherRow[]): { jobs: ArtJob[]; problems: string[] } {
  const jobs: ArtJob[] = []
  const problems: string[] = []
  for (const game of games) {
    for (const picture of ART_SLOTS) {
      if (!game.art[picture]) continue
      const link = links.get(game.notionPageId)?.links[picture]
      if (link) jobs.push({ name: slotName(gameId(game.slug), picture), link })
      else problems.push(`${game.name}: its ${picture} has no link any more (the row was edited while it was read)`)
    }
  }
  const seeded = publishers(games)
  const named = new Set<string>()
  for (const row of rows) {
    const id = publisherId(row.name)
    if (!row.logo || !seeded.has(id) || named.has(id)) continue
    named.add(id)
    jobs.push({ name: slotName(id, "logo"), link: row.logo })
  }
  return { jobs, problems }
}

/** The extension a picture's own bytes call for: only what the seed's art step reads. */
const EXTENSIONS: Readonly<Record<string, string>> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg" }

export type Downloaded = { bytes: Uint8Array; type: string }

export type FetchReport = {
  /** The pictures the rows hold. */
  wanted: number
  /** Already in the folder: left as they are. */
  present: string[]
  /** What a dry run would download. */
  pending: string[]
  downloaded: string[]
  /** A picture of a kind the art step does not read (a GIF, an AVIF, an icon file): convert it and put it in the folder by hand. */
  unsupported: { name: string; type: string }[]
  failed: { name: string; reason: string }[]
}

/** The stem a file is known by in the art folder: the art step reads `Game_Logo.PNG` and `game-logo.png` as one name. */
export const stemOf = (file: string): string => file.replace(/\.[^.]+$/, "").toLowerCase().replace(/[\s_]+/g, "-")

/**
 * Downloads what is not in the folder yet, a few at a time, and writes each picture under its slot's name. Without `apply` nothing is
 * downloaded or written (a dry run says what would be). A picture that fails is reported and the others go on: the next run takes up
 * what is missing. `existing` is what the folder already holds (file names).
 */
export async function fetchArt({
  jobs,
  existing,
  apply,
  download,
  write,
  concurrency = 4,
}: {
  jobs: readonly ArtJob[]
  existing: Iterable<string>
  apply: boolean
  download: (link: string) => Promise<Downloaded>
  write: (file: string, bytes: Uint8Array) => Promise<void>
  concurrency?: number
}): Promise<FetchReport> {
  const stems = new Set([...existing].map(stemOf))
  const todo = jobs.filter((job) => !stems.has(job.name))
  const report: FetchReport = {
    wanted: jobs.length,
    present: jobs.filter((job) => stems.has(job.name)).map((job) => job.name),
    pending: apply ? [] : todo.map((job) => job.name),
    downloaded: [],
    unsupported: [],
    failed: [],
  }
  if (!apply) return report

  let next = 0
  const worker = async () => {
    for (let job = todo[next++]; job; job = todo[next++]) {
      try {
        const picture = await download(job.link)
        const extension = EXTENSIONS[picture.type]
        if (!extension) {
          report.unsupported.push({ name: job.name, type: picture.type })
          continue
        }
        await write(`${job.name}${extension}`, picture.bytes)
        report.downloaded.push(job.name)
      } catch (error) {
        // `PictureError` names the host and never the link, which carries a signature: only its message is kept, and nothing of any other error
        report.failed.push({ name: job.name, reason: error instanceof Error && error.name === "PictureError" ? error.message : "the download failed" })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker))
  return report
}

/** The summary printed after a run. It holds names of slots and counts, never a link. */
export function formatFetchReport(report: FetchReport, { apply, folder, problems }: { apply: boolean; folder: string; problems: readonly string[] }): string {
  const lines = [`Pictures of the Notion rows → ${folder}`, ""]
  lines.push(apply ? `${report.downloaded.length} downloaded, ${report.present.length} already there, of ${report.wanted} in Notion.` : `DRY RUN: nothing was downloaded. ${report.pending.length} to download, ${report.present.length} already there, of ${report.wanted} in Notion.`)
  if (!apply && report.pending.length > 0) lines.push("Run again with --apply to download them.")
  for (const { name, type } of report.unsupported) lines.push(`  not read by the art step (${type}): ${name}: convert it to PNG and put it in the folder under that name`)
  for (const { name, reason } of report.failed) lines.push(`  failed: ${name}: ${reason}`)
  for (const problem of problems) lines.push(`  warning: ${problem}`)
  if (report.failed.length > 0) lines.push("Run it again: what is in the folder is left as it is, and what failed is tried again.")
  return lines.join("\n")
}
