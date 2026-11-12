// A headless Chromium driven over the DevTools protocol, with Node's own fetch and WebSocket: no dependency. The browser is the one Playwright keeps in its cache (`npx playwright install chromium` fills it); nothing is added to the repo.
import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { installProbe } from "./probe.mjs"
import { sleep, waitFor } from "./util.mjs"

/** Where Playwright keeps the browsers it downloads */
function browserCache() {
  const custom = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (custom && custom !== "0") return custom
  if (process.platform === "darwin") return join(homedir(), "Library/Caches/ms-playwright")
  if (process.platform === "win32") return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData/Local"), "ms-playwright")
  return join(homedir(), ".cache/ms-playwright")
}

/** The first file under `dir`, at most `depth` folders down, that `wanted` accepts */
function findFile(dir, wanted, depth) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return null
  }
  for (const name of names) {
    const path = join(dir, name)
    let stat
    try {
      stat = statSync(path)
    } catch {
      continue
    }
    if (stat.isFile() && wanted(name)) return path
  }
  if (depth <= 0) return null
  for (const name of names) {
    const path = join(dir, name)
    try {
      if (!statSync(path).isDirectory()) continue
    } catch {
      continue
    }
    const found = findFile(path, wanted, depth - 1)
    if (found) return found
  }
  return null
}

/** The Chromium that Playwright downloaded: the newest headless shell, else the newest full Chromium; null when there is none */
export function findBrowser() {
  const cache = browserCache()
  if (!existsSync(cache)) return null
  const dirs = readdirSync(cache)
  const newest = (prefix) => dirs.filter((dir) => dir.startsWith(prefix)).sort((a, b) => Number(b.split("-").at(-1)) - Number(a.split("-").at(-1)))
  for (const dir of newest("chromium_headless_shell-")) {
    const path = findFile(join(cache, dir), (name) => name === "chrome-headless-shell" || name === "chrome-headless-shell.exe" || name === "headless_shell", 3)
    if (path) return { path, shell: true }
  }
  for (const dir of newest("chromium-")) {
    const path = findFile(join(cache, dir), (name) => name === "Chromium" || name === "chrome" || name === "chrome.exe", 6)
    if (path) return { path, shell: false }
  }
  return null
}

const open = new Set()
process.on("exit", () => {
  for (const browser of open) browser.kill()
})

