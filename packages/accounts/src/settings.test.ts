import { describe, expect, it } from "vitest"
import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from "@supabase/supabase-js"
import { PASSWORD_MAX_BYTES } from "./signup"
import { ACCOUNT_SETTINGS_PATH, SETTINGS_MESSAGES, checkEmailChange, checkNickname, checkPasswordChange, describeDevice, deviceLabel, linkNoticeOf, nicknameCharactersLeft, settingsMessage, settingsProblem, unlinkProblem } from "./settings"
import { safeNext } from "./redirect"

describe("ACCOUNT_SETTINGS_PATH", () => {
  it("is a place that `safeNext` lets a member come back to", () => {
    expect(safeNext(ACCOUNT_SETTINGS_PATH)).toBe(ACCOUNT_SETTINGS_PATH)
  })
})

describe("checkNickname", () => {
  it("keeps a username cleaned like a display name", () => {
    expect(checkNickname("  Marly   74 ")).toEqual({ ok: true, nickname: "Marly 74" })
  })

  it("asks for one", () => {
    expect(checkNickname("")).toEqual({ ok: false, problem: "Enter a username." })
    expect(checkNickname("   \u0000 ")).toEqual({ ok: false, problem: "Enter a username." })
  })

  it("keeps it to 20 characters as a person counts them", () => {
    expect(checkNickname("a".repeat(20)).ok).toBe(true)
    expect(checkNickname("🎲".repeat(20)).ok).toBe(true)
    expect(checkNickname("a".repeat(21))).toEqual({ ok: false, problem: "Use 20 characters at most." })
  })
})

describe("nicknameCharactersLeft", () => {
  it("counts down from 20 as a person counts, an emoji being one character", () => {
    expect(nicknameCharactersLeft("")).toBe(20)
    expect(nicknameCharactersLeft("Marly")).toBe(15)
    expect(nicknameCharactersLeft("🎲".repeat(20))).toBe(0)
  })

  it("counts the name as it will be kept, so the blanks that are cleaned away are not counted", () => {
    expect(nicknameCharactersLeft("  Marly   74 ")).toBe(12)
    expect(nicknameCharactersLeft("a".repeat(20) + "   ")).toBe(0)
  })

  it("goes below zero exactly when the name is refused for its length", () => {
    for (const text of ["a".repeat(20), "a".repeat(21), "a".repeat(35), "🎲".repeat(21)]) {
      expect(nicknameCharactersLeft(text) < 0).toBe(!checkNickname(text).ok)
    }
  })
})

describe("checkEmailChange", () => {
  it("takes an address, trimmed", () => {
    expect(checkEmailChange("old@example.com", " new@example.com ")).toEqual({ ok: true, email: "new@example.com" })
    expect(checkEmailChange(null, "new@example.com")).toEqual({ ok: true, email: "new@example.com" })
  })

  it("asks for one, and refuses what is not an address", () => {
    expect(checkEmailChange(null, "  ")).toEqual({ ok: false, problem: "Enter your new e-mail address." })
    expect(checkEmailChange(null, "ore")).toEqual({ ok: false, problem: "That does not look like an e-mail address." })
  })

  it("refuses the address they already have, whatever its case", () => {
    expect(checkEmailChange("Ore@Example.com", "ore@example.com")).toEqual({ ok: false, problem: "That is the address you already have." })
  })
})

describe("checkPasswordChange", () => {
  it("takes two passwords that are the same and long enough", () => {
    expect(checkPasswordChange("a long enough password", "a long enough password")).toEqual({ ok: true })
  })

  it("asks for a password, of 8 characters at least", () => {
    expect(checkPasswordChange("", "")).toEqual({ ok: false, problems: { password: "Choose a password." } })
    expect(checkPasswordChange("short", "short")).toEqual({ ok: false, problems: { password: "Use at least 8 characters." } })
    expect(checkPasswordChange("12345678", "12345678")).toEqual({ ok: true })
  })

  it("refuses what bcrypt could not keep, counted in bytes", () => {
    const long = "é".repeat(PASSWORD_MAX_BYTES / 2 + 1)
    expect(checkPasswordChange(long, long)).toEqual({ ok: false, problems: { password: "Use a shorter password: 72 characters at most." } })
  })

  it("asks for the second field to be the same as the first, and says so once the first is right", () => {
    expect(checkPasswordChange("a long enough password", "another one")).toEqual({ ok: false, problems: { confirm: "The two passwords are not the same." } })
    expect(checkPasswordChange("short", "other")).toEqual({ ok: false, problems: { password: "Use at least 8 characters." } })
  })
})

