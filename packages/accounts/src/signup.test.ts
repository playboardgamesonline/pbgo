import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { accountOf } from "./account"
import {
  CODE_LENGTH,
  DISPLAY_NAME_KEY,
  DISPLAY_NAME_MAX,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  RESEND_SECONDS,
  checkSignup,
  cleanDisplayName,
  codeMessage,
  failureKind,
  failureOf,
  resendOutcome,
  secondsLeft,
  signupData,
  signupOutcome,
} from "./signup"

const fields = { email: "ana@example.com", password: "correct horse", name: "" }

/** The problems of an entry that is refused. */
function problemsOf(overrides: Partial<typeof fields>) {
  const result = checkSignup({ ...fields, ...overrides })
  if (result.ok) throw new Error("the entry was accepted")
  return result.problems
}

describe("what the form asks", () => {
  it("is an address, a password of 8 characters at least, and a display name that may be left empty", () => {
    expect(PASSWORD_MIN).toBe(8)
    expect(DISPLAY_NAME_MAX).toBe(20)
    expect(CODE_LENGTH).toBe(6)
    expect(RESEND_SECONDS).toBe(60)
  })
})

describe("checkSignup", () => {
  it("accepts an address and a password, with no display name", () => {
    expect(checkSignup(fields)).toEqual({ ok: true, entry: { email: "ana@example.com", password: "correct horse", name: null } })
  })

  it("trims the address and cleans the display name, and keeps the password as it was typed", () => {
    const result = checkSignup({ email: "  ana@example.com ", password: " a password with spaces ", name: "  Ana \t  Maria \n" })
    expect(result).toEqual({ ok: true, entry: { email: "ana@example.com", password: " a password with spaces ", name: "Ana Maria" } })
  })

  it("asks for the address, and for one that looks like an address", () => {
    expect(problemsOf({ email: "" }).email).toBe("Enter your e-mail address.")
    expect(problemsOf({ email: "   " }).email).toBe("Enter your e-mail address.")
    for (const email of ["ana", "ana@", "@example.com", "ana@example", "ana example@example.com", "ana@@example.com"]) {
      expect(problemsOf({ email }).email, email).toBe("That does not look like an e-mail address.")
    }
  })

  it("asks for a password of 8 characters at least, counted as a person counts them", () => {
    expect(problemsOf({ password: "" }).password).toBe("Choose a password.")
    expect(problemsOf({ password: "1234567" }).password).toBe("Use at least 8 characters.")
    expect(checkSignup({ ...fields, password: "12345678" }).ok).toBe(true)
    // Eight emoji are eight characters, and 32 bytes
    expect(checkSignup({ ...fields, password: "🎲".repeat(8) }).ok).toBe(true)
    expect(problemsOf({ password: "🎲".repeat(7) }).password).toBe("Use at least 8 characters.")
  })

  it("refuses a password that bcrypt would cut after 72 bytes, so that the part it would drop is not a password the visitor believes in", () => {
    expect(PASSWORD_MAX_BYTES).toBe(72)
    expect(checkSignup({ ...fields, password: "a".repeat(72) }).ok).toBe(true)
    expect(problemsOf({ password: "a".repeat(73) }).password).toBe("Use a shorter password: 72 characters at most.")
    // 18 emoji are 72 bytes, 19 are 76
    expect(checkSignup({ ...fields, password: "🎲".repeat(18) }).ok).toBe(true)
    expect(problemsOf({ password: "🎲".repeat(19) }).password).toBe("Use a shorter password: 72 characters at most.")
  })

  it("sets no rule on what a password is made of", () => {
    for (const password of ["aaaaaaaa", "12345678", "ALLUPPERCASE", "correct horse battery staple", "pässwörd-éàü"]) {
      expect(checkSignup({ ...fields, password }).ok, password).toBe(true)
    }
  })

  it("keeps a display name of 20 characters at most, an emoji counting one", () => {
    expect(checkSignup({ ...fields, name: "x".repeat(20) }).ok).toBe(true)
    expect(checkSignup({ ...fields, name: "🎲".repeat(20) }).ok).toBe(true)
    expect(problemsOf({ name: "x".repeat(21) }).name).toBe("Use 20 characters at most.")
    expect(problemsOf({ name: "🎲".repeat(21) }).name).toBe("Use 20 characters at most.")
  })

  it("judges the name as it is kept: the spaces around it and between its words do not count", () => {
    expect(checkSignup({ ...fields, name: ` ${"x".repeat(20)} ` }).ok).toBe(true)
    expect(checkSignup({ ...fields, name: "   " })).toEqual({ ok: true, entry: { email: "ana@example.com", password: "correct horse", name: null } })
  })

  it("tells every problem at once, not the first", () => {
    expect(problemsOf({ email: "ana", password: "short", name: "x".repeat(21) })).toEqual({
      email: "That does not look like an e-mail address.",
      password: "Use at least 8 characters.",
      name: "Use 20 characters at most.",
    })
  })
})

