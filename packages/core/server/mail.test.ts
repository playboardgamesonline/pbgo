import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import type { MailMessage } from "../lib/deletion-mail"
import { mailAvailable, sendMail } from "./mail"

const message: MailMessage = {
  from: "Play Board Games Online <no-reply@mail.playboardgamesonline.app>",
  to: "marly@example.com",
  subject: "Your account is closed",
  text: "Open https://playboardgamesonline.app/auth/reopen-account?u=1&t=2",
  html: "<p>Open</p>",
  replyTo: "hey@playboardgamesonline.app",
}
const logger = () => ({ info: vi.fn(), error: vi.fn() })

describe("sendMail", () => {
  it("posts the message to Resend with the key of the app, and says it was sent", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: "49a3999c" }), { status: 200 }))
    const result = await sendMail(message, { fetcher: fetcher as unknown as typeof fetch, env: { RESEND_API_KEY: "  re_test_key  ", NODE_ENV: "production" }, log: logger() })
    expect(result).toBe("sent")
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.resend.com/emails")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ Authorization: "Bearer re_test_key", "Content-Type": "application/json", "User-Agent": "pbgo-web" })
    expect(JSON.parse(init.body as string)).toEqual({ from: message.from, to: [message.to], subject: message.subject, html: message.html, text: message.text, reply_to: message.replyTo })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it("leaves out the reply address when there is none", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }))
    await sendMail({ ...message, replyTo: undefined }, { fetcher: fetcher as unknown as typeof fetch, env: { RESEND_API_KEY: "re_k" }, log: logger() })
    expect(JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).not.toHaveProperty("reply_to")
  })

  it("says it failed when Resend refuses, and logs the status and nothing of the message", async () => {
    const log = logger()
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ name: "validation_error", message: "The to field is wrong: marly@example.com" }), { status: 422 }))
    expect(await sendMail(message, { fetcher: fetcher as unknown as typeof fetch, env: { RESEND_API_KEY: "re_k", NODE_ENV: "production" }, log })).toBe("failed")
    expect(log.error).toHaveBeenCalledWith("Mail refused: Resend answered 422")
    expect(JSON.stringify([log.info.mock.calls, log.error.mock.calls])).not.toContain("marly@example.com")
  })

  it("says it failed when Resend does not answer, and logs the kind of error and nothing else", async () => {
    const log = logger()
    const fetcher = vi.fn(async () => {
      throw new DOMException("The operation timed out marly@example.com", "TimeoutError")
    })
    expect(await sendMail(message, { fetcher: fetcher as unknown as typeof fetch, env: { RESEND_API_KEY: "re_k" }, log })).toBe("failed")
    expect(log.error).toHaveBeenCalledWith("Mail not sent: TimeoutError")
  })

  it("sends nothing and prints nothing in production when there is no key", async () => {
    const log = logger()
    const fetcher = vi.fn()
    expect(await sendMail(message, { fetcher: fetcher as unknown as typeof fetch, env: { NODE_ENV: "production" }, log })).toBe("unavailable")
    expect(await sendMail(message, { fetcher: fetcher as unknown as typeof fetch, env: { NODE_ENV: "production", RESEND_API_KEY: "   " }, log })).toBe("unavailable")
    expect(fetcher).not.toHaveBeenCalled()
    expect(log.info).not.toHaveBeenCalled()
    expect(log.error).not.toHaveBeenCalled()
  })

  it("prints the e-mail on a development server with no key, so that the flow can be tried without sending anything", async () => {
    const log = logger()
    const fetcher = vi.fn()
    expect(await sendMail(message, { fetcher: fetcher as unknown as typeof fetch, env: { NODE_ENV: "development" }, log })).toBe("logged")
    expect(fetcher).not.toHaveBeenCalled()
    const printed = String(log.info.mock.calls[0]?.[0])
    expect(printed).toContain("RESEND_API_KEY is not set")
    expect(printed).toContain(`To: ${message.to}`)
    expect(printed).toContain(message.text)
  })
})

describe("mailAvailable", () => {
  it("is true with a key, or on a development server that prints the e-mail, and false in production without a key", () => {
    expect(mailAvailable({ RESEND_API_KEY: "re_k", NODE_ENV: "production" })).toBe(true)
    expect(mailAvailable({ NODE_ENV: "development" })).toBe(true)
    expect(mailAvailable({})).toBe(true)
    expect(mailAvailable({ NODE_ENV: "production" })).toBe(false)
    expect(mailAvailable({ NODE_ENV: "production", RESEND_API_KEY: "  " })).toBe(false)
  })
})
