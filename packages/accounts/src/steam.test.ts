import { describe, expect, it, vi } from "vitest"
import {
  NONCE_MAX_AGE_MS,
  STATE_PATTERN,
  STEAM_FALLBACK_NAME,
  STEAM_LOGIN_URL,
  assertionOf,
  checkAssertion,
  fetchSteamProfile,
  isValidVerification,
  newState,
  nonceTime,
  sameSecret,
  steamConfirms,
  steamLoginUrl,
  steamProfileOf,
  steamReturnTo,
  verificationParams,
} from "./steam"

const ORIGIN = "https://playboardgamesonline.app"
const STATE = "AbCdEfGhIjKlMnOpQrStUv"
const RETURN_TO = steamReturnTo(ORIGIN, { next: "/games", state: STATE })
const NOW = Date.parse("2026-11-09T10:00:30Z")

/** What Steam sends back to the callback after a visitor logs in: the shape of its real answer, with made-up values. */
const assertion = (): Record<string, string> => ({
  "openid.ns": "http://specs.openid.net/auth/2.0",
  "openid.mode": "id_res",
  "openid.op_endpoint": "https://steamcommunity.com/openid/login",
  "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198000000000",
  "openid.identity": "https://steamcommunity.com/openid/id/76561198000000000",
  "openid.return_to": RETURN_TO,
  "openid.response_nonce": "2026-11-09T10:00:12ZAbCdEfGhIjKlMnOpQrStUvWxYz=",
  "openid.assoc_handle": "1234567890",
  "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
  "openid.sig": "c2lnbmF0dXJl",
})

describe("the state", () => {
  it("is 128 random bits in base64url, and never the same twice", () => {
    const states = new Set(Array.from({ length: 50 }, newState))
    expect(states.size).toBe(50)
    for (const state of states) expect(state).toMatch(STATE_PATTERN)
  })

  it("is compared in full, and a different length is a different secret", () => {
    expect(sameSecret(STATE, STATE)).toBe(true)
    expect(sameSecret(STATE, "AbCdEfGhIjKlMnOpQrStUw")).toBe(false)
    expect(sameSecret(STATE, STATE.slice(1))).toBe(false)
    expect(sameSecret("", "")).toBe(true)
  })
})

describe("the way there", () => {
  it("comes back to this site's callback with the page to go on to and the state, both in what Steam signs", () => {
    expect(RETURN_TO).toBe(`https://playboardgamesonline.app/auth/steam/callback?next=%2Fgames&state=${STATE}`)
    expect(steamReturnTo("http://localhost:3100", { next: "/game/hanabi?x=1&y=2", state: STATE })).toBe(
      `http://localhost:3100/auth/steam/callback?next=%2Fgame%2Fhanabi%3Fx%3D1%26y%3D2&state=${STATE}`,
    )
  })

  it("says that it is a link when the member who is signed in links the account, and inside what Steam signs, so that a way back cannot pass for the other kind", () => {
    const next = "/me/settings/account"
    expect(steamReturnTo(ORIGIN, { next, state: STATE, link: true })).toBe(`${ORIGIN}/auth/steam/callback?next=%2Fme%2Fsettings%2Faccount&state=${STATE}&link=1`)
    expect(steamReturnTo(ORIGIN, { next, state: STATE, link: false })).not.toContain("link")
    const forSignIn = steamReturnTo(ORIGIN, { next, state: STATE })
    const forLink = steamReturnTo(ORIGIN, { next, state: STATE, link: true })
    // The callback builds the address again from what it is given and Steam's signed `return_to` has to be the same: turning `link` on or off on the way makes the two differ
    expect(checkAssertion({ ...assertion(), "openid.return_to": forSignIn }, { returnTo: forLink, now: NOW })).toEqual({ ok: false, problem: "return-to" })
    expect(checkAssertion({ ...assertion(), "openid.return_to": forLink }, { returnTo: forSignIn, now: NOW })).toEqual({ ok: false, problem: "return-to" })
    expect(checkAssertion({ ...assertion(), "openid.return_to": forLink }, { returnTo: forLink, now: NOW })).toEqual({ ok: true, steamId: "76561198000000000" })
  })

  it("asks Steam's login for no account in particular, and says where to answer and for which site", () => {
    const url = new URL(steamLoginUrl({ returnTo: RETURN_TO, realm: ORIGIN }))
    expect(`${url.origin}${url.pathname}`).toBe(STEAM_LOGIN_URL)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": RETURN_TO,
      "openid.realm": ORIGIN,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    })
  })
})

