import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CORE_ERROR_MESSAGES } from "./api"

// What a player can read after a call to a game: the routes of a game, and the files they share. The gamemaster has its own messages (`admin-api.ts`).
const READ_BY_PLAYERS = ["../routes/api/games", "../routes/api/feedback", "../server/games.ts", "../server/api.ts"]

function sourcesOf(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path).flatMap((name) => sourcesOf(join(path, name)))
}

describe("the codes the routes of a game refuse with", () => {
  it("all have a message in the platform's wording: a player never reads [missing: …] for one of them", () => {
    const thrown = new Set<string>()
    for (const root of READ_BY_PLAYERS) {
      for (const file of sourcesOf(new URL(root, import.meta.url).pathname)) {
        if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue
        for (const match of readFileSync(file, "utf8").matchAll(/new ApiError\(\s*"([A-Z_]+)"/g)) thrown.add(match[1]!)
      }
    }
    expect(thrown.size).toBeGreaterThan(10)
    expect([...thrown].filter((code) => !(code in CORE_ERROR_MESSAGES)).sort()).toEqual([])
  })
})
