import { ACCOUNT_DELETION_GRACE_DAYS, ACCOUNT_DELETION_LINK_MINUTES } from "./retention"

// The e-mail that asks a member to confirm the deletion of their account (PLT-36): a button and the same link in words, the way the account is kept and then deleted, and what to do if it was not them. Pure, so that the words are
// tested; the site's own name, contact address and sender come from the app (`apps/web/src/lib/deletion-mail.ts`), and `server/mail.ts` sends it.

/** An e-mail, ready to be sent. */
export type MailMessage = { from: string; to: string; subject: string; text: string; html: string; replyTo?: string }

/** What the e-mail says of the site that sends it. `from` is the sender, `Name <address>`, on the domain the mail provider verified. */
export type DeletionMailSite = { siteName: string; contact: string; from: string }

/** Who it goes to, how they are greeted and the link, whose token only this e-mail holds (`deletionLink` of `@pbgo/accounts`). */
export type DeletionMailInput = { to: string; name: string; link: string }

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

/** Text for the inside of an HTML element or of a quoted attribute. */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => entities[character]!)

const days = (count: number) => `${count} day${count === 1 ? "" : "s"}`
const minutes = (count: number) => (count % 60 === 0 ? `${count / 60} hour${count === 60 ? "" : "s"}` : `${count} minutes`)

/** How the member is greeted: their name as the others read it (20 characters at most), else nothing. */
const greeting = (name: string) => {
  const trimmed = Array.from(name.trim()).slice(0, 20).join("")
  return trimmed ? `Hi ${trimmed},` : "Hi,"
}

/**
 * The e-mail of the link. It says what the member asked, gives the button and the link, then what happens (kept for `ACCOUNT_DELETION_GRACE_DAYS` days, the way to keep it, what is deleted and what stays) and that nothing happens
 * if they did not ask. The colours are written out because a mail client does not know the site's tokens.
 */
export function composeDeletionMail(site: DeletionMailSite, input: DeletionMailInput): MailMessage {
  const grace = days(ACCOUNT_DELETION_GRACE_DAYS)
  const valid = minutes(ACCOUNT_DELETION_LINK_MINUTES)
  const hello = greeting(input.name)
  const subject = `Confirm the deletion of your ${site.siteName} account`

  const text = [
    hello,
    "",
    `You asked to delete your ${site.siteName} account. To confirm, open this link. It works once, for ${valid}:`,
    "",
    input.link,
    "",
    `What happens next: your account is kept for ${grace}, signed out everywhere. If you sign in again during that time, you can keep it. After that it is deleted for good, with your profile, your totals and your ranks. The games you played stay, without your name or your picture.`,
    "",
    "If you did not ask for this, ignore this e-mail: nothing will happen.",
    "",
    `Questions? Write to ${site.contact}.`,
  ].join("\n")

  const link = escapeHtml(input.link)
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;line-height:1.5">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">Confirm the deletion of your account</h1>
      <p style="margin:0 0 16px">${escapeHtml(hello)}</p>
      <p style="margin:0 0 24px">You asked to delete your ${escapeHtml(site.siteName)} account. To confirm, press the button. It works once, for ${valid}.</p>
      <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Confirm the deletion</a></p>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b">The button does not work? Copy this link into your browser:<br><a href="${link}" style="color:#52525b;word-break:break-all">${link}</a></p>
      <p style="margin:0 0 16px;font-size:14px">What happens next: your account is kept for ${grace}, signed out everywhere. If you sign in again during that time, you can keep it. After that it is deleted for good, with your profile, your totals and your ranks. The games you played stay, without your name or your picture.</p>
      <p style="margin:0 0 16px;font-size:14px">If you did not ask for this, ignore this e-mail: nothing will happen.</p>
      <p style="margin:0;font-size:14px;color:#52525b">Questions? Write to <a href="mailto:${escapeHtml(site.contact)}" style="color:#52525b">${escapeHtml(site.contact)}</a>.</p>
    </div>
  </body>
</html>`

  return { from: site.from, to: input.to, subject, text, html, replyTo: site.contact }
}
