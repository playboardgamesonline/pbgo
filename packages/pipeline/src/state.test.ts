import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { acquireLock, emptyStep, findGame, listGames, LockedError, moveGameDir, newState, parseState, readState, STATE_FILE, stepOf, writeState } from "./state.ts"

const NOW = new Date("2026-11-16T10:00:00Z")
let root = ""

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pipeline-state-"))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const make = (name: string, slug: string) => newState({ name, slug, sessionId: "11111111-1111-4111-8111-111111111111", now: NOW })

describe("the state of a game", () => {
  it("is written whole and read back as it was", () => {
    const state = make("Love Letter", "love-letter")
    const scout = stepOf(state, "scout")
    scout.status = "gate"
    scout.report = "Love Letter (love-letter)"
    scout.links = ["https://example.com/a"]
    scout.check = { ok: true, lines: ["ok"] }
    scout.issue = { id: "i1", identifier: "GAM-42", url: "https://linear.app/x", title: "Love Letter: scout", applied: "In Progress", commented: false }
    state.linear.parent = { id: "p1", identifier: "GAM-41", url: "https://linear.app/y", title: "Love Letter: add the game", applied: "In Progress", commented: false }
    writeState(join(root, "love-letter"), state, NOW)
    expect(readState(join(root, "love-letter"))).toEqual(state)
    // no temporary file is left next to it
    expect(readdirSync(join(root, "love-letter"))).toEqual([STATE_FILE])
  })

  it("holds a step that the file does not know as a step not started", () => {
    const state = make("Love Letter", "love-letter")
    expect(stepOf(state, "later-step")).toEqual(emptyStep())
    expect(Object.keys(state.steps)).toEqual(["later-step"])
  })

  it("refuses a state of another version, and says what is wrong with a file that is not one", () => {
    expect(parseState(JSON.stringify({ version: 2 })).problems[0]).toContain("version 2")
    expect(parseState("not json").problems).toEqual(["the file is not JSON"])
    expect(parseState("[]").problems).toEqual(["the file is not an object"])
    const broken = JSON.parse(JSON.stringify(make("A", "a")))
    broken.steps.scout = { status: "dreaming" }
    expect(parseState(JSON.stringify(broken)).problems[0]).toContain("steps.scout.status")
    broken.session = { id: 1 }
    expect(parseState(JSON.stringify(broken)).state).toBeNull()
  })

  it("is found by the name that was typed, by a name the scout settled, or by the slug", () => {
    const state = make("Take 5", "take-5")
    state.aliases.push("6 nimmt!")
    state.name = "6 nimmt!"
    state.slug = "6-nimmt"
    writeState(join(root, "6-nimmt"), state, NOW)
    expect(findGame(root, "6 nimmt!")?.dir).toBe(join(root, "6-nimmt"))
    expect(findGame(root, "take 5")?.state.slug).toBe("6-nimmt")
    expect(findGame(root, "TAKE   5")?.state.slug).toBe("6-nimmt")
    expect(findGame(root, "6-nimmt")?.state.name).toBe("6 nimmt!")
    expect(findGame(root, "Love Letter")).toBeNull()
  })

  it("finds a game whatever the state of another folder is: a file that cannot be read stops no other game", () => {
    mkdirSync(join(root, "aaa-broken"))
    writeFileSync(join(root, "aaa-broken", STATE_FILE), "{ not json")
    mkdirSync(join(root, "bbb-old"))
    writeFileSync(join(root, "bbb-old", STATE_FILE), JSON.stringify({ version: 99 }))
    const state = make("Take 5", "take-5")
    state.aliases.push("6 nimmt!")
    state.slug = "6-nimmt"
    writeState(join(root, "6-nimmt"), state, NOW)
    expect(findGame(root, "6 nimmt!")?.state.slug).toBe("6-nimmt")
    // the folder a name makes, when its own state cannot be read, is an error that says which file
    expect(() => findGame(root, "aaa broken")).toThrow(/aaa-broken\/pipeline\.json/)
  })

  it("lists the games that have a state, the oldest first, and leaves out a folder that holds none", () => {
    writeState(join(root, "b"), newState({ name: "B", slug: "b", sessionId: "s", now: new Date("2026-11-16T12:00:00Z") }), NOW)
    writeState(join(root, "a"), newState({ name: "A", slug: "a", sessionId: "s", now: new Date("2026-11-16T09:00:00Z") }), NOW)
    mkdirSync(join(root, "art-only"))
    mkdirSync(join(root, ".hidden"))
    mkdirSync(join(root, "broken"))
    writeFileSync(join(root, "broken", STATE_FILE), "{")
    expect(listGames(root).map((game) => game.state.slug)).toEqual(["a", "b"])
  })

  it("moves a game's folder to the slug the scout settled, and never over a folder that is there", () => {
    writeState(join(root, "take-5"), make("Take 5", "take-5"), NOW)
    mkdirSync(join(root, "taken"))
    expect(() => moveGameDir(root, join(root, "take-5"), "taken")).toThrow(/already exists/)
    expect(moveGameDir(root, join(root, "take-5"), "6-nimmt")).toBe(join(root, "6-nimmt"))
    expect(existsSync(join(root, "take-5"))).toBe(false)
    expect(existsSync(join(root, "6-nimmt", STATE_FILE))).toBe(true)
  })
})

describe("the lock of a game", () => {
  it("is taken once, refused to a second run, and let go", () => {
    const dir = join(root, "game")
    const lock = acquireLock(dir)
    // a lock held by another process that is alive (the parent of this one)
    writeFileSync(lock.path, String(process.ppid))
    expect(() => acquireLock(dir)).toThrow(LockedError)
    lock.release()
    expect(existsSync(lock.path)).toBe(false)
  })

  it("is taken over when the process that held it is gone", () => {
    const dir = join(root, "game")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "pipeline.lock"), "999999999")
    const lock = acquireLock(dir)
    expect(readFileSync(lock.path, "utf8")).toBe(String(process.pid))
  })

  it("follows the folder when it moves", () => {
    const lock = acquireLock(join(root, "game"))
    const target = moveGameDir(root, join(root, "game"), "moved")
    lock.dir = target
    lock.release()
    expect(existsSync(join(root, "moved", "pipeline.lock"))).toBe(false)
  })
})
