// One command at a time. Every verb that writes a state reads it, changes it and writes it whole, so two verbs that run together (a program that calls its tools in parallel, a second session on the same
// game) would lose an update. The lock is a file in the folder of the games' working files, taken by `wx` with the process number in it: a verb waits a few seconds for the one that holds it, and a lock
// whose process is gone is taken over.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const LOCK_FILE = ".game-flow.lock"

export class LockedError extends Error {
  readonly pid: number
  constructor(pid: number) {
    super(`another pnpm game-flow command is running (process ${pid}): run the commands one at a time`)
    this.pid = pid
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "EPERM"
  }
}

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

/** Runs `run` while holding the lock of the folder `root`; waits up to `timeoutMs` for another command to let go. */
export async function withLock<T>(root: string, run: () => Promise<T>, options: { timeoutMs?: number; pid?: number } = {}): Promise<T> {
  const pid = options.pid ?? process.pid
  mkdirSync(root, { recursive: true })
  const path = join(root, LOCK_FILE)
  const deadline = Date.now() + (options.timeoutMs ?? 10_000)
  for (;;) {
    try {
      writeFileSync(path, String(pid), { flag: "wx" })
      break
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")) throw error
      let other = Number.NaN
      try {
        other = Number(readFileSync(path, "utf8").trim())
      } catch {
        // the lock was let go between the two calls: try again
        continue
      }
      // a lock that holds no process number, or whose process is gone, is taken over
      if (!Number.isInteger(other) || other <= 0 || !alive(other)) {
        rmSync(path, { force: true })
        continue
      }
      if (Date.now() > deadline) throw new LockedError(other)
      await sleep(25)
    }
  }
  try {
    return await run()
  } finally {
    rmSync(path, { force: true })
  }
}
