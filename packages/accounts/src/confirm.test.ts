import { describe, expect, it, vi } from "vitest"
import { CONFIRM_TYPES, confirmEmail, confirmEmailSession, confirmFailedPath, confirmNext, confirmRequestOf } from "./confirm"

const ORIGIN = "https://playboardgamesonline.app"
const HASH = "5d0f2c8e1a7b49e3a6c4f1b2d9e8a7c6b5a4f3e2d1c0b9a8f7e6d5c4"

/** The query of a link, as the route reads it. */
const link = (query: string) => new URL(`${ORIGIN}/auth/confirm?${query}`).searchParams

describe("confirmRequestOf", () => {
  it("reads the link the template of the e-mail writes", () => {
    expect(confirmRequestOf(link(`token_hash=${HASH}&type=email`))).toEqual({ tokenHash: HASH, type: "email" })
  })

  it("reads the same confirmation under its older name", () => {
    expect(confirmRequestOf(link(`token_hash=${HASH}&type=signup`))).toEqual({ tokenHash: HASH, type: "signup" })
    expect([...CONFIRM_TYPES]).toEqual(["email", "signup"])
  })

  it("reads a token with the prefix of the PKCE flow", () => {
    expect(confirmRequestOf(link(`token_hash=pkce_${HASH}&type=email`))).toEqual({ tokenHash: `pkce_${HASH}`, type: "email" })
  })

  it.each(["recovery", "invite", "magiclink", "email_change", "sms", "", "EMAIL", "email ", "signup,recovery"])(
    "does not spend a link of the kind %j: it is not a sign-up's, and would sign a visitor in on a page that does not know why",
    (type) => {
      expect(confirmRequestOf(link(`token_hash=${HASH}&type=${encodeURIComponent(type)}`))).toBeNull()
    },
  )

  it("needs the kind and the token", () => {
    expect(confirmRequestOf(link(`type=email`))).toBeNull()
    expect(confirmRequestOf(link(`token_hash=${HASH}`))).toBeNull()
    expect(confirmRequestOf(link(``))).toBeNull()
  })

  it.each(["", "short", "has a space in it 0123456789", "semi;colon;0123456789abcdef", "../../etc/passwd/0123456789", "a".repeat(257), "<script>alert(1)</script>"])(
    "does not send a value that is not the shape of a hashed token to Supabase (%j)",
    (hash) => {
      expect(confirmRequestOf(link(`token_hash=${encodeURIComponent(hash)}&type=email`))).toBeNull()
    },
  )
})

describe("confirmNext", () => {
  it("goes to a path of this site", () => {
    expect(confirmNext("/games", ORIGIN)).toBe("/games")
    expect(confirmNext("/game/courtisans?x=1#rules", ORIGIN)).toBe("/game/courtisans?x=1#rules")
  })

  it("goes to the visitor's own page when the link says nothing", () => {
    expect(confirmNext(null, ORIGIN)).toBe("/me")
    expect(confirmNext("", ORIGIN)).toBe("/me")
  })

  it("takes the path of an address of this site, which is what the e-mail writes with {{ .RedirectTo }}", () => {
    expect(confirmNext(`${ORIGIN}/game/courtisans`, ORIGIN)).toBe("/game/courtisans")
    expect(confirmNext(`${ORIGIN}/games?category=Cards&players=5#top`, ORIGIN)).toBe("/games?category=Cards&players=5#top")
    expect(confirmNext(`${ORIGIN}/`, ORIGIN)).toBe("/")
    expect(confirmNext(ORIGIN, ORIGIN)).toBe("/")
    expect(confirmNext("http://localhost:3150/games", "http://localhost:3150")).toBe("/games")
  })

  it.each([
    "https://evil.example/me",
    "http://evil.example",
    "https://playboardgamesonline.app.evil.example/games",
    "https://evil.example/https://playboardgamesonline.app",
    "http://playboardgamesonline.app/games",
    "//evil.example/me",
    "///evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "https://",
    "https://[not a host]/",
    "evil.example",
  ])("sends nobody anywhere else, signed in (%j)", (value) => {
    expect(confirmNext(value, ORIGIN)).toBe("/me")
  })

  it("keeps a path on this site even when the address has a login in front of its host, which is still this host", () => {
    expect(confirmNext(`https://evil.example@playboardgamesonline.app/games`, ORIGIN)).toBe("/games")
  })

  it("does not go back to the sign-in's own way, or to the sign-up's", () => {
    for (const value of ["/login", "/signup", "/signup?error=confirm", "/auth/confirm?token_hash=x", `${ORIGIN}/signup`, `${ORIGIN}/login?next=/me`]) {
      expect(confirmNext(value, ORIGIN), value).toBe("/me")
    }
  })
})

