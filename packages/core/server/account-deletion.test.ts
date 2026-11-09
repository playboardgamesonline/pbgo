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

import { DELETION_KEY } from "@pbgo/accounts"
import { DELETED_PLAYER } from "@pbgo/ui/tables"
import { confirmDeletion, dueAccounts, eraseAccount, hashDeletionToken, keepAccount, newDeletionToken, peekDeletionLink, purgeDeletionLinks, requestDeletionLink } from "./account-deletion"

const NOW = new Date("2026-11-09T12:00:00.000Z")
const USER = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b"
const names = () => h.calls.map((call) => call.name)

beforeEach(() => {
  h.calls.length = 0
  h.answers = {}
  h.failures = {}
  h.feedbackFails = null
})

describe("the token of a link", () => {
  it("is 43 characters of base64url, different every time, and the database keeps its SHA-256 and never the token", () => {
    const tokens = new Set(Array.from({ length: 50 }, newDeletionToken))
    expect(tokens.size).toBe(50)
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashDeletionToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    expect(hashDeletionToken("abc")).toBe(createHash("sha256").update("abc").digest("hex"))
  })
})

describe("asking for a link", () => {
  it("sends the hash of the token and the moment it stops working, an hour on, and hands the token back for the e-mail", async () => {
    h.answers.request_account_deletion = "sent"
    const result = await requestDeletionLink(USER, NOW, "T".repeat(43))
    expect(result).toEqual({ status: "sent", token: "T".repeat(43), expiresAt: new Date("2026-11-09T13:00:00.000Z") })
    expect(h.calls).toEqual([{ name: "request_account_deletion", args: { p_user: USER, p_token_hash: hashDeletionToken("T".repeat(43)), p_expires: "2026-11-09T13:00:00.000Z" } }])
    expect(JSON.stringify(h.calls)).not.toContain("T".repeat(43))
  })

  it("makes a token of its own when it is not given one", async () => {
    h.answers.request_account_deletion = "sent"
    const result = await requestDeletionLink(USER, NOW)
    expect(result.status === "sent" && result.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("tells a link that came too soon, an account already on hold, and an account that does not exist, without a token", async () => {
    for (const status of ["wait", "on_hold", "unknown"] as const) {
      h.answers.request_account_deletion = status
      expect(await requestDeletionLink(USER, NOW)).toEqual({ status })
    }
    h.answers.request_account_deletion = "something new"
    expect(await requestDeletionLink(USER, NOW)).toEqual({ status: "unknown" })
  })

  it("fails with the name of the function and what the database said when it cannot be asked", async () => {
    h.failures.request_account_deletion = "function public.request_account_deletion does not exist"
    await expect(requestDeletionLink(USER, NOW)).rejects.toThrow("request_account_deletion: function public.request_account_deletion does not exist")
  })
})

describe("looking at a link and confirming it", () => {
  it("shows the address when the link is good and nothing otherwise, and asks with the hash", async () => {
    h.answers.peek_account_deletion = "ann@example.com"
    expect(await peekDeletionLink(USER, "T".repeat(43))).toBe("ann@example.com")
    expect(h.calls[0]).toEqual({ name: "peek_account_deletion", args: { p_user: USER, p_token_hash: hashDeletionToken("T".repeat(43)) } })
    h.answers.peek_account_deletion = null
    expect(await peekDeletionLink(USER, "T".repeat(43))).toBeNull()
  })

  it("puts the day of the deletion 30 days after now and answers it as a date", async () => {
    h.answers.confirm_account_deletion = "2026-12-09T12:00:00Z"
    const day = await confirmDeletion(USER, "T".repeat(43), NOW)
    expect(day).toEqual(new Date("2026-12-09T12:00:00.000Z"))
    expect(h.calls).toEqual([{ name: "confirm_account_deletion", args: { p_user: USER, p_token_hash: hashDeletionToken("T".repeat(43)), p_scheduled: "2026-12-09T12:00:00.000Z" } }])
  })

  it("answers null for a link that is not the one awaited, has expired or was used", async () => {
    h.answers.confirm_account_deletion = null
    expect(await confirmDeletion(USER, "T".repeat(43), NOW)).toBeNull()
  })
})

describe("keeping an account", () => {
  it("asks the database to take the row and the mark away, and says whether there was something to take", async () => {
    h.answers.cancel_account_deletion = true
    expect(await keepAccount(USER)).toBe(true)
    h.answers.cancel_account_deletion = false
    expect(await keepAccount(USER)).toBe(false)
    expect(h.calls[0]).toEqual({ name: "cancel_account_deletion", args: { p_user: USER } })
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

  it("waits for the day when it is told to: the database deletes only an account on hold whose day has passed by then", async () => {
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

describe("the accounts that are due, and the links that are dead", () => {
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

  it("counts or deletes the links that stopped working, and counts none when the database answers nothing", async () => {
    h.answers.purge_deletion_links = 4
    expect(await purgeDeletionLinks(NOW, true)).toBe(4)
    expect(h.calls[0]).toEqual({ name: "purge_deletion_links", args: { p_before: "2026-11-09T12:00:00.000Z", p_dry: true } })
    h.answers.purge_deletion_links = null
    expect(await purgeDeletionLinks(NOW, false)).toBe(0)
  })
})

describe("the functions of migration 0011", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0011_account_deletion.sql", import.meta.url), "utf8")
  const source = readFileSync(new URL("./account-deletion.ts", import.meta.url), "utf8")
  const signature = (name: string) => sql.match(new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`))?.[1]

  it("hold every function this module calls, with the parameters it passes", () => {
    const expected: Record<string, string[]> = {
      request_account_deletion: ["p_user", "p_token_hash", "p_expires"],
      peek_account_deletion: ["p_user", "p_token_hash"],
      confirm_account_deletion: ["p_user", "p_token_hash", "p_scheduled"],
      cancel_account_deletion: ["p_user"],
      erase_account: ["p_user", "p_due_before"],
      due_account_deletions: ["p_before", "p_limit"],
      purge_deletion_links: ["p_before", "p_dry"],
    }
    const called = [...source.matchAll(/call<[^(]*>\(\s*"([a-z_]+)"/g)].map((match) => match[1]!)
    expect([...new Set(called)].sort()).toEqual(Object.keys(expected).sort())
    for (const [name, parameters] of Object.entries(expected)) {
      const found = signature(name)
      expect(found, name).toBeDefined()
      for (const parameter of parameters) expect(found, `${name}(${parameter})`).toContain(parameter)
    }
  })

  it("write the mark under the key the accounts read, and the words that the pages of a table read", () => {
    expect(sql).toContain(`'${DELETION_KEY}'`)
    expect(sql).toContain(`'${DELETED_PLAYER}'`)
    expect(sql).toContain(`'YYYY-MM-DD"T"HH24:MI:SS"Z"'`)
  })

  it("are all closed to the public roles and open to the service role, the trigger apart", () => {
    const functions = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map((match) => match[1]!)
    expect(functions.length).toBe(9)
    for (const name of functions) expect(sql, name).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`))
    for (const name of functions.filter((name) => name !== "erase_member_from_tables")) expect(sql, name).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role`))
  })
})
