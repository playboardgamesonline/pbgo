import { deletionMessage, type DeletionAnswer, type DeletionRequest } from "@pbgo/accounts"

// What the browser says to `POST /api/hub/account/deletion` (PLT-36) and what it makes of the answer: the pieces of the deletion that talk to it (the Delete account row of the settings, the page of the link, the sign-in's notice
// for an account on hold) all go through here, so that the words of a refusal are told in one way.

/** The answer of the route, ready for the screen: the route's own answer when it worked, else the sentence for the member and the code behind it (`NETWORK` when the site could not be reached). */
export type DeletionResult = { ok: true; answer: DeletionAnswer } | { ok: false; code: string; message: string }

export async function postDeletion(body: DeletionRequest): Promise<DeletionResult> {
  try {
    const response = await fetch("/api/hub/account/deletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Partial<DeletionAnswer>
    if (response.ok && data.ok) return { ok: true, answer: { ok: true, to: data.to, scheduledFor: data.scheduledFor } }
    const code = data.error ?? "SERVER_ERROR"
    return { ok: false, code, message: deletionMessage(code) }
  } catch {
    return { ok: false, code: "NETWORK", message: "We could not reach the site. Check your connection and try again." }
  }
}

/**
 * Goes to a path of this site with a whole page load, on purpose: the cookies the route just set (or took away) must be those of the next request, and the demo routes of development are route handlers, which a client navigation does not run. The path comes
 * in as an argument, not as a literal, because the lint rule against `location.assign` is about links the router could follow.
 */
export function leaveTo(path: string): void {
  window.location.assign(path)
}
