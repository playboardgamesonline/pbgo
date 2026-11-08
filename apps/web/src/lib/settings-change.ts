import type { ChangeOutcome } from "@pbgo/accounts/client"

// What the rows of the settings do with a change of the account (`@pbgo/accounts/client`): the demo account of development holds no session, so its changes are shown as done without asking anyone, and any other
// outcome becomes the sentence a member is told, or nothing when it worked.

/** Runs a change, or, for the demo account, pretends it was made: it is in no database, and nothing about it is kept. */
export function changing(demo: boolean, run: () => Promise<ChangeOutcome>): Promise<ChangeOutcome> {
  return demo ? Promise.resolve({ status: "done" }) : run()
}

/** What to tell a member of a change that did not go through, or null when it did. A session that has ended is told as such: the page they are on is no longer theirs to change. */
export function failureOf(outcome: ChangeOutcome): string | null {
  if (outcome.status === "done") return null
  return outcome.status === "no-session" ? "You are signed out. Sign in again to make this change." : outcome.message
}
