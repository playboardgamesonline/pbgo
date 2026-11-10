import type { ChangeOutcome } from "@pbgo/accounts/client"
import type { AccountChange, AccountService, SettingKey } from "@pbgo/analytics"
import { trackClient } from "@pbgo/analytics/client"

// What the rows of the settings do with a change of the account (`@pbgo/accounts/client`): the demo account of development holds no session, so its changes are shown as done without asking anyone, and any other
// outcome becomes the sentence a member is told, or nothing when it worked.

/** What a change counts as once it is kept: a change of the account itself, or one of the member's settings. The key, never the new value. */
export type ChangeReport = { account: AccountChange; service?: AccountService } | { setting: SettingKey }

function count(report: ChangeReport): void {
  if ("setting" in report) return trackClient("setting_changed", { setting: report.setting })
  // Linking a service leaves for it: the count goes out at once
  trackClient("account_changed", report.service ? { change: report.account, service: report.service } : { change: report.account }, { instant: report.account === "provider_link_started" })
}

/**
 * Runs a change, or, for the demo account, pretends it was made: it is in no database, and nothing about it is kept. A change that was kept is counted as `report` says (`account_changed`, `setting_changed`): one that was not, and
 * the demo account's, are not.
 */
export async function changing(demo: boolean, run: () => Promise<ChangeOutcome>, report?: ChangeReport): Promise<ChangeOutcome> {
  if (demo) return { status: "done" }
  const outcome = await run()
  if (outcome.status === "done" && report) count(report)
  return outcome
}

/** What to tell a member of a change that did not go through, or null when it did. A session that has ended is told as such: the page they are on is no longer theirs to change. */
export function failureOf(outcome: ChangeOutcome): string | null {
  if (outcome.status === "done") return null
  return outcome.status === "no-session" ? "You are signed out. Sign in again to make this change." : outcome.message
}
