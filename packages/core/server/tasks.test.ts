import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const calls: Array<[string, ...unknown[]]> = []
  const result: { value: { data: unknown; error: unknown } } = { value: { data: null, error: null } }
  // The Supabase query builder: every method records its call and returns the builder, which resolves to `result` when awaited
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result.value).then(resolve, reject),
  }
  for (const method of ["from", "update", "delete", "eq", "select", "maybeSingle"]) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return query
    }
  }
  return { calls, result, query, requireAdmin: vi.fn(async (): Promise<void> => {}) }
})
vi.mock("server-only", () => ({}))
vi.mock("./admin", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("./supabase", () => ({ supabaseAdmin: () => mocks.query }))

import type { GamemasterRouteContext } from "../lib/binding"
import { DELETE, PATCH } from "../routes/gamemaster/tasks/[id]/route"
import { ApiError } from "./api"
import { isTaskId } from "./tasks"

const ID = "0b8f6f3e-5c1d-4a52-9d57-2f6c1d9a7e10"
const game = { slug: "skyjo" } as GamemasterRouteContext["game"]
const context = (id: string | undefined): GamemasterRouteContext => ({ game, params: id === undefined ? {} : { id } })
const patch = (body: unknown = { done: true }) => new Request("http://localhost/gamemaster/api/skyjo/tasks/x", { method: "PATCH", body: JSON.stringify(body) })
const remove = () => new Request("http://localhost/gamemaster/api/skyjo/tasks/x", { method: "DELETE" })

beforeEach(() => {
  mocks.calls.length = 0
  mocks.result.value = { data: null, error: null }
  mocks.requireAdmin.mockReset()
})

describe("isTaskId", () => {
  it("accepts the canonical uuid form, in either case", () => {
    expect(isTaskId(ID)).toBe(true)
    expect(isTaskId(ID.toUpperCase())).toBe(true)
  })

  it("refuses everything else, including the loose forms Postgres would still cast", () => {
    for (const value of ["", "not-a-uuid", "123", `${ID} `, `{${ID}}`, ID.replaceAll("-", ""), ID.slice(0, -1), `${ID}0`, `${ID}'; drop table tasks;--`, "g".repeat(36)]) {
      expect(isTaskId(value), JSON.stringify(value)).toBe(false)
    }
    expect(isTaskId(undefined)).toBe(false)
    expect(isTaskId(42)).toBe(false)
  })
})

describe("PATCH and DELETE /gamemaster/api/<slug>/tasks/<id>", () => {
  it("answers 404 TASK_NOT_FOUND to a malformed id without querying the database", async () => {
    for (const id of ["not-a-uuid", "123", "", undefined]) {
      for (const response of [await PATCH(patch(), context(id)), await DELETE(remove(), context(id))]) {
        expect(response.status, String(id)).toBe(404)
        expect(await response.json()).toEqual({ error: "TASK_NOT_FOUND" })
      }
    }
    expect(mocks.calls).toEqual([])
  })

  it("checks the admin session before anything else: a visitor gets 401 whatever the id", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiError("ACCESS_DENIED", 401))
    for (const response of [await PATCH(patch(), context("not-a-uuid")), await DELETE(remove(), context("not-a-uuid"))]) {
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: "ACCESS_DENIED" })
    }
    expect(mocks.calls).toEqual([])
  })

  it("updates the task of this game when the id is a uuid", async () => {
    mocks.result.value = { data: { id: ID, done: true }, error: null }
    const response = await PATCH(patch({ done: true }), context(ID))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: ID, done: true })
    expect(mocks.calls).toContainEqual(["eq", "game", "skyjo"])
    expect(mocks.calls).toContainEqual(["eq", "id", ID])
  })

  it("keeps answering 404 when a well-formed id matches no task", async () => {
    const response = await PATCH(patch(), context(ID))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "TASK_NOT_FOUND" })
  })

  it("deletes the task of this game when the id is a uuid", async () => {
    const response = await DELETE(remove(), context(ID))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.calls).toEqual([["from", "tasks"], ["delete"], ["eq", "game", "skyjo"], ["eq", "id", ID]])
  })
})
