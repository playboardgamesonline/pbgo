import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { gameCardArt, gameCover } from "./cover"

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "fr" }))
vi.mock("./client", () => ({ sanityClient: (game: { sanityProjectId: string }) => (/^[a-z0-9]{8}$/.test(game.sanityProjectId) ? { fetch: fetchMock } : null) }))

const game = { slug: "courtisans", sanityProjectId: "2lo2f5sv" }
const hero = { asset: { _type: "reference", _ref: "image-0123456789abcdef0123456789abcdef01234567-1400x2000-webp" } }
const logo = { asset: { _type: "reference", _ref: "image-1111111111111111111111111111111111111111-1471x614-png" } }
const background = { asset: { _type: "reference", _ref: "image-2222222222222222222222222222222222222222-2400x1600-webp" } }

describe("gameCover", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("is the hero of the published interface, resized and served by the game's own Sanity project", async () => {
    fetchMock.mockResolvedValue(hero)
    const cover = await gameCover(game)
    expect(cover).toEqual(expect.any(String))
    const url = new URL(cover as string)
    expect(url.hostname).toBe("cdn.sanity.io")
    expect(url.pathname).toMatch(/^\/images\/2lo2f5sv\/[a-z0-9_-]+\/0123456789abcdef0123456789abcdef01234567-1400x2000\.webp$/)
    expect(url.searchParams.get("w")).toBe("800")
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('_id == "interface"'), {}, { next: { tags: ["courtisans:skin"], revalidate: 60 } })
  })

  it("takes the width it is asked for", async () => {
    fetchMock.mockResolvedValue(hero)
    expect(new URL((await gameCover(game, 400)) as string).searchParams.get("w")).toBe("400")
  })

  it("is null for a game with no Sanity project, without asking anyone", async () => {
    expect(await gameCover({ slug: "new-game", sanityProjectId: "__SANITY_PROJECT_ID__" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is null until the interface has a hero", async () => {
    fetchMock.mockResolvedValueOnce(null)
    expect(await gameCover(game)).toBeNull()
    fetchMock.mockResolvedValueOnce({})
    expect(await gameCover(game)).toBeNull()
  })

  it("is null, and says why, when Sanity cannot be reached", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const down = new Error("offline")
    fetchMock.mockRejectedValue(down)
    expect(await gameCover(game)).toBeNull()
    expect(error).toHaveBeenCalledWith("Sanity cover unavailable", "courtisans", down)
  })
})

describe("gameCardArt", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("is the logo of the published settings and the background of the published interface, resized and served by the game's own Sanity project", async () => {
    fetchMock.mockResolvedValue({ logo, background })
    const art = await gameCardArt(game)
    const logoUrl = new URL(art.logo as string)
    expect(logoUrl.hostname).toBe("cdn.sanity.io")
    expect(logoUrl.pathname).toMatch(/^\/images\/2lo2f5sv\/[a-z0-9_-]+\/1111111111111111111111111111111111111111-1471x614\.png$/)
    expect(logoUrl.searchParams.get("w")).toBe("800")
    const backgroundUrl = new URL(art.background as string)
    expect(backgroundUrl.hostname).toBe("cdn.sanity.io")
    expect(backgroundUrl.pathname).toMatch(/^\/images\/2lo2f5sv\/[a-z0-9_-]+\/2222222222222222222222222222222222222222-2400x1600\.webp$/)
    expect(backgroundUrl.searchParams.get("w")).toBe("800")
    // One request for both, tagged like the settings and the skin so that saving either refreshes the card
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('_id == "settings"'), {}, { next: { tags: ["courtisans:settings", "courtisans:skin"], revalidate: 60 } })
    expect(fetchMock.mock.calls[0][0]).toContain('_id == "interface"')
  })

  it("takes the width it is asked for", async () => {
    fetchMock.mockResolvedValue({ logo, background })
    const art = await gameCardArt(game, 400)
    expect(new URL(art.logo as string).searchParams.get("w")).toBe("400")
    expect(new URL(art.background as string).searchParams.get("w")).toBe("400")
  })

  it("has nothing for a game with no Sanity project, without asking anyone", async () => {
    expect(await gameCardArt({ slug: "new-game", sanityProjectId: "__SANITY_PROJECT_ID__" })).toEqual({ logo: null, background: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("has only the pictures the game has: a logo without a background, and nothing before the first upload", async () => {
    fetchMock.mockResolvedValueOnce({ logo, background: null })
    const art = await gameCardArt(game)
    expect(art.logo).toEqual(expect.any(String))
    expect(art.background).toBeNull()
    fetchMock.mockResolvedValueOnce({ logo: null, background: null })
    expect(await gameCardArt(game)).toEqual({ logo: null, background: null })
    fetchMock.mockResolvedValueOnce({ logo: {}, background: {} })
    expect(await gameCardArt(game)).toEqual({ logo: null, background: null })
    fetchMock.mockResolvedValueOnce(null)
    expect(await gameCardArt(game)).toEqual({ logo: null, background: null })
  })

  it("has nothing, and says why, when Sanity cannot be reached", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const down = new Error("offline")
    fetchMock.mockRejectedValue(down)
    expect(await gameCardArt(game)).toEqual({ logo: null, background: null })
    expect(error).toHaveBeenCalledWith("Sanity card art unavailable", "courtisans", down)
  })
})
