// What every check is made of: a result to fill (problems fail the check, warnings are to look at), a table and a browser that are closed when the check ends, the board opened for the viewer and waited for until it is still, and the
// recording of what the page paints.
import { join } from "node:path"
import { boardDrawn, boardRevealed, pageText, readScene, sampleCanvas, textChangedAt, watchText } from "./probe.mjs"
import { launchBrowser } from "./browser.mjs"
import { makeSheet, writeFrames } from "./sheets.mjs"
import { openTable } from "./table.mjs"
import { distinct, matchesAny, meanDiff, maxDiff, seconds, sleep, waitFor } from "./util.mjs"

/** Console messages of a development server that say nothing about the board */
const DEFAULT_IGNORED = [/Download the React DevTools/, /\[HMR\]/, /\[Fast Refresh\]/]

/** How long after the board is shown the platform's announcements (the start of the game lasts 2 s, a round 1.8 s) are still over it */
const ANNOUNCEMENT_MS = 3500

/**
 * Errors that a development server makes on its own, shown as warnings: Turbopack names the chunk of a lazy component in the page's HTML with a hash that is not the one it serves (the page loads the chunk another way, and a chunk that is
 * really missing leaves no board, which the check says first).
 */
const DEV_SERVER_NOISE = [/Failed to load resource: the server responded with a status of 404.*\/_next\/static\/chunks\/.*\.js/]

/**
 * Waits until the board stands still: the camera has stopped and nothing on the canvas changes between two looks a moment apart. A table that never goes quiet (a glow that pulses, a clock) is given up on after `timeoutMs` and
 * said so (`settled: false`), not failed: the check goes on with what is on the screen.
 */
export async function settle(page, { minMs = 400, quietMs = 800, timeoutMs = 15_000, threshold = 1.5 } = {}) {
  const started = Date.now()
  await sleep(minMs)
  const looks = []
  while (Date.now() - started < timeoutMs) {
    const scene = await page.eval(readScene)
    const pixels = await page.eval(sampleCanvas)
    const now = Date.now()
    looks.push({ at: now, camera: scene.ok ? [...scene.camera.view, ...scene.camera.projection] : null, pixels })
    while (looks.length > 2 && looks[1].at <= now - quietMs) looks.shift()
    const oldest = looks[0]
    if (now - oldest.at >= quietMs * 0.9 && oldest.camera && looks.at(-1).camera && maxDiff(oldest.camera, looks.at(-1).camera) < 1e-4 && meanDiff(oldest.pixels, pixels) <= threshold) {
      return { settled: true, ms: now - started }
    }
    await sleep(150)
  }
  return { settled: false, ms: Date.now() - started }
}

/**
 * Runs one check. `body(env)` does the work and fills `env.result`; whatever it throws is a problem of the check, and so is any error that the page printed while it ran (console errors, exceptions, a failed resource, an error of
 * the API: `ignoreConsole` of the game's config silences the ones that are known). The tables it opened are left and the browsers closed at the end, whatever happened.
 */