describe("cleanDisplayName", () => {
  it("drops control characters, trims and puts one space between words", () => {
    expect(cleanDisplayName("  Oré\u0000 \u0007Louvel  ")).toBe("Oré Louvel")
    expect(cleanDisplayName("a\n\n b")).toBe("a b")
    expect(cleanDisplayName("")).toBe("")
  })
})

describe("the display name of an account", () => {
  it("is kept under the key that accountOf reads for the nickname, so that nothing else has to know the account was made here", () => {
    expect(DISPLAY_NAME_KEY).toBe("full_name")
    const user = { id: "u-1", email: "ana.maria@example.com", app_metadata: { provider: "email" }, user_metadata: signupData("Ana Maria") }
    expect(accountOf(user).nickname).toBe("Ana Maria")
  })

  it("is nothing at all when none was given, and the nickname is then the start of the address", () => {
    expect(signupData(null)).toBeUndefined()
    const user = { id: "u-2", email: "ana.maria@example.com", app_metadata: { provider: "email" }, user_metadata: signupData(null) }
    expect(accountOf(user).nickname).toBe("ana.maria")
  })
})

describe("failureOf", () => {
  it("reads what an error of Supabase says of itself", () => {
    expect(failureOf(new AuthApiError("Too many", 429, "over_email_send_rate_limit"))).toEqual({ code: "over_email_send_rate_limit", status: 429, name: "AuthApiError" })
    expect(failureOf(new AuthWeakPasswordError("weak", 422, ["pwned", "length"]))).toMatchObject({ reasons: ["pwned", "length"], status: 422 })
  })

  it("reads nothing from what is not an error, and takes nothing for granted", () => {
    expect(failureOf(null)).toEqual({})
    expect(failureOf(undefined)).toEqual({})
    expect(failureOf("boom")).toEqual({})
    expect(failureOf({ code: 42, status: "500", name: {}, reasons: "pwned" })).toEqual({})
    expect(failureOf({ reasons: ["pwned", 3, null] })).toEqual({ reasons: ["pwned"] })
  })
})

describe("failureKind", () => {
  const api = (code: string, status = 400) => new AuthApiError("message", status, code)

  it.each([
    ["weak_password", "weak-password"],
    ["email_address_invalid", "invalid-email"],
    ["email_address_not_authorized", "unavailable"],
    ["unexpected_failure", "unavailable"],
    ["request_timeout", "unavailable"],
    ["hook_timeout", "unavailable"],
    ["over_email_send_rate_limit", "rate-limit"],
    ["over_request_rate_limit", "rate-limit"],
    ["signup_disabled", "closed"],
    ["email_provider_disabled", "closed"],
    ["captcha_failed", "captcha"],
    ["user_already_exists", "taken"],
    ["email_exists", "taken"],
    ["otp_expired", "wrong-code"],
    ["validation_failed", "other"],
    ["bad_json", "other"],
    ["a_code_nobody_has_heard_of", "other"],
  ])("takes %s for %s", (code, kind) => {
    expect(failureKind(api(code))).toBe(kind)
  })

  it("takes a request that never reached the server for the network's, and a server in trouble for the server's", () => {
    expect(failureKind(new AuthRetryableFetchError("Failed to fetch", 0))).toBe("network")
    expect(failureKind(new AuthRetryableFetchError("Service unavailable", 503))).toBe("unavailable")
    expect(failureKind(new AuthApiError("boom", 500, undefined))).toBe("unavailable")
  })

  it("takes anything else for another failure", () => {
    expect(failureKind(new Error("boom"))).toBe("other")
    expect(failureKind(undefined)).toBe("other")
    expect(failureKind(new AuthApiError("bad request", 400, undefined))).toBe("other")
  })
})

