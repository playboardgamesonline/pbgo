import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ select: vi.fn(), inFilter: vi.fn(), from: vi.fn(), rpc: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }))

import { readBirthdate, readBirthdates, saveBirthdate } from "./birthdate"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const BOB = "5c3e1d8a-1f2b-4c47-8a9e-6d0b7e2f4a90"

beforeEach(() => {
  mocks.select.mockReset()
  mocks.inFilter.mockReset()
  mocks.from.mockReset()
  mocks.rpc.mockReset()
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ in: mocks.inFilter })
})

describe("readBirthdates", () => {
  it("reads the dates of these accounts from the server-only table, by account", async () => {
    mocks.inFilter.mockResolvedValue({
      data: [
        { user_id: ANN, birthdate: "1990-04-02" },
        { user_id: BOB, birthdate: "2008-11-09" },
      ],
      error: null,
    })
    const dates = await readBirthdates([ANN, BOB])
    expect(mocks.from).toHaveBeenCalledWith("member_birthdates")
    expect(mocks.select).toHaveBeenCalledWith("user_id, birthdate")
    expect(mocks.inFilter).toHaveBeenCalledWith("user_id", [ANN, BOB])
    expect(dates.get(ANN)).toBe("1990-04-02")
    expect(dates.get(BOB)).toBe("2008-11-09")
  })

  it("leaves out an account that declared none", async () => {
    mocks.inFilter.mockResolvedValue({ data: [{ user_id: ANN, birthdate: "1990-04-02" }], error: null })
    const dates = await readBirthdates([ANN, BOB])
    expect(dates.has(BOB)).toBe(false)
  })

  it("asks once for an account that is listed twice", async () => {
    mocks.inFilter.mockResolvedValue({ data: [], error: null })
    await readBirthdates([ANN, ANN, BOB, ANN])
    expect(mocks.inFilter).toHaveBeenCalledWith("user_id", [ANN, BOB])
  })

  it("does not ask the database about nobody", async () => {
    expect((await readBirthdates([])).size).toBe(0)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("throws what the database says: a check of the age that cannot read the dates lets nobody through", async () => {
    const error = new Error('relation "public.member_birthdates" does not exist')
    mocks.inFilter.mockResolvedValue({ data: null, error })
    await expect(readBirthdates([ANN])).rejects.toBe(error)
  })
})

describe("readBirthdate", () => {
  it("is the date of one account, or null when it declared none", async () => {
    mocks.inFilter.mockResolvedValue({ data: [{ user_id: ANN, birthdate: "1990-04-02" }], error: null })
    expect(await readBirthdate(ANN)).toBe("1990-04-02")
    mocks.inFilter.mockResolvedValue({ data: [], error: null })
    expect(await readBirthdate(ANN)).toBeNull()
  })
})

describe("saveBirthdate", () => {
  it("asks the database to keep the date, once: true when it is kept", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect(await saveBirthdate(ANN, "1990-04-02")).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith("set_member_birthdate", { p_user: ANN, p_birthdate: "1990-04-02" })
  })

  it("is false when the account has a date already, which the database never replaces", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect(await saveBirthdate(ANN, "1980-01-01")).toBe(false)
  })

  it("throws what the database says", async () => {
    const error = new Error("function public.set_member_birthdate(uuid, date) does not exist")
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(saveBirthdate(ANN, "1990-04-02")).rejects.toBe(error)
  })
})
