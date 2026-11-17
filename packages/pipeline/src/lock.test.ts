import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { LOCK_FILE, LockedError, withLock } from "./lock.ts"

let root = ""
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "flow-lock-"))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("the lock of the games' folder", () => {
  it("is held while the command runs, and let go when it ends, whatever it does", async () => {
    let seen = ""
    await withLock(root, async () => {
      seen = readFileSync(join(root, LOCK_FILE), "utf8")
    })
    expect(seen).toBe(String(process.pid))
    expect(existsSync(join(root, LOCK_FILE))).toBe(false)
    await expect(withLock(root, async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom")
    expect(existsSync(join(root, LOCK_FILE))).toBe(false)
  })

  it("makes two commands run one after the other, so that neither loses what the other wrote", async () => {
    const order: string[] = []
    const slow = withLock(root, async () => {
      order.push("slow starts")
      await new Promise((done) => setTimeout(done, 120))
      order.push("slow ends")
    })
    // the second is asked while the first holds the lock
    await new Promise((done) => setTimeout(done, 30))
    const fast = withLock(root, async () => {
      order.push("fast")
    })
    await Promise.all([slow, fast])
    expect(order).toEqual(["slow starts", "slow ends", "fast"])
  })

  it("gives up with a sentence that says what to do when the lock is not let go in time", async () => {
    // a lock held by a process that is alive: the parent of this one
    writeFileSync(join(root, LOCK_FILE), String(process.ppid))
    await expect(withLock(root, async () => "never", { timeoutMs: 80 })).rejects.toThrow(LockedError)
    await expect(withLock(root, async () => "never", { timeoutMs: 80 })).rejects.toThrow("run the commands one at a time")
    // the lock of the other command is left as it was
    expect(readFileSync(join(root, LOCK_FILE), "utf8")).toBe(String(process.ppid))
  })

  it("takes over a lock whose process is gone, and one that holds no process number", async () => {
    writeFileSync(join(root, LOCK_FILE), "999999999")
    expect(await withLock(root, async () => "first")).toBe("first")
    writeFileSync(join(root, LOCK_FILE), "")
    expect(await withLock(root, async () => "second")).toBe("second")
  })
})
