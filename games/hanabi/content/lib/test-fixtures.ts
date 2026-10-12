import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"

export type Size = { width: number; height: number }

/** A plain-colour image. Two colours give two different files, so two different content hashes. */
export async function imageOf(color: string, size: Size = { width: 40, height: 56 }, format: "png" | "jpeg" | "webp" = "png"): Promise<Buffer> {
  const image = sharp({ create: { width: size.width, height: size.height, channels: 3, background: color } })
  if (format === "jpeg") return image.jpeg().toBuffer()
  if (format === "webp") return image.webp().toBuffer()
  return image.png().toBuffer()
}

/** Temporary folders for the tests that need real files on disk, all removed by `cleanUp()` (call it from `afterEach`). */
export class TempFolders {
  private folders: string[] = []

  async create(files: Record<string, Buffer | string> = {}): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "hanabi-content-"))
    this.folders.push(dir)
    for (const [name, data] of Object.entries(files)) await writeFile(join(dir, name), data)
    return dir
  }

  async cleanUp(): Promise<void> {
    await Promise.all(this.folders.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  }
}