describe("confirmFailedPath", () => {
  it("leads to the sign-up, which says the link did not work, with the way back kept", () => {
    expect(confirmFailedPath("/me")).toBe("/signup?error=confirm&next=%2Fme")
    expect(confirmFailedPath("/games?category=Cards&players=5")).toBe("/signup?error=confirm&next=%2Fgames%3Fcategory%3DCards%26players%3D5")
  })

  it("holds no token", () => {
    expect(confirmFailedPath("/me")).not.toContain("token")
  })
})

describe("confirmEmail", () => {
  const request = { tokenHash: HASH, type: "email" as const }
  const verifier = (answer: { data: { user: unknown; session: unknown }; error: unknown } | Error) => {
    const verifyOtp = vi.fn(async () => {
      if (answer instanceof Error) throw answer
      return answer
    })
    return { client: { auth: { verifyOtp } }, verifyOtp }
  }

  it("spends the token and says the address is confirmed", async () => {
    const { client, verifyOtp } = verifier({ data: { user: { id: "u-1" }, session: { access_token: "t" } }, error: null })
    expect(await confirmEmail(client, request)).toBe(true)
    // The token hash and the kind of link, and no address: the link alone proves it
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: HASH, type: "email" })
  })

  it("passes on the kind of link it was given", async () => {
    const { client, verifyOtp } = verifier({ data: { user: { id: "u-1" }, session: {} }, error: null })
    await confirmEmail(client, { tokenHash: HASH, type: "signup" })
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: HASH, type: "signup" })
  })

  it("says it did not work when Supabase refuses the token: it expired, was spent already, or was altered", async () => {
    const { client } = verifier({ data: { user: null, session: null }, error: { code: "otp_expired", message: "Email link is invalid or has expired" } })
    expect(await confirmEmail(client, request)).toBe(false)
  })

  it("says it did not work when there is no session to sign the visitor in with, even without an error", async () => {
    expect(await confirmEmail(verifier({ data: { user: { id: "u-1" }, session: null }, error: null }).client, request)).toBe(false)
    expect(await confirmEmail(verifier({ data: { user: null, session: {} }, error: null }).client, request)).toBe(false)
  })

  it("never throws, whatever the Auth server does: a link that did not work is all the visitor hears", async () => {
    expect(await confirmEmail(verifier(new Error("fetch failed")).client, request)).toBe(false)
  })
})

describe("confirmEmailSession", () => {
  const request = { tokenHash: HASH, type: "email" as const }
  const verifier = (answer: { data: { user: unknown; session: unknown }; error: unknown } | Error) => ({
    auth: {
      verifyOtp: vi.fn(async () => {
        if (answer instanceof Error) throw answer
        return answer
      }),
    },
  })

  it("gives the access token of the session the link made, which the route needs to tell whether the second step is still to pass", async () => {
    expect(await confirmEmailSession(verifier({ data: { user: { id: "u-1" }, session: { access_token: "the-token" } }, error: null }), request)).toEqual({ accessToken: "the-token" })
  })

  it("gives no token when the session holds none that is text, and still says the link worked", async () => {
    expect(await confirmEmailSession(verifier({ data: { user: { id: "u-1" }, session: {} }, error: null }), request)).toEqual({ accessToken: null })
    expect(await confirmEmailSession(verifier({ data: { user: { id: "u-1" }, session: { access_token: 42 } }, error: null }), request)).toEqual({ accessToken: null })
  })

  it("is null when the link did not work, for whatever reason, and never throws", async () => {
    expect(await confirmEmailSession(verifier({ data: { user: null, session: null }, error: { code: "otp_expired" } }), request)).toBeNull()
    expect(await confirmEmailSession(verifier({ data: { user: { id: "u-1" }, session: null }, error: null }), request)).toBeNull()
    expect(await confirmEmailSession(verifier(new Error("fetch failed")), request)).toBeNull()
  })
})