/** The protocol: commands with answers, and events */
async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true })
    ws.addEventListener("error", () => reject(new Error("the browser's debugging socket refused the connection")), { once: true })
  })
  let nextId = 0
  const pending = new Map()
  const handlers = new Map()
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined) {
      const entry = pending.get(message.id)
      pending.delete(message.id)
      if (!entry) return
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`))
      else entry.resolve(message.result)
      return
    }
    for (const handler of handlers.get(message.method) ?? []) handler(message.params)
  })
  ws.addEventListener("close", () => {
    for (const entry of pending.values()) entry.reject(new Error(`${entry.method}: the browser went away`))
    pending.clear()
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject, method })
      ws.send(JSON.stringify({ id, method, params }))
    })
  const on = (method, handler) => handlers.set(method, [...(handlers.get(method) ?? []), handler])
  return { send, on, close: () => ws.close() }
}

/** The path of a URL, to name a request in the report */
const pathOf = (url) => {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/**
 * Starts a headless browser with one page and gives it back. What happens in the page is kept in `page.issues`: console errors and warnings, exceptions, resources that failed and answers of `/api/` that are errors, each with the
 * `page.phase` it happened in, so that a check reads what is its own.
 */
export async function launchBrowser({ reducedMotion = false } = {}) {
  const found = findBrowser()
  if (!found) throw new Error("no Chromium in Playwright's cache")
  const profile = mkdtempSync(join(tmpdir(), "check-board-"))
  const flags = [
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--hide-scrollbars",
    "--mute-audio",
    // software rendering: the machine need not have a GPU, and the frames are the same on every machine
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
    // a window nobody looks at is drawn at full speed
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    ...(found.shell ? [] : ["--headless=new"]),
    "about:blank",
  ]
  const child = spawn(found.path, flags, { stdio: "ignore" })
  const handle = { kill: () => child.kill("SIGKILL") }
  open.add(handle)
  // A browser that cannot start (a wrong architecture, a missing library) or that dies at once says so instead of leaving the run to wait for it
  let died = null
  child.on("error", (error) => {
    died = `${found.path} could not start: ${error.message}`
  })
  child.on("exit", (code, signal) => {
    died ??= `the browser exited (code ${code}, signal ${signal}) before it was ready`
  })

  const stop = async (connection) => {
    connection?.close()
    open.delete(handle)
    if (child.exitCode === null) {
      child.kill("SIGTERM")
      await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(4000)])
      if (child.exitCode === null) child.kill("SIGKILL")
    }
    rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
  }

  try {
    // Chromium writes the port it chose, then the path of the browser's socket, to a file of its profile
    const started = await waitFor(
      () => {
        if (died) return { died }
        const text = readFileSync(join(profile, "DevToolsActivePort"), "utf8")
        const number = Number(text.split("\n")[0])
        return number ? { port: number } : null
      },
      { timeoutMs: 20_000, everyMs: 150 },
    )
    if (!started || started.died) throw new Error(started?.died ?? "the browser did not say which port it listens on")
    const { port } = started
    const targets = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((target) => target.type === "page"), { timeoutMs: 10_000 })
    if (!targets?.length) throw new Error("the browser opened no page")
    const connection = await connect(targets[0].webSocketDebuggerUrl)
    const { send, on } = connection
    const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser

    const page = { issues: [], phase: "", frames: [], seen: { version: null, at: 0 }, send, on, version }
    const note = (level, kind, text) => page.issues.push({ at: Date.now(), phase: page.phase, level, kind, text: String(text).slice(0, 300) })

    on("Runtime.consoleAPICalled", (p) => {
      if (p.type !== "error" && p.type !== "warning") return
      // A message with styles (`%c`, as the Sanity client prints its own) loses them: what is left is the words
      const text = p.args.map((a) => a.value ?? a.description ?? "").join(" ")
      note(p.type === "error" ? "error" : "warning", "console", text.replace(/%[cs]/g, "").replace(/(background|color|border-radius):[^;]*;?/g, "").replace(/\s+/g, " ").trim())
    })
    on("Runtime.exceptionThrown", (p) => note("error", "exception", p.exceptionDetails.exception?.description ?? p.exceptionDetails.text))
    on("Inspector.targetCrashed", () => note("error", "crash", "the page crashed (out of memory, or the browser gave up on it)"))
    on("Log.entryAdded", (p) => {
      if (p.entry.level === "error") note("error", "log", `${p.entry.text} ${p.entry.url ? pathOf(p.entry.url) : ""}`)
    })

    // What the page asks of the API: the errors it gets, and the version of the table it has been told (what lets a check wait for the board to know a move)
    const requests = new Map()
    const watched = new Set()
    let watching = null
    on("Network.requestWillBeSent", (p) => requests.set(p.requestId, { method: p.request.method, url: p.request.url }))
    on("Network.responseReceived", (p) => {
      const request = requests.get(p.requestId)
      const path = pathOf(p.response.url)
      if (p.response.status >= 400 && path.startsWith("/api/")) note(p.response.status >= 500 || p.response.status === 429 ? "error" : "warning", "api", `${request?.method ?? "?"} ${path} → ${p.response.status}`)
      if (watching && p.response.status === 200 && watching.test(path)) watched.add(p.requestId)
    })
    on("Network.loadingFinished", async (p) => {
      if (!watched.delete(p.requestId)) return
      try {
        const body = JSON.parse((await send("Network.getResponseBody", { requestId: p.requestId })).body)
        if (typeof body.version === "number") page.seen = { version: body.version, at: Date.now() }
      } catch {
        // the answer is gone from the browser's memory: the next poll says it again
      }
    })
    on("Page.screencastFrame", (p) => {
      page.frames.push({ t: Date.now(), data: p.data })
      void send("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {})
    })

    for (const domain of ["Page", "Runtime", "Log", "Network", "Inspector"]) await send(`${domain}.enable`)
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installProbe.toString()})()` })
    if (reducedMotion) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] })

    let loaded = null
    on("Page.loadEventFired", () => loaded?.())
    const load = async (start, timeoutMs) => {
      const done = new Promise((resolve) => (loaded = resolve))
      await start()
      await Promise.race([done, sleep(timeoutMs)])
    }

    /** Opens a page and waits for its load event */
    page.goto = (url, { timeoutMs = 120_000 } = {}) => load(() => send("Page.navigate", { url }), timeoutMs)
    page.reload = ({ timeoutMs = 120_000 } = {}) => load(() => send("Page.reload"), timeoutMs)
    /** Runs a function in the page (it is sent as text, so it may use nothing of this module) with arguments that are JSON, and gives what it returns */
    page.eval = async (fn, ...args) => {
      const result = await send("Runtime.evaluate", { expression: `(${fn.toString()})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result.value
    }
    /** The size of the window; below 700 px wide it is a phone with a finger */
    page.setViewport = async (width, height) => {
      const mobile = width < 700
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile })
      await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 })
    }
    page.screenshot = async ({ format = "jpeg", quality = 70 } = {}) => Buffer.from((await send("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality } : {}) })).data, "base64")
    /** A press of the mouse: it moves there first and rests a moment, as a hand does, then presses and lets go */
    page.click = async (x, y, { hoverMs = 250 } = {}) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
      await sleep(hoverMs)
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 })
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 })
    }
    page.setCookie = (url, name, value) => send("Network.setCookie", { url, name, value, httpOnly: true, sameSite: "Lax" })
    /** From now on, learn the version of the table as the page itself is told it: by its polls of `/api/<slug>/games/<code>` and by the answers to its own moves */
    page.watchTable = (slug, code) => {
      watching = new RegExp(`^/api/${slug}/games/${code}(/[a-z]+)?$`)
      page.seen = { version: null, at: 0 }
    }
    /** Waits until the page has been told version `version` of the table, or later: the board then shows it a moment after */
    page.knows = (version, timeoutMs = 20_000) => waitFor(() => page.seen.version !== null && page.seen.version >= version, { timeoutMs, everyMs: 100 })
    /** Records what the page paints, frame by frame, until `stopScreencast` */
    page.startScreencast = async ({ width, height, quality = 60 }) => {
      page.frames = []
      await send("Page.startScreencast", { format: "jpeg", quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 })
    }
    page.stopScreencast = async () => {
      await send("Page.stopScreencast")
      const { frames } = page
      page.frames = []
      return frames
    }
    page.close = () => stop(connection)
    return page
  } catch (error) {
    await stop(null)
    throw error
  }
}
