import "server-only"
import { ageRefusal, type AgeRefusal, type AgeSubject } from "@pbgo/accounts"
import type { OptionValues } from "@pbgo/engine-kit"
import { hasAgeRules, tableAge, type AgeRulesSource } from "../lib/age-rules"
import type { GameEntry } from "../lib/binding"
import { ApiError } from "./api"
import { readBirthdates } from "./birthdate"
import type { GameRow } from "./games"
import type { Actor } from "./profile"
import { supabaseAdmin } from "./supabase"

// The age check of the tables (PLT-125): a game, or an expansion, for adults is played only by people who are old enough. The routes that seat somebody or change what a table plays ask this module, on the server, before they write anything.
//
//   - the age a table asks is the highest age the platform enforces among its game and the expansions its options switch on (`tableAge`);
//   - the person who acts is judged by the date of birth they declared (`readBirthdates`: a table only the server writes), never by what the browser says;
//   - a guest has no date, so a table that asks for an age is not sat at by a guest: they sign in;
//   - the people already seated are looked up only when the age of their table goes up or the table starts (`seatsOf`), and a table whose game asks for no age costs no lookup at all.
// Where the numbers come from (the Studio's "Minimum age") is the app's business: it hands the rules in as an `AgeRulesSource`, which core cannot read itself.

/** What the check refuses with, by why: a guest signs in (401), a member adds their date of birth or is too young (403). The codes are worded in `CORE_ERROR_MESSAGES`. */
export const AGE_REFUSALS: Record<AgeRefusal, { code: string; status: number }> = {
  "sign-in": { code: "AGE_SIGN_IN_REQUIRED", status: 401 },
  date: { code: "AGE_DATE_REQUIRED", status: 403 },
  "too-young": { code: "AGE_TOO_YOUNG", status: 403 },
}

/** The demo account of development is in no database and has no date of birth: it counts as an adult, so that a table for adults can be tried on a machine with no provider. It exists only in development (`demoAllowed`). */
const DEMO_SUBJECT: AgeSubject = { kind: "member", birthdate: "1990-01-01" }

const GUEST: AgeSubject = { kind: "guest" }

/** The person who acts, for the check: a guest, the demo account, or a member with the date they declared (null when they declared none). */
export async function ageSubjectOf(actor: Actor): Promise<AgeSubject> {
  if (!actor.signedIn) return GUEST
  if (actor.memberId === null) return DEMO_SUBJECT
  return { kind: "member", birthdate: (await readBirthdates([actor.memberId])).get(actor.memberId) ?? null }
}

/** Who sits at a table, by seat (the player id), as the check sees them. */
export type SeatSubjects = ReadonlyMap<string, AgeSubject>

/**
 * Who sits at the table `row`: the person who acts under their seat `self` (the host, in the routes that ask), the others by the account the table recorded for their seat (`games.member_ids`, written when a member opens or joins a table) and the date that
 * account declared. A seat the table recorded no account for is a guest's. Throws what the database says: a check that cannot read who sits where lets nobody through.
 */
async function seatSubjects(game: Pick<GameEntry, "slug">, row: Pick<GameRow, "code" | "players">, self: string | null, selfSubject: AgeSubject): Promise<SeatSubjects> {
  const seats = new Map<string, AgeSubject>()
  if (self !== null) seats.set(self, selfSubject)
  const others = row.players.filter((player) => player.id !== self)
  if (others.length === 0) return seats
  const { data, error } = await supabaseAdmin().from("games").select("member_ids").eq("game", game.slug).eq("code", row.code).maybeSingle()
  if (error) throw error
  const accounts = ((data as { member_ids?: Record<string, unknown> } | null)?.member_ids ?? {}) as Record<string, unknown>
  const accountOf = (seat: string): string | null => (typeof accounts[seat] === "string" ? (accounts[seat] as string) : null)
  const birthdates = await readBirthdates(others.flatMap((player) => accountOf(player.id) ?? []))
  for (const player of others) {
    const account = accountOf(player.id)
    seats.set(player.id, account === null ? GUEST : { kind: "member", birthdate: birthdates.get(account) ?? null })
  }
  return seats
}

/**
 * The age check of one request: what the game's rules are, and who acts. Made by `ageGateFor`, once the rules and the person are known, so that the checks that follow run without waiting for the database again (they run inside the modifier of
 * `updateGame`, which is synchronous and runs again when it loses a race).
 */
export type AgeGate = {
  /** Whether the game, or one of its expansions, asks for an age the platform enforces. When it does not, the gate looks nothing up and refuses nobody. */
  restricted: boolean
  /** The age a table asks, from the options it has or will have; null when none is enforced. */
  tableAge(options: Readonly<OptionValues>): number | null
  /** The age a table comes to ask when its options go from `before` to `next` and that age goes up (an expansion for adults is switched on, or one for a higher age); null when it stays as it was or goes down. */
  raises(before: Readonly<OptionValues>, next: Readonly<OptionValues>): number | null
  /** Throws why the person who acts may not sit at a table that asks `age` (`AGE_SIGN_IN_REQUIRED`, `AGE_DATE_REQUIRED` or `AGE_TOO_YOUNG`). Nothing for a table that asks none. */
  assertMay(age: number | null): void
  /** Who sits at `row`, for `assertSeats`; null when the game asks for no age. Asks the database, so it is called before the write, with the row as it was read. `self` is the seat of the person who acts, whom the gate already knows. */
  seatsOf(row: Pick<GameRow, "code" | "players">, self: string | null): Promise<SeatSubjects | null>
  /**
   * Throws unless everybody seated at `row` may sit at a table that asks `age` (`AGE_TABLE_NOT_ALLOWED`): the host switching on an expansion for adults, and the table starting. Nothing for a table that asks none. `seats` is what `seatsOf` found for the row
   * as it was read; a seat it does not know, because somebody sat down since, throws `CONFLICT`, the error of a write that lost a race.
   */
  assertSeats(row: Pick<GameRow, "players">, age: number | null, seats: SeatSubjects | null): void
}

/** The check of one request: the rules of the game (from `source`) and the person who acts. Looks the person's date up only when the game, or an expansion, asks for an age; `now` is the instant the ages are counted at. */
export async function ageGateFor(source: AgeRulesSource, game: Pick<GameEntry, "slug">, actor: Actor, now: Date = new Date()): Promise<AgeGate> {
  const rules = await source(game.slug)
  const restricted = hasAgeRules(rules)
  const subject = restricted ? await ageSubjectOf(actor) : GUEST
  return {
    restricted,
    tableAge: (options) => tableAge(rules, options),
    raises(before, next) {
      const asked = tableAge(rules, next)
      const was = tableAge(rules, before)
      return asked !== null && (was === null || asked > was) ? asked : null
    },
    assertMay(age) {
      const why = ageRefusal(age, subject, now)
      if (why) throw new ApiError(AGE_REFUSALS[why].code, AGE_REFUSALS[why].status)
    },
    seatsOf: async (row, self) => (restricted ? seatSubjects(game, row, self, subject) : null),
    assertSeats(row, age, seats) {
      if (age === null) return
      for (const player of row.players) {
        const seat = seats?.get(player.id)
        if (!seat) throw new ApiError("CONFLICT", 409)
        if (ageRefusal(age, seat, now) !== null) throw new ApiError("AGE_TABLE_NOT_ALLOWED", 403)
      }
    },
  }
}