describe("signupOutcome", () => {
  const api = (code: string, status = 400) => new AuthApiError("message", status, code)

  it("is a success when Supabase answered no error: the e-mail is on its way", () => {
    expect(signupOutcome(null)).toEqual({ sent: true })
    expect(signupOutcome(undefined)).toEqual({ sent: true })
  })

  it("reveals nothing of an address that has an account: it is a success too", () => {
    expect(signupOutcome(api("user_already_exists", 422))).toEqual({ sent: true })
    expect(signupOutcome(api("email_exists", 422))).toEqual({ sent: true })
  })

  it("tells a weak password on the password, by the reasons the project gives", () => {
    expect(signupOutcome(new AuthWeakPasswordError("weak", 422, ["pwned"]))).toEqual({
      sent: false,
      message: "That password is known from data breaches. Choose another one.",
      field: "password",
    })
    expect(signupOutcome(new AuthWeakPasswordError("weak", 422, ["characters"]))).toMatchObject({ message: "Mix letters, digits and symbols in your password.", field: "password" })
    expect(signupOutcome(new AuthWeakPasswordError("weak", 422, ["length"]))).toMatchObject({ message: "Choose a longer password.", field: "password" })
    expect(signupOutcome(api("weak_password", 422))).toMatchObject({ message: "Choose a longer password.", field: "password" })
  })

  it("tells an address that cannot be used on the address", () => {
    expect(signupOutcome(api("email_address_invalid"))).toEqual({ sent: false, message: "That e-mail address cannot be used. Check it, or use another one.", field: "email" })
  })

  it("says calmly and in general that the e-mail could not go out, whatever the sender's reason: an address it refuses (the built-in sender only reaches the team's), or a server in trouble", () => {
    const message = "We could not send the e-mail. Try again in a few minutes."
    expect(signupOutcome(api("email_address_not_authorized"))).toEqual({ sent: false, message })
    expect(signupOutcome(api("unexpected_failure", 500))).toEqual({ sent: false, message })
    expect(signupOutcome(new AuthRetryableFetchError("Bad gateway", 502))).toEqual({ sent: false, message })
  })

  it("asks to wait when there were too many e-mails or requests, without a number of minutes it cannot know", () => {
    const message = "Too many attempts. Wait a few minutes and try again."
    expect(signupOutcome(api("over_email_send_rate_limit", 429))).toEqual({ sent: false, message })
    expect(signupOutcome(api("over_request_rate_limit", 429))).toEqual({ sent: false, message })
  })

  it("says when sign-ups are closed, when the CAPTCHA was not passed and when the browser is offline", () => {
    expect(signupOutcome(api("signup_disabled", 422))).toMatchObject({ message: "Creating an account is not available right now. Try again later." })
    expect(signupOutcome(api("email_provider_disabled", 422))).toMatchObject({ message: "Creating an account is not available right now. Try again later." })
    expect(signupOutcome(api("captcha_failed"))).toMatchObject({ message: "We could not check that you are a person. Try again." })
    expect(signupOutcome(new AuthRetryableFetchError("Failed to fetch", 0))).toMatchObject({ message: "We could not reach the server. Check your connection and try again." })
  })

  it("says that it did not work for anything else, and nothing of why", () => {
    expect(signupOutcome(api("validation_failed", 422))).toEqual({ sent: false, message: "Sign-up did not work. Try again." })
    expect(signupOutcome(new Error("a stack trace the visitor must not read"))).toEqual({ sent: false, message: "Sign-up did not work. Try again." })
  })

  it("never puts what Supabase says in a sentence for the visitor", () => {
    const outcome = signupOutcome(new AuthApiError("Email sending is not allowed for this address as your project is using the default SMTP service", 400, "email_address_not_authorized"))
    expect(JSON.stringify(outcome)).not.toContain("SMTP")
    expect(JSON.stringify(outcome)).not.toContain("project")
  })
})

describe("codeMessage", () => {
  it("says a code that does not work is wrong or expired, since Supabase Auth does not tell the two apart", () => {
    expect(codeMessage(new AuthApiError("Token has expired or is invalid", 403, "otp_expired"))).toBe("That code is wrong or has expired. Check it, or ask for a new one.")
  })

  it("asks to wait when there were too many attempts, and says when the browser is offline", () => {
    expect(codeMessage(new AuthApiError("Too many", 429, "over_request_rate_limit"))).toBe("Too many attempts. Wait a few minutes and try again.")
    expect(codeMessage(new AuthRetryableFetchError("Failed to fetch", 0))).toBe("We could not reach the server. Check your connection and try again.")
  })

  it("says that it did not work for anything else", () => {
    expect(codeMessage(new AuthApiError("boom", 500, "unexpected_failure"))).toBe("That code did not work. Try again.")
    expect(codeMessage(new Error("boom"))).toBe("That code did not work. Try again.")
  })
})

describe("resendOutcome", () => {
  it("is sent when Supabase answered no error", () => {
    expect(resendOutcome(null)).toEqual({ status: "sent" })
  })

  it("makes the visitor wait when an e-mail went out a minute ago, and tells them so", () => {
    expect(resendOutcome(new AuthApiError("For security purposes, you can only request this after 49 seconds", 429, "over_email_send_rate_limit"))).toEqual({
      status: "wait",
      message: "Wait a minute before asking for another code.",
    })
  })

  it("lets the visitor try again at once when it failed for another reason", () => {
    expect(resendOutcome(new AuthApiError("boom", 500, "unexpected_failure"))).toEqual({ status: "failed", message: "We could not send the e-mail. Try again in a few minutes." })
    expect(resendOutcome(new AuthRetryableFetchError("Failed to fetch", 0))).toEqual({ status: "failed", message: "We could not reach the server. Check your connection and try again." })
    expect(resendOutcome(new AuthApiError("captcha", 400, "captcha_failed"))).toEqual({ status: "failed", message: "We could not check that you are a person. Try again." })
    expect(resendOutcome(new Error("boom"))).toEqual({ status: "failed", message: "We could not send a new code. Try again." })
  })
})

describe("secondsLeft", () => {
  it("counts the seconds until a time, rounded up, and stops at 0", () => {
    expect(secondsLeft(61_000, 1_000)).toBe(60)
    expect(secondsLeft(61_000, 1_001)).toBe(60)
    expect(secondsLeft(61_000, 60_999)).toBe(1)
    expect(secondsLeft(61_000, 61_000)).toBe(0)
    expect(secondsLeft(61_000, 90_000)).toBe(0)
  })
})
