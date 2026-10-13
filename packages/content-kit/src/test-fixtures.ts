import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import type { ImageValue, SeedDoc } from "./types.ts"

export type Size = { width: number; height: number }

/** A seed document, read loosely by the tests (`doc.cardBack`, `doc.sections[0].title`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = SeedDoc & Record<string, any>

/** A plain-colour image. Two colours give two different files, so two different content hashes. */
export async function imageOf(color: string, size: Size = { width: 40, height: 56 }, format: "png" | "jpeg" | "webp" = "png"): Promise<Buffer> {
  const image = sharp({ create: { width: size.width, height: size.height, channels: 3, background: color } })
  if (format === "jpeg") return image.jpeg().toBuffer()
  if (format === "webp") return image.webp().toBuffer()
  return image.png().toBuffer()
}

/** The image value the uploader places in a document, for an asset that does not exist. */
export const imageValue = (name: string): ImageValue => ({ _type: "image", asset: { _type: "reference", _ref: `image-${name}-40x56-webp` } })

/** Every image value found in a value, with the path where it sits (`$.entries[3].glyph`). */
export function imagesOf(value: unknown, path = "$"): { path: string; image: ImageValue }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => imagesOf(item, `${path}[${index}]`))
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._type === "image" || "asset" in record) return [{ path, image: record as ImageValue }]
    return Object.entries(record).flatMap(([key, child]) => imagesOf(child, `${path}.${key}`))
  }
  return []
}

/** Temporary folders for the tests that need real files on disk, all removed by `cleanUp()` (call it from `afterEach`). */
export class TempFolders {
  private folders: string[] = []

  async create(files: Record<string, Buffer | string> = {}): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "content-kit-"))
    this.folders.push(dir)
    for (const [name, data] of Object.entries(files)) await writeFile(join(dir, name), data)
    return dir
  }

  async cleanUp(): Promise<void> {
    await Promise.all(this.folders.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  }
}
