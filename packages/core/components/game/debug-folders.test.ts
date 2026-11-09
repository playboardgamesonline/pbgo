import { afterEach, describe, expect, it, vi } from "vitest"
import { getDebugFolders, registerDebugFolder, subscribeDebugFolders } from "./debug-folders"

const schema = () => ({})
const taken: (() => void)[] = []
const register = (...args: Parameters<typeof registerDebugFolder>) => {
  const off = registerDebugFolder(...args)
  taken.push(off)
  return off
}

afterEach(() => {
  vi.unstubAllEnvs()
  taken.splice(0).forEach((off) => off())
})

describe("the folders asked for", () => {
  it("fills in the place and the collapse, and keeps the deps the schema was made for", () => {
    register({ folder: "Layout", tab: "SCENE", schema }, [1, 2])
    const [folder] = getDebugFolders()
    expect(folder).toMatchObject({ folder: "Layout", tab: "SCENE", order: 0, closed: true, deps: [1, 2] })
  })

  it("keeps the place and the collapse that are given", () => {
    register({ folder: "Camera", tab: "SCENE", order: 3, closed: false, schema })
    expect(getDebugFolders()[0]).toMatchObject({ order: 3, closed: false })
  })

  it("keeps two folders of one name apart: each adds its inputs to the one folder", () => {
    register({ folder: "Share Photo", tab: "SCENE", schema })
    register({ folder: "Share Photo", tab: "SCENE", schema })
    const folders = getDebugFolders()
    expect(folders).toHaveLength(2)
    expect(folders[0].id).not.toBe(folders[1].id)
  })

  it("takes back only the folder that asked to go", () => {
    const first = register({ folder: "A", tab: "SCENE", schema })
    register({ folder: "B", tab: "GAME", schema })
    first()
    expect(getDebugFolders().map((f) => f.folder)).toEqual(["B"])
  })

  it("answers with another list each time it changes, and not otherwise", () => {
    const before = getDebugFolders()
    expect(getDebugFolders()).toBe(before)
    register({ folder: "A", tab: "SCENE", schema })
    expect(getDebugFolders()).not.toBe(before)
  })

  it("tells whoever listens, and stops when they stop", () => {
    const heard = vi.fn()
    const stop = subscribeDebugFolders(heard)
    const off = register({ folder: "A", tab: "SCENE", schema })
    off()
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
    register({ folder: "B", tab: "SCENE", schema })
    expect(heard).toHaveBeenCalledTimes(2)
  })
})

describe("on the production deployment", () => {
  it("writes nothing down, and has nothing to take back", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production")
    const heard = vi.fn()
    const stop = subscribeDebugFolders(heard)
    const before = getDebugFolders()
    const off = registerDebugFolder({ folder: "Layout", tab: "SCENE", schema })
    off()
    stop()
    expect(getDebugFolders()).toBe(before)
    expect(heard).not.toHaveBeenCalled()
  })
})
