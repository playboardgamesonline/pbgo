import { describe, expect, it } from "vitest"
import { composeDeletionMail, escapeHtml } from "./deletion-mail"

const site = { siteName: "Play Board Games Online", contact: "hey@playboardgamesonline.app", from: "Play Board Games Online <no-reply@mail.playboardgamesonline.app>" }
const LINK = "https://playboardgamesonline.app/auth/delete-account?u=3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b&t=" + "A".repeat(43)
const mail = (name = "Marly") => composeDeletionMail(site, { to: "marly@example.com", name, link: LINK })

describe("the e-mail of the link that confirms the deletion of an account", () => {
  it("goes from the sender of the site to the address of the account, and replies reach the contact address", () => {
    expect(mail()).toMatchObject({ from: site.from, to: "marly@example.com", replyTo: site.contact, subject: "Confirm the deletion of your Play Board Games Online account" })
  })

  it("holds the link in the words, and three times in the page: the button, and the line under it that says it and links to it", () => {
    const { text, html } = mail()
    expect(text).toContain(LINK)
    expect(html.split(escapeHtml(LINK))).toHaveLength(4)
    expect(html).toContain(`<a href="${escapeHtml(LINK)}"`)
    expect(html).toContain("Confirm the deletion")
  })

  it("says what happens next with the numbers the Privacy Policy states: a link for an hour that works once, 30 days, signed out, keeping it by signing in", () => {
    for (const body of [mail().text, mail().html]) {
      expect(body).toContain("for 1 hour")
      expect(body).toContain("kept for 30 days")
      expect(body).toContain("signed out everywhere")
      expect(body).toContain("sign in again")
      expect(body).toContain("deleted for good")
      expect(body).toContain("without your name or your picture")
      expect(body).toContain("ignore this e-mail: nothing will happen")
    }
  })

  it("greets the member by the name the others read, cut at 20 characters, and plainly when there is none", () => {
    expect(mail("Marly").text.startsWith("Hi Marly,")).toBe(true)
    expect(mail("  ").text.startsWith("Hi,")).toBe(true)
    expect(mail("A very long nickname indeed, it goes on").text.startsWith("Hi A very long nickname,")).toBe(true)
  })

  it("writes a name as text and never as markup: it comes from a provider or from the member", () => {
    const html = mail(`<img src=x>"&`).html
    expect(html).not.toContain("<img")
    expect(html).toContain("Hi &lt;img src=x&gt;&quot;&amp;,")
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;")
  })

  it("does not trust the link or the contact address either: they are escaped in the attributes", () => {
    const odd = composeDeletionMail({ ...site, contact: 'a"b@example.com' }, { to: "marly@example.com", name: "Marly", link: 'https://playboardgamesonline.app/x?a=1&b="2"' })
    expect(odd.html).toContain('href="https://playboardgamesonline.app/x?a=1&amp;b=&quot;2&quot;"')
    expect(odd.html).toContain('href="mailto:a&quot;b@example.com"')
  })

  it("is a whole page with a text alternative, in English", () => {
    const { html, text } = mail()
    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html).toContain('<html lang="en">')
    expect(text.length).toBeGreaterThan(200)
  })
})