describe("settingsProblem and settingsMessage", () => {
  const api = (code: string, status = 400) => new AuthApiError("message of Supabase", status, code)

  it.each([
    ["same_password", "same-password"],
    ["reauthentication_needed", "reauthenticate"],
    ["reauthentication_not_valid", "reauthenticate"],
    // A member with a second step who changes their password or address from a session that has not passed it (PLT-129)
    ["insufficient_aal", "reauthenticate"],
    ["manual_linking_disabled", "manual-linking"],
    ["single_identity_not_deletable", "last-service"],
    ["identity_already_exists", "service-taken"],
    ["weak_password", "weak-password"],
    ["email_address_invalid", "invalid-email"],
    ["over_email_send_rate_limit", "rate-limit"],
    ["over_request_rate_limit", "rate-limit"],
    ["email_address_not_authorized", "unavailable"],
    ["unexpected_failure", "unavailable"],
    ["something_new", "other"],
  ])("tells the code %s as %s", (code, problem) => {
    expect(settingsProblem(api(code))).toBe(problem)
  })

  it("never says that an address has an account: `email_exists` is an address that cannot be used", () => {
    expect(settingsProblem(api("email_exists", 422))).toBe("invalid-email")
    expect(settingsMessage(api("email_exists", 422))).not.toMatch(/already|registered|taken|exists/i)
  })

  it("tells the network that is down, a server that failed, and a weak password the project refused", () => {
    expect(settingsProblem(new AuthRetryableFetchError("Failed to fetch", 0))).toBe("network")
    expect(settingsProblem(api("anything", 503))).toBe("unavailable")
    expect(settingsProblem(new AuthWeakPasswordError("weak", 422, ["pwned"]))).toBe("weak-password")
  })

  it("tells nothing of what is not an error", () => {
    expect(settingsProblem(null)).toBe("other")
    expect(settingsProblem("boom")).toBe("other")
    expect(settingsProblem({})).toBe("other")
  })

  it("has a sentence for every problem, none of them Supabase's own", () => {
    expect(Object.keys(SETTINGS_MESSAGES).length).toBe(12)
    for (const message of Object.values(SETTINGS_MESSAGES)) expect(message).not.toMatch(/supabase|auth|identity|session|token|jwt/i)
  })
})

describe("what the way back of a Steam link says", () => {
  it("reads the `?steam=` of the settings: done, or the sentence of why not, in the words the settings already use", () => {
    expect(linkNoticeOf("linked")).toEqual({ done: true })
    expect(linkNoticeOf("taken")).toEqual({ done: false, message: SETTINGS_MESSAGES["service-taken"] })
    expect(linkNoticeOf("has-another")).toEqual({ done: false, message: SETTINGS_MESSAGES["has-another"] })
    expect(linkNoticeOf("failed")).toEqual({ done: false, message: SETTINGS_MESSAGES.other })
  })

  it("has nothing to say about anything else, so that a made-up address shows no sentence of its own", () => {
    for (const value of [undefined, null, "", "LINKED", "linked ", "<b>hi</b>", "Your account was deleted", "constructor", "__proto__"]) expect(linkNoticeOf(value), String(value)).toBeNull()
  })
})

describe("what the answer of an unlink comes to", () => {
  it("is that nobody is signed in, that the last way in stays, that there were too many requests, or that it did not work", () => {
    expect(unlinkProblem("NOT_SIGNED_IN")).toBe("no-session")
    expect(unlinkProblem("LAST_WAY_IN")).toBe("last-service")
    expect(unlinkProblem("RATE_LIMITED")).toBe("rate-limit")
    expect(unlinkProblem("TOO_MANY_REQUESTS")).toBe("rate-limit")
    for (const code of ["UNLINK_FAILED", "SERVER_ERROR", "FORBIDDEN", "INVALID_REQUEST", "", undefined, null, 42, {}]) expect(unlinkProblem(code), String(code)).toBe("other")
  })
})

describe("describeDevice and deviceLabel", () => {
  const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
  const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
  const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
  const EDGE_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"
  const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0"
  const OPERA_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0"
  const CHROMEBOOK = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

  it.each([
    [CHROME_MAC, "Chrome on macOS"],
    [SAFARI_MAC, "Safari on macOS"],
    [SAFARI_IPHONE, "Safari on iOS"],
    [CHROME_ANDROID, "Chrome on Android"],
    [EDGE_WINDOWS, "Edge on Windows"],
    [FIREFOX_LINUX, "Firefox on Linux"],
    [OPERA_WINDOWS, "Opera on Windows"],
    [CHROMEBOOK, "Chrome on ChromeOS"],
  ])("names %s", (userAgent, label) => {
    expect(deviceLabel(describeDevice(userAgent))).toBe(label)
  })

  it("names what it does not know as a browser, and leaves the system out", () => {
    expect(describeDevice("")).toEqual({ browser: "Browser", system: null })
    expect(deviceLabel(describeDevice("curl/8.0"))).toBe("Browser")
  })
})
