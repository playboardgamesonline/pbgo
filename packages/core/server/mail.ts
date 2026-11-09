import "server-only"
import type { MailMessage } from "../lib/deletion-mail"

// Sending an e-mail from our own servers, through Resend's API (PLT-36: the link that confirms the deletion of an account). Resend is already the SMTP provider of Supabase Auth, for the e-mails it writes itself (the sign-up code, the change
// of address); this is the other way in, for the e-mails that our code composes. The key is `RESEND_API_KEY` (one for the app, made in Resend's dashboard, sending access, limited to the domain; `pnpm setup-env` pushes it).
// docs/accounts.md, "Deleting an account", and docs/legal.md, "Recipients".

const ENDPOINT = "https://api.resend.com/emails"
const TIMEOUT_MS = 10_000

/** What came of it: `sent` (Resend took it), `logged` (no key on a development server: the e-mail is printed in the terminal instead, link included), `unavailable` (no key in production) or `failed` (Resend refused it, or did not answer). */
export type MailResult = "sent" | "logged" | "unavailable" | "failed"

type MailEnv = { RESEND_API_KEY?: string; NODE_ENV?: string }

/** Whether an e-mail can leave, or be printed: a key, or a development server. A production build without a key sends nothing, and the pages that need an e-mail say so. */
export function mailAvailable(env: MailEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim()) || env.NODE_ENV !== "production"
}

export type MailDeps = { fetcher?: typeof fetch; env?: MailEnv; log?: Pick<Console, "info" | "error"> }

/**
 * Sends the e-mail. It never says why it failed beyond the status Resend answered or the kind of error, and never logs an address or a word of the message in production: the only place a message is printed is a development server with
 * no key, which prints it so that the flow can be tried without sending anything.
 */
export async function sendMail(mail: MailMessage, { fetcher = fetch, env = process.env, log = console }: MailDeps = {}): Promise<MailResult> {
  const key = env.RESEND_API_KEY?.trim()
  if (!key) {
    if (env.NODE_ENV === "production") return "unavailable"
    log.info(`[mail] RESEND_API_KEY is not set: this e-mail is printed here instead of sent.\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`)
    return "logged"
  }
  try {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "User-Agent": "pbgo-web" },
      body: JSON.stringify({ from: mail.from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.ok) return "sent"
    log.error(`Mail refused: Resend answered ${response.status}`)
    return "failed"
  } catch (error) {
    log.error(`Mail not sent: ${error instanceof Error ? error.name : "unknown error"}`)
    return "failed"
  }
}
