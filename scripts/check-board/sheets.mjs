// Contact sheets: frames of the board tiled into one picture, made with ffmpeg (which has to be installed: `brew install ffmpeg`). ffmpeg's `tile` takes frames of one size, so each frame is scaled and padded to a cell first.
import { execFile } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

/** The ffmpeg to use and its version, or null when there is none: `FFMPEG` of the environment, else the one on the PATH, else where Homebrew puts it */
export async function findFfmpeg() {
  for (const candidate of [process.env.FFMPEG, "ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].filter(Boolean)) {
    try {
      const { stdout } = await run(candidate, ["-version"])
      return { path: candidate, version: /ffmpeg version (\S+)/.exec(stdout)?.[1] ?? "?" }
    } catch {
      // not there
    }
  }
  return null
}

/** Writes frames (Buffers, or base64 strings) as numbered pictures of a folder; gives their paths */
export function writeFrames(dir, frames, extension = "jpg") {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return frames.map((frame, k) => {
    const path = join(dir, `${String(k).padStart(2, "0")}.${extension}`)
    writeFileSync(path, typeof frame === "string" ? Buffer.from(frame, "base64") : frame)
    return path
  })
}

/** Tiles pictures into one PNG, `columns` to a row, each in a cell of `cell` pixels (scaled to fit, on black). Gives the path of the sheet */
export async function makeSheet(ffmpeg, { images, out, columns = 3, cell = [480, 300] }) {
  const [w, h] = cell
  const scratch = `${out}.parts`
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(scratch, { recursive: true })
  const fit = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`
  try {
    for (let first = 0; first < images.length; first += 4) {
      await Promise.all(
        images.slice(first, first + 4).map((image, k) => run(ffmpeg.path, ["-y", "-loglevel", "error", "-i", image, "-vf", fit, join(scratch, `${String(first + k).padStart(3, "0")}.png`)])),
      )
    }
    const rows = Math.ceil(images.length / columns)
    await run(ffmpeg.path, ["-y", "-loglevel", "error", "-framerate", "1", "-i", join(scratch, "%03d.png"), "-vf", `tile=${Math.min(columns, images.length)}x${rows}`, "-frames:v", "1", out])
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  return out
}