export async function runCheck(ctx, { check, seats, timeoutMs = 600_000, lenient = false }, body) {
  const result = { check, seats, status: "pass", problems: [], warnings: [], files: [], data: {}, ms: 0 }
  const tables = []
  const pages = []
  const started = Date.now()
  const label = `${check}${seats ? ` · ${seats} seats` : ""}`
  const env = {
    ctx,
    result,
    label,
    fail: (message) => result.problems.push(message),
    warn: (message) => result.warnings.push(message),
    say: (message) => ctx.log(`  ${message}`),
    /** A table of the game with `seats` guests (the check's own count unless told) */
    async table(options = {}) {
      const table = await openTable({ base: ctx.base, slug: ctx.slug, seats, options: ctx.config.options ?? {}, bot: ctx.config.bot ?? null, ...options })
      tables.push(table)
      return table
    },
    /** A browser, its page labelled with this check so that its issues are the check's */
    async browser(options = {}) {
      const page = await launchBrowser({ reducedMotion: ctx.args.reducedMotion, ...options })
      page.phase = label
      pages.push(page)
      return page
    },
    /** The viewer's browser, on the board of the table: waits for the canvas, a scene and a table that stands still. Throws when the board does not draw */
    async board(table, { viewport = ctx.args.viewport, wait = true } = {}) {
      const page = await env.browser()
      await page.setViewport(...viewport)
      for (const cookie of table.cookies(0)) await page.setCookie(`${table.base}/`, cookie.name, cookie.value)
      page.watchTable(table.slug, table.code)
      const opened = Date.now()
      await page.goto(table.boardUrl)
      const drawn = await waitFor(
        async () => {
          const seen = await page.eval(boardDrawn)
          return seen.canvas && seen.scene ? seen : null
        },
        { timeoutMs: 120_000, everyMs: 500 },
      )
      if (!drawn) {
        const seen = await page.eval(boardDrawn).catch(() => ({}))
        const text = await page.eval(pageText).catch(() => "")
        throw new Error(`no board: ${seen.canvas ? "a canvas, but no three.js scene was drawn" : "no canvas"} two minutes after the page was opened. The page says: "${text.slice(0, 160)}"`)
      }
      const drawnAfter = Date.now() - opened
      if (wait) {
        // the platform's loading screen lies over the board until it is loaded: what is measured and photographed is what is under it
        if (!(await waitFor(() => page.eval(boardRevealed), { timeoutMs: 90_000, everyMs: 300 }))) {
          throw new Error(`the board is drawn but never shown: something of the page lies over it ninety seconds after it was opened. The page says: "${(await page.eval(pageText)).slice(0, 160)}"`)
        }
        const shownAt = Date.now()
        const still = await settle(page)
        // The platform announces the start of a game over the table for two or three seconds, in the page and not on the canvas, so a table with no camera entrance (reduced motion) is still while the announcement is up: what is measured and photographed comes after it
        await sleep(Math.max(0, ANNOUNCEMENT_MS - (Date.now() - shownAt)))
        if (!still.settled) env.warn(`the board never stood still within ${seconds(still.ms)}: the pictures were taken while something moved`)
        return Object.assign(page, { drawnAfter, stillAfter: still.ms })
      }
      return Object.assign(page, { drawnAfter, stillAfter: 0 })
    },
    /** Writes frames to the frames folder, tiles them into a sheet of `out` and notes both in the result. Gives the sheet's path */
    async sheet(name, frames, { columns = 3, cell = [480, 300], extension = "jpg" } = {}) {
      const images = writeFrames(join(ctx.out, "frames", name), frames, extension)
      const path = join(ctx.out, `${name}.png`)
      await makeSheet(ctx.ffmpeg, { images, out: path, columns, cell })
      result.files.push(`${name}.png`)
      return path
    },
    /**
     * Records what the page paints while `action` runs and for `seconds` after, from the moment the text of the page first changes (the board learns of a move about when the history does), and tiles `count` frames, `step` seconds
     * apart, into the sheet `name`. `lead` is how long before that change the sheet starts.
     */
    async record(page, name, action, { seconds: after = 7, step = 0.5, lead = 0.4, count = 9, columns = 3 } = {}) {
      await page.eval(watchText)
      await page.startScreencast({ width: ctx.args.viewport[0], height: ctx.args.viewport[1] })
      const t0 = Date.now()
      let failure = null
      try {
        await action()
      } catch (error) {
        failure = error
      }
      const acted = Date.now() - t0
      await sleep(after * 1000)
      const frames = await page.stopScreencast()
      const first = await page.eval(textChangedAt)
      if (failure) throw failure
      if (frames.length === 0) throw new Error(`${name}: the page painted no frame while the move played`)
      const start = (first ?? t0) - lead * 1000
      const picked = []
      for (let k = 0; k < count; k++) {
        const at = start + k * step * 1000
        picked.push((frames.filter((frame) => frame.t <= at).at(-1) ?? frames[0]).data)
      }
      await env.sheet(name, picked, { columns })
      return { frames: frames.length, actedMs: acted, seenAfterMs: first ? first - t0 : null }
    },
  }

  const timer = { id: null }
  try {
    await Promise.race([
      body(env),
      new Promise((_, reject) => {
        timer.id = setTimeout(() => reject(new Error(`timed out after ${seconds(timeoutMs)}`)), timeoutMs)
      }),
    ])
  } catch (error) {
    result.problems.push(String(error?.message ?? error))
  } finally {
    clearTimeout(timer.id)
    // What the pages printed while this check ran
    const ignored = [...DEFAULT_IGNORED, ...(ctx.config.ignoreConsole ?? [])]
    const issues = pages.flatMap((page) => page.issues).filter((issue) => !matchesAny(issue.text, ignored))
    // A lenient check (the warm-up: a server that compiles on demand is noisy on the first look) only warns of what the page printed
    const errors = issues.filter((issue) => issue.level === "error")
    const noise = errors.filter((issue) => matchesAny(issue.text, DEV_SERVER_NOISE))
    const printed = distinct(errors.filter((issue) => !noise.includes(issue)).map((issue) => `the page printed an error (${issue.kind}): ${issue.text}`), 6)
    if (lenient) result.warnings.push(...printed)
    else result.problems.push(...printed)
    result.warnings.push(...distinct(noise.map((issue) => `the dev server printed an error that is its own (${issue.kind}): ${issue.text}`), 2))
    const warnings = distinct(issues.filter((issue) => issue.level === "warning").map((issue) => `the page warned (${issue.kind}): ${issue.text}`), 4)
    result.warnings.push(...warnings)
    for (const page of pages) await page.close().catch(() => {})
    if (!ctx.args.keepTables) {
      const leaving = await Promise.all(tables.map((table) => table.leaveAll()))
      result.data.tablesLeft = leaving.reduce((sum, n) => sum + n, 0)
    } else {
      result.data.tables = tables.map((table) => table.code)
    }
  }
  result.ms = Date.now() - started
  result.status = result.problems.length ? "fail" : "pass"
  return result
}

/** A check that has nothing to run, and says why */
export function skipped(check, seats, why) {
  return { check, seats, status: "skipped", problems: [], warnings: [why], files: [], data: {}, ms: 0 }
}
