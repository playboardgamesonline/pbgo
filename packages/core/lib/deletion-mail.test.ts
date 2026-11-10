import { describe, expect, it } from "vitest"
import { composeDeletionMail, escapeHtml } from "./deletion-mail"

const site = { siteName: "Play Board Games Online", contact: "hey@playboardgamesonline.app", from: "Play Board Games Online <no-reply@mail.playboardgamesonline.app>" }
const LINK = "https://playboardgamesonline.app/auth/reopen-account?u=3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b&t=" + "A".repeat(43)
const UNTIL = "16 November 2026"
const mail = (name = "Marly") => composeDeletionMail(site, { to: "marly@example.com", name, link: LINK, until: UNTIL })

describe("the e-mail that a member gets when they delete their account", () => {
  it("goes from the sender of the site to the address of the account, and replies reach the contact address", () => {
    expect(mail()).toMatchObject({ from: site.from, to: "marly@example.com", replyTo: site.contact, subject: "Your Play Board Games Online account is closed" })
  })

  it("holds the link in the words, and three times in the page: the button, and the line under it that says it and links to it", () => {
    const { text, html } = mail()
    expect(text).toContain(LINK)
    expect(html.split(escapeHtml(LINK))).toHaveLength(4)
    expect(html).toContain(`<a href="${escapeHtml(LINK)}"`)
    expect(html).toContain("Reopen my account")
  })

  it("says the account is closed, the 7 days and the day the link works until, what is deleted for good after that, and what stays", () => {
    for (const body of [mail().text, mail().html]) {
      expect(body).toContain("It is closed and you are signed out everywhere")
      expect(body).toContain("You have 7 days to change your mind")
      expect(body).toContain("It works until 16 November 2026")
      expect(body).toContain("deleted for good")
      expect(body).toContain("with your profile, your totals and your ranks")
      expect(body).toContain("without your name or your picture")
    }
  })

  it("tells a member who did not delete their account to take it back, and says nothing of a subscription", () => {
    for (const body of [mail().text, mail().html]) {
      expect(body).toContain("If it was not you, open the link to get your account back, then change your password.")
      expect(body.toLowerCase()).not.toContain("subscription")
      expect(body.toLowerCase()).not.toContain("automated")
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

  it("does not trust the link, the day or the contact address either: they are escaped", () => {
    const odd = composeDeletionMail({ ...site, contact: 'a"b@example.com' }, { to: "marly@example.com", name: "Marly", link: 'https://playboardgamesonline.app/x?a=1&b="2"', until: "<b>soon</b>" })
    expect(odd.html).toContain('href="https://playboardgamesonline.app/x?a=1&amp;b=&quot;2&quot;"')
    expect(odd.html).toContain('href="mailto:a&quot;b@example.com"')
    expect(odd.html).toContain("It works until &lt;b&gt;soon&lt;/b&gt;")
    expect(odd.html).not.toContain("<b>soon</b>")
  })

  it("is a whole page with a text alternative, in English", () => {
    const { html, text } = mail()
    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html).toContain('<html lang="en">')
    expect(text.length).toBeGreaterThan(200)
  })
})
