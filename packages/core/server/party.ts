import "server-only"
import { PARTY_TABLE_TTL_SECONDS, type PartyTable } from "../lib/party"
import { ApiError } from "./api"
import { isMissingFunction } from "./db-error"
import { readGroupOf } from "./groups"
import { seatedPlayers } from "./table-rules"
import { readTableSettingsOf } from "./table-settings"
import { readMemberTables } from "./tables"

// The table that the leader of a group opened for it (PLT-141): what the members' browsers ask for, so that each sits down at it by itself, and what the leader's home waits on. A table is one of the leader's own (they sit at it and host it), still a lobby or in its ready check,
// opened for the group (`settings.party`, which the create route accepts from the leader of a group only), and not forgotten (`PARTY_TABLE_TTL_SECONDS`). The group is read here from the database, from the account that asks, never from what the browser says: a visitor who is in
// no group is told there is no table, and a member is told of the table of their own group's leader only. The code of a table reaches only the people of the group it was opened for.

/** The table the group of this account has to sit at or wait at, the one opened last when the leader has several, or null: the account is in no group, or the leader has no such table. Where a migration it stands on (0013, 0027) is not applied there is none. */
export async function readPartyTable(userId: string, now: number = Date.now()): Promise<PartyTable | null> {
  try {
    const group = await readGroupOf(userId)
    if (!group) return null
    const mine = userId === group.leader
    // The leader's tables, the one written last first: the ones to sit at are those they host, and that they opened for the group
    const hosted = (await readMemberTables(group.leader)).filter((table) => (table.status === "lobby" || table.status === "starting") && table.hostId === table.seat)
    const fresh = hosted
      .map((table) => ({ table, waited: Math.max(0, Math.floor((now - Date.parse(table.createdAt)) / 1000)) }))
      .filter(({ waited }) => waited <= PARTY_TABLE_TTL_SECONDS)
      .sort((a, b) => a.waited - b.waited)
    for (const { table, waited } of fresh) {
      const settings = await readTableSettingsOf(table.game, table.code)
      if (settings.party !== true) continue
      const seated = seatedPlayers(table.players).length
      // Whether the member sits at it is asked only now that there is a table: a group with nothing to sit at costs two reads of the database
      const you = mine || (await readMemberTables(userId)).some((held) => held.game === table.game && held.code === table.code)
      return { game: table.game, code: table.code, status: table.status as "lobby" | "starting", seats: settings.seats ?? Math.max(seated, 1), seated, you, host: mine, waited }
    }
    return null
  } catch (error) {
    // A project where the functions of migration 0013 or 0027 are not applied yet has no groups' tables
    if (typeof error === "object" && error !== null && isMissingFunction(error as { code?: string })) return null
    throw error
  }
}

/** Refuses with 403 `GROUP_NOT_LEADER` unless the account leads a group: the only one who opens a table for a group. The group is the database's. */
export async function assertLeadsGroup(memberId: string | null): Promise<void> {
  const group = memberId ? await readGroupOf(memberId) : null
  if (!group || group.leader !== memberId) throw new ApiError("GROUP_NOT_LEADER", 403)
}