describe("assertionOf", () => {
  it("keeps the OpenID fields and nothing else", () => {
    const params = new URLSearchParams({ next: "/games", state: STATE, ...assertion() })
    expect(assertionOf(params)).toEqual(assertion())
  })

  it("is null when there is none", () => {
    expect(assertionOf(new URLSearchParams({ next: "/games", state: STATE }))).toBeNull()
    expect(assertionOf(new URLSearchParams())).toBeNull()
  })
})

describe("nonceTime", () => {
  it("reads the time the nonce starts with", () => {
    expect(nonceTime("2026-11-09T10:00:12ZAbCd")).toBe(Date.parse("2026-11-09T10:00:12Z"))
  })

  it("is null for anything else", () => {
    for (const nonce of [undefined, "", "abc", "2026-11-09 10:00:12ZAbCd", "2026-13-45T10:00:12Z", "2026-11-09T10:00:12AbCd"]) expect(nonceTime(nonce), String(nonce)).toBeNull()
  })
})

describe("checkAssertion", () => {
  it("accepts Steam's answer for this site and takes the SteamID64 out of the claimed identifier", () => {
    expect(checkAssertion(assertion(), { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: true, steamId: "76561198000000000" })
  })

  it("refuses an answer from another protocol or another kind of message", () => {
    expect(checkAssertion({ ...assertion(), "openid.ns": "http://openid.net/signon/1.1" }, { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: false, problem: "namespace" })
    for (const mode of ["cancel", "setup_needed", "error", "checkid_setup", ""]) {
      expect(checkAssertion({ ...assertion(), "openid.mode": mode }, { returnTo: RETURN_TO, now: NOW }), mode).toEqual({ ok: false, problem: "mode" })
    }
  })

  it("refuses an answer that does not come from Steam's own endpoint", () => {
    for (const endpoint of ["https://evil.example/openid/login", "http://steamcommunity.com/openid/login", "https://steamcommunity.com.evil.example/openid/login", ""]) {
      expect(checkAssertion({ ...assertion(), "openid.op_endpoint": endpoint }, { returnTo: RETURN_TO, now: NOW }), endpoint).toEqual({ ok: false, problem: "endpoint" })
    }
  })

  it("refuses an answer that was meant for another address, another page or another state", () => {
    for (const returnTo of [
      "https://evil.example/auth/steam/callback?next=%2Fgames&state=" + STATE,
      steamReturnTo(ORIGIN, { next: "/me", state: STATE }),
      steamReturnTo(ORIGIN, { next: "/games", state: "AbCdEfGhIjKlMnOpQrStUw" }),
    ]) {
      expect(checkAssertion({ ...assertion(), "openid.return_to": returnTo }, { returnTo: RETURN_TO, now: NOW }), returnTo).toEqual({ ok: false, problem: "return-to" })
    }
  })

  it("refuses an identifier that is not a SteamID64 of Steam's community", () => {
    for (const claimed of [
      "https://steamcommunity.com/openid/id/123",
      "https://steamcommunity.com/openid/id/765611980000000001",
      "https://steamcommunity.com/openid/id/7656119800000000a",
      "https://evil.example/openid/id/76561198000000000",
      "http://steamcommunity.com/openid/id/76561198000000000",
      "https://steamcommunity.com/openid/id/76561198000000000/extra",
      "https://steamcommunity.com/openid/id/76561198000000000?x=1",
      "http://specs.openid.net/auth/2.0/identifier_select",
      "",
    ]) {
      expect(checkAssertion({ ...assertion(), "openid.claimed_id": claimed, "openid.identity": claimed }, { returnTo: RETURN_TO, now: NOW }), claimed).toEqual({ ok: false, problem: "claimed-id" })
    }
  })

  it("refuses an answer whose identity is not its claimed identifier", () => {
    expect(checkAssertion({ ...assertion(), "openid.identity": "https://steamcommunity.com/openid/id/76561198000000001" }, { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: false, problem: "identity" })
  })

  it("refuses an answer whose signature does not cover what matters, or that has none", () => {
    for (const field of ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"]) {
      const signed = assertion()["openid.signed"]!.split(",").filter((name) => name !== field).join(",")
      expect(checkAssertion({ ...assertion(), "openid.signed": signed }, { returnTo: RETURN_TO, now: NOW }), field).toEqual({ ok: false, problem: "unsigned" })
    }
    const { "openid.sig": _sig, ...withoutSignature } = assertion()
    expect(checkAssertion(withoutSignature, { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: false, problem: "unsigned" })
    const { "openid.signed": _signed, ...withoutList } = assertion()
    expect(checkAssertion(withoutList, { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: false, problem: "unsigned" })
  })

  it("refuses an answer that is too old, or from the future, or that has no time", () => {
    const at = (offset: number) => ({ ...assertion(), "openid.response_nonce": new Date(NOW + offset).toISOString().replace(/\.\d+Z$/, "Z") + "xyz" })
    expect(checkAssertion(at(-NONCE_MAX_AGE_MS), { returnTo: RETURN_TO, now: NOW }).ok).toBe(true)
    expect(checkAssertion(at(NONCE_MAX_AGE_MS), { returnTo: RETURN_TO, now: NOW }).ok).toBe(true)
    expect(checkAssertion(at(-NONCE_MAX_AGE_MS - 1000), { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: false, problem: "nonce" })
    expect(checkAssertion(at(NONCE_MAX_AGE_MS + 1000), { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: false, problem: "nonce" })
    expect(checkAssertion({ ...assertion(), "openid.response_nonce": "nonsense" }, { returnTo: RETURN_TO, now: NOW })).toEqual({ ok: false, problem: "nonce" })
  })
})

describe("the question for Steam", () => {
  it("is the answer it gave with the mode changed, and nothing added", () => {
    const params = verificationParams(assertion())
    expect(params.get("openid.mode")).toBe("check_authentication")
    const rest = Object.fromEntries(params)
    delete rest["openid.mode"]
    const { "openid.mode": _mode, ...original } = assertion()
    expect(rest).toEqual(original)
  })

  it("is confirmed by the namespace and a single `is_valid:true`, in OpenID's key-value form", () => {
    expect(isValidVerification("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n")).toBe(true)
    expect(isValidVerification("ns:http://specs.openid.net/auth/2.0\r\nis_valid:true\r\n")).toBe(true)
    expect(isValidVerification("ns:http://specs.openid.net/auth/2.0\nis_valid:true")).toBe(true)
    expect(isValidVerification("ns:http://specs.openid.net/auth/2.0\nis_valid:true\ninvalidate_handle:1234")).toBe(true)
  })

  it("is not confirmed by anything else: a no (what Steam says of a forged assertion), a body that holds a yes among other things, a key twice, a line that is not a pair", () => {
    for (const body of [
      "ns:http://specs.openid.net/auth/2.0\nis_valid:false\n",
      "",
      "<html>Error</html>",
      "is_valid:true\nis_valid:false",
      "xis_valid:true",
      "is_valid: true",
      "is_valid:true",
      "error:x\nis_valid:true",
      "ns:http://specs.openid.net/auth/2.0\nis_valid:true\nis_valid:true",
      "ns:http://specs.openid.net/auth/2.0\nis_valid:false\nis_valid:true",
      "ns:http://specs.openid.net/auth/2.0\nnot a pair\nis_valid:true",
      "ns:http://specs.openid.net/auth/1.1\nis_valid:true",
    ]) {
      expect(isValidVerification(body), body).toBe(false)
    }
  })
})

describe("steamProfileOf", () => {
  const answer = (player: Record<string, unknown> | null) => ({ response: { players: player ? [player] : [] } })

  it("keeps the name and the large picture", () => {
    expect(steamProfileOf(answer({ personaname: " Marly ", avatarfull: "https://avatars.steamstatic.com/abc_full.jpg", avatar: "https://avatars.steamstatic.com/abc.jpg" }))).toEqual({
      name: "Marly",
      avatarUrl: "https://avatars.steamstatic.com/abc_full.jpg",
    })
    expect(steamProfileOf(answer({ personaname: "M", avatarfull: "https://avatars.akamai.steamstatic.com/abc_full.jpg" }))?.avatarUrl).toBe("https://avatars.akamai.steamstatic.com/abc_full.jpg")
    expect(steamProfileOf(answer({ personaname: "M", avatarfull: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/abc_full.jpg" }))?.avatarUrl).toContain("akamaihd.net")
  })

  it("keeps no picture that is not on Steam's own hosts or not on https", () => {
    for (const avatarfull of ["https://evil.example/a.jpg", "http://avatars.steamstatic.com/a.jpg", "https://steamstatic.com.evil.example/a.jpg", "javascript:alert(1)", "not an address", 3, null]) {
      expect(steamProfileOf(answer({ personaname: "M", avatarfull }))?.avatarUrl, String(avatarfull)).toBeNull()
    }
  })

  it("takes out what a name may not hold: control characters (a NUL would be refused by the database) and the bidirectional overrides, which would turn the names around it", () => {
    expect(steamProfileOf(answer({ personaname: "Marly\u0000 the\u0007 Brave" }))?.name).toBe("Marly the Brave")
    expect(steamProfileOf(answer({ personaname: "\u202Eevil\u2066x\u2069" }))?.name).toBe("evilx")
    expect(steamProfileOf(answer({ personaname: "\u202E\u0000 \u2067" }))?.name).toBe(STEAM_FALLBACK_NAME)
    // a name is cleaned before it is cut
    expect(steamProfileOf(answer({ personaname: `${"\u0000".repeat(50)}${"x".repeat(10)}` }))?.name).toBe("x".repeat(10))
  })

  it("keeps what makes a name a name: accents, emoji, and the joiner of an emoji sequence", () => {
    expect(steamProfileOf(answer({ personaname: "Oré  👨\u200D👩\u200D👧 Louvel" }))?.name).toBe("Oré 👨\u200D👩\u200D👧 Louvel")
  })

  it("cuts a long name and falls back on a name for a profile that has none", () => {
    expect(steamProfileOf(answer({ personaname: "x".repeat(100) }))?.name).toHaveLength(40)
    for (const personaname of ["", "   ", undefined, 5]) expect(steamProfileOf(answer({ personaname }))?.name, String(personaname)).toBe(STEAM_FALLBACK_NAME)
  })

  it("is null when Steam has no player to show, or answers something else", () => {
    for (const nothing of [answer(null), { response: {} }, {}, null, "html", 42]) expect(steamProfileOf(nothing)).toBeNull()
  })
})

/** A fetch that answers with `body`, and remembers how it was asked. */
function answering(body: string, init: ResponseInit = { status: 200 }) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, init))
}

describe("steamConfirms", () => {
  it("posts what Steam signed back to its endpoint, with the mode changed, and is confirmed by a yes", async () => {
    const fetcher = answering("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n")
    await expect(steamConfirms(assertion(), fetcher)).resolves.toBe(true)
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe(STEAM_LOGIN_URL)
    expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", headers: { "Content-Type": "application/x-www-form-urlencoded" } })
    expect((init?.body as URLSearchParams).get("openid.mode")).toBe("check_authentication")
    expect((init?.body as URLSearchParams).get("openid.claimed_id")).toBe(assertion()["openid.claimed_id"])
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("is not confirmed by a no, an error, a page that is not an answer, or Steam down", async () => {
    expect(await steamConfirms(assertion(), answering("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n"))).toBe(false)
    expect(await steamConfirms(assertion(), answering("is_valid:true\n", { status: 500 }))).toBe(false)
    expect(await steamConfirms(assertion(), answering("<html>Maintenance</html>"))).toBe(false)
    expect(await steamConfirms(assertion(), vi.fn(async () => Promise.reject(new Error("down"))))).toBe(false)
  })
})

describe("fetchSteamProfile", () => {
  const players = JSON.stringify({ response: { players: [{ personaname: "Marly", avatarfull: "https://avatars.steamstatic.com/abc_full.jpg" }] } })

  it("asks the Web API for the player with the key, and keeps nothing of the answer", async () => {
    const fetcher = answering(players)
    await expect(fetchSteamProfile("76561198000000000", "KEY", fetcher)).resolves.toEqual({ name: "Marly", avatarUrl: "https://avatars.steamstatic.com/abc_full.jpg" })
    const [url, init] = fetcher.mock.calls[0]!
    expect(String(url)).toBe("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=KEY&steamids=76561198000000000")
    expect(init).toMatchObject({ cache: "no-store" })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("is null when Steam refuses (a wrong key), does not answer, or answers something else", async () => {
    expect(await fetchSteamProfile("76561198000000000", "BAD", answering("Forbidden", { status: 403 }))).toBeNull()
    expect(await fetchSteamProfile("76561198000000000", "KEY", answering("not json"))).toBeNull()
    expect(await fetchSteamProfile("76561198000000000", "KEY", answering(JSON.stringify({ response: { players: [] } })))).toBeNull()
    expect(await fetchSteamProfile("76561198000000000", "KEY", vi.fn(async () => Promise.reject(new Error("down"))))).toBeNull()
  })
})
