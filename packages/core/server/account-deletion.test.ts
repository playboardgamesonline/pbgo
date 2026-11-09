import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The server's part of the deletion of an account, against a database that only records what it is asked: the steps and their order, the arguments, and what a failure does. What the functions of the database decide is tried in
 * `supabase/tests/account_deletion.sql`; here the SQL file is read for two things only, that every function this module calls exists in it with the parameters this module passes, and that the words it writes are those of the code.
 */

const h = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  answers: {} as Record<string, unknown>,
  failures: {} as Record<string, string>,
  feedbackFails: null as string | null,
}))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      h.calls.push({ name, args })
      if (h.failures[name]) return { data: null, error: { message: h.failures[name] } }
      return { data: h.answers[name] ?? null, error: null }
    },
  }),
}))
vi.mock("./feedback-removal", () => ({
  removeFeedbackOf: async (_db: unknown, email: string) => {
    h.calls.push({ name: "feedback of", args: { email } })
    if (h.feedbackFails) throw new Error(h.feedbackFails)
    return { deleted: 2, screenshots: 1 }
  },
}))

import { DELETED_PLAYER } from "@pbgo/ui/tables"
import { closeAccount, dueAccounts, eraseAccount, hashReopenToken, newReopenToken, peekReopenLink, reopenAccount } from "./account-deletion"

const NOW = new Date("2026-11-09T12:00:00.000Z")
const UNTIL = new Date("2026-11-16T23:59:59.999Z")
const USER = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b"
const TOKEN = "T".repeat(43)
const names = () => h.calls.map((call) => call.name)

beforeEach(() => {
  h.calls.length = 0
  h.answers = {}
  h.failures = {}
  h.feedbackFails = null
})

describe("the token of a link", () => {
  it("is 43 characters of base64url, different every time, and the database keeps its SHA-256 and never the token", () => {
    const tokens = new Set(Array.from({ length: 50 }, newReopenToken))
    expect(tokens.size).toBe(50)
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashReopenToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    expect(hashReopenToken("abc")).toBe(createHash("sha256").update("abc").digest("hex"))
  })
})

describe("closing an account", () => {
  it("sends the hash of the token and the day the link stops working, and answers that day as a date", async () => {
    h.answers.close_account = "2026-11-16T23:59:59.999Z"
    expect(await closeAccount(USER, TOKEN, UNTIL)).toEqual(UNTIL)
    expect(h.calls).toEqual([{ name: "close_account", args: { p_user: USER, p_token_hash: hashReopenToken(TOKEN), p_scheduled: "2026-11-16T23:59:59.999Z" } }])
    expect(JSON.stringify(h.calls)).not.toContain(TOKEN)
  })

  it("answers null for an account that does not exist or is closed already", async () => {
    h.answers.close_account = null
    expect(await closeAccount(USER, TOKEN, UNTIL)).toBeNull()
  })

  it("fails with the name of the function and what the database said when it cannot be asked", async () => {
    h.failures.close_account = "a closed account needs a token and a day in the future"
    await expect(closeAccount(USER, TOKEN, UNTIL)).rejects.toThrow("close_account: a closed account needs a token and a day in the future")
  })
})

describe("looking at a link and following it", () => {
  it("shows the address and the day when the link is good, asking with the hash, and nothing otherwise", async () => {
    h.answers.peek_reopen_link = [{ email: "ann@example.com", scheduled_for: "2026-11-16T23:59:59.999+00:00" }]
    expect(await peekReopenLink(USER, TOKEN)).toEqual({ email: "ann@example.com", reopensUntil: UNTIL })
    expect(h.calls[0]).toEqual({ name: "peek_reopen_link", args: { p_user: USER, p_token_hash: hashReopenToken(TOKEN) } })
    h.answers.peek_reopen_link = []
    expect(await peekReopenLink(USER, TOKEN)).toBeNull()
    h.answers.peek_reopen_link = null
    expect(await peekReopenLink(USER, TOKEN)).toBeNull()
  })

  it("reads an account with no address as one, not as a bad link", async () => {
    h.answers.peek_reopen_link = [{ email: null, scheduled_for: "2026-11-16T23:59:59.999Z" }]
    expect(await peekReopenLink(USER, TOKEN)).toEqual({ email: null, reopensUntil: UNTIL })
  })

  it("reopens the account on the hash of the token, and says whether the link was good", async () => {
    h.answers.reopen_account = true
    expect(await reopenAccount(USER, TOKEN)).toBe(true)
    expect(h.calls[0]).toEqual({ name: "reopen_account", args: { p_user: USER, p_token_hash: hashReopenToken(TOKEN) } })
    h.answers.reopen_account = false
    expect(await reopenAccount(USER, TOKEN)).toBe(false)
    h.answers.reopen_account = null
    expect(await reopenAccount(USER, TOKEN)).toBe(false)
  })
})

