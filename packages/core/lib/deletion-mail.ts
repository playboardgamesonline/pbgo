import { ACCOUNT_DELETION_GRACE_DAYS } from "./retention"

// The e-mail that a member gets when they delete their account (PLT-36): it says the account is closed, gives the link that reopens it with the day it stops working, what is deleted for good after that and what stays, and what to do if it was
// not them. Pure, so that the words are tested; the site's own name, contact address and sender come from the app (`apps/web/src/lib/deletion-mail.ts`), and `server/mail.ts` sends it.

/** An e-mail, ready to be sent. */
export type MailMessage = { from: string; to: string; subject: string; text: string; html: string; replyTo?: string }

/** What the e-mail says of the site that sends it. `from` is the sender, `Name <address>`, on the domain the mail provider verified. */
export type DeletionMailSite = { siteName: string; contact: string; from: string }

/** Who it goes to, how they are greeted, the link, whose token only this e-mail holds (`reopenLink` of `@pbgo/accounts`), and the day it works until, as the page says it (`deletionDate`: `16 November 2026`). */
export type DeletionMailInput = { to: string; name: string; link: string; until: string }

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

/** Text for the inside of an HTML element or of a quoted attribute. */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => entities[character]!)

const days = (count: number) => `${count} day${count === 1 ? "" : "s"}`

/** How the member is greeted: their name as the others read it (20 characters at most), else nothing. */
const greeting = (name: string) => {
  const trimmed = Array.from(name.trim()).slice(0, 20).join("")
  return trimmed ? `Hi ${trimmed},` : "Hi,"
}

/**
 * The e-mail of the link. It says the account is closed, gives the button and the link with the day it works until, then what is deleted for good after that and what stays, and what to do if it was not the member. The colours are written
 * out because a mail client does not know the site's tokens.
 */
export function composeDeletionMail(site: DeletionMailSite, input: DeletionMailInput): MailMessage {
  const grace = days(ACCOUNT_DELETION_GRACE_DAYS)
  const hello = greeting(input.name)
  const subject = `Your ${site.siteName} account is closed`
  const closed = `You deleted your ${site.siteName} account. It is closed and you are signed out everywhere.`
  const chance = `You have ${grace} to change your mind. To reopen your account, open this link. It works until ${input.until}`
  const after = "After that your account is deleted for good, with your profile, your totals and your ranks. The games you played stay, without your name or your picture."
  const notYou = "If it was not you, open the link to get your account back, then change your password."

  const text = [hello, "", closed, "", `${chance}:`, "", input.link, "", after, "", notYou, "", `Questions? Write to ${site.contact}.`].join("\n")

  const link = escapeHtml(input.link)
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;line-height:1.5">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">Your account is closed</h1>
      <p style="margin:0 0 16px">${escapeHtml(hello)}</p>
      <p style="margin:0 0 16px">${escapeHtml(closed)}</p>
      <p style="margin:0 0 24px">${escapeHtml(chance)}.</p>
      <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Reopen my account</a></p>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b">The button does not work? Copy this link into your browser:<br><a href="${link}" style="color:#52525b;word-break:break-all">${link}</a></p>
      <p style="margin:0 0 16px;font-size:14px">${escapeHtml(after)}</p>
      <p style="margin:0 0 16px;font-size:14px">${escapeHtml(notYou)}</p>
      <p style="margin:0;font-size:14px;color:#52525b">Questions? Write to <a href="mailto:${escapeHtml(site.contact)}" style="color:#52525b">${escapeHtml(site.contact)}</a>.</p>
    </div>
  </body>
</html>`

  return { from: site.from, to: input.to, subject, text, html, replyTo: site.contact }
}