describe("deleting an account", () => {
  it("deletes the feedback sent with its address first and the account after", async () => {
    h.answers.erase_account = true
    const done = await eraseAccount(USER, "ann@example.com")
    expect(done).toEqual({ erased: true, feedback: 2, screenshots: 1 })
    expect(names()).toEqual(["feedback of", "erase_account"])
    expect(h.calls[1]).toEqual({ name: "erase_account", args: { p_user: USER } })
  })

  it("waits for the day when it is told to: the database deletes only a closed account whose day has passed by then", async () => {
    h.answers.erase_account = true
    await eraseAccount(USER, null, { dueBefore: NOW })
    expect(h.calls).toEqual([{ name: "erase_account", args: { p_user: USER, p_due_before: "2026-11-09T12:00:00.000Z" } }])
  })

  it("answers that nothing was deleted for an account that was kept or is gone", async () => {
    h.answers.erase_account = false
    expect(await eraseAccount(USER, null, { dueBefore: NOW })).toEqual({ erased: false, feedback: 0, screenshots: 0 })
  })

  it("looks for no feedback without an address that mail can reach: none, or the stand-in of a provider that gives none", async () => {
    h.answers.erase_account = true
    await eraseAccount(USER, null)
    await eraseAccount(USER, "steam-3f2b8c1e@external.pbgo.invalid")
    expect(names()).toEqual(["erase_account", "erase_account"])
  })

  it("keeps the account when its feedback cannot be deleted: nothing would link what is left to it afterwards", async () => {
    h.feedbackFails = "storage is down"
    await expect(eraseAccount(USER, "ann@example.com")).rejects.toThrow("storage is down")
    expect(names()).toEqual(["feedback of"])
  })

  it("fails with the name of the function when the database cannot delete it", async () => {
    h.failures.erase_account = "deadlock detected"
    await expect(eraseAccount(USER, null)).rejects.toThrow("erase_account: deadlock detected")
  })
})

describe("the accounts that are due", () => {
  it("lists the accounts whose day has passed with their address", async () => {
    h.answers.due_account_deletions = [
      { user_id: "u1", email: "ann@example.com" },
      { user_id: "u2", email: null },
    ]
    expect(await dueAccounts(NOW, 20)).toEqual([
      { userId: "u1", email: "ann@example.com" },
      { userId: "u2", email: null },
    ])
    expect(h.calls[0]).toEqual({ name: "due_account_deletions", args: { p_before: "2026-11-09T12:00:00.000Z", p_limit: 20 } })
    h.answers.due_account_deletions = null
    expect(await dueAccounts(NOW, 20)).toEqual([])
  })
})

describe("the functions of migration 0011", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0011_account_deletion.sql", import.meta.url), "utf8")
  const source = readFileSync(new URL("./account-deletion.ts", import.meta.url), "utf8")
  const signature = (name: string) => sql.match(new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`))?.[1]

  it("hold every function this module calls, with the parameters it passes", () => {
    const expected: Record<string, string[]> = {
      close_account: ["p_user", "p_token_hash", "p_scheduled"],
      peek_reopen_link: ["p_user", "p_token_hash"],
      reopen_account: ["p_user", "p_token_hash"],
      erase_account: ["p_user", "p_due_before"],
      due_account_deletions: ["p_before", "p_limit"],
    }
    const called = [...source.matchAll(/call<[^(]*>\(\s*"([a-z_]+)"/g)].map((match) => match[1]!)
    expect([...new Set(called)].sort()).toEqual(Object.keys(expected).sort())
    for (const [name, parameters] of Object.entries(expected)) {
      const found = signature(name)
      expect(found, name).toBeDefined()
      for (const parameter of parameters) expect(found, `${name}(${parameter})`).toContain(parameter)
    }
  })

  it("write the words that the pages of a table read for a player who is gone", () => {
    expect(sql).toContain(`'${DELETED_PLAYER}'`)
  })

  it("ban the account through Supabase Auth's own column, a hundred years ahead, and keep the ban it had", () => {
    expect(sql).toContain("banned_until = greatest(v_previous, p_scheduled + interval '100 years')")
    expect(sql).toContain("banned_until = v_previous")
  })

  it("are all closed to the public roles and open to the service role, the trigger apart", () => {
    const functions = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map((match) => match[1]!)
    expect(functions.length).toBe(7)
    for (const name of functions) expect(sql, name).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`))
    for (const name of functions.filter((name) => name !== "erase_member_from_tables")) expect(sql, name).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role`))
  })
})
