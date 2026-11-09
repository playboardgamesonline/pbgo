// The personal details a member may record on their account (PLT-111): the country or region they are in, and the form of their date of birth. The country is optional and only the member's own word, kept in `user_metadata` under a key of ours (one
// writer in `./client` and one reader here, `accountOf`), so that it moves to a `profiles` table the day it exists (PLT-13). The date of birth is NOT kept there (PLT-125): the member can write their own `user_metadata`, and a check of the age has to
// trust a place they cannot, so the date is declared once to the server and kept in a table that only the server reads (`member_birthdates`, `docs/accounts.md`, "The age check"). What is here for it is the form's side: the three fields, how they are
// judged (on the UTC calendar, as the server counts ages) and how the date is shown. Pure, with no Supabase in it, so that the browser, the server and the tests read it the same way (docs/accounts.md, "Settings").

import { OLDEST_AGE, SITE_MINIMUM_AGE, ageOn, isRealDay, utcDayOf, type CalendarDate } from "./age"

export type { CalendarDate } from "./age"

/** The country or region the member recorded: an ISO 3166-1 alpha-2 code (`FR`), which the name is made from when it is shown. */
export const COUNTRY_KEY = "pbgo_country"

/**
 * The countries and regions of ISO 3166-1, by their alpha-2 code, and XK, which is not in the standard but is what the European Commission and the Unicode CLDR call Kosovo. A code that is not in this list is no country: the key holds
 * whatever the member wrote, and the form only offers these. Their names are English and come from the platform's own `Intl` (`countryName`), so none is kept here.
 */
export const COUNTRY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ")

const CODES: ReadonlySet<string> = new Set(COUNTRY_CODES)

/** Whether a value is the code of a country or region of the list (upper case, as it is kept). */
export const isCountryCode = (value: unknown): value is string => typeof value === "string" && CODES.has(value)

let names: Intl.DisplayNames | undefined

/** The English name of a country or region (`FR` is "France"), or its code when this runtime does not know it. */
export function countryName(code: string): string {
  names ??= new Intl.DisplayNames(["en"], { type: "region" })
  return names.of(code) ?? code
}

let options: { code: string; name: string }[] | undefined

/** Every country and region with its English name, by name: what the form's select lists, made once. The names are the runtime's, so a page draws them on the server and hands them to the browser, which would otherwise draw its own. */
export function countryOptions(): readonly { code: string; name: string }[] {
  if (options === undefined) {
    const collator = new Intl.Collator("en")
    options = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => collator.compare(a.name, b.name))
  }
  return options
}

/** The part of an account that holds the free object `user_metadata`: a user of Supabase Auth, or what the tests make of one. */
type WithMetadata = { user_metadata?: Record<string, unknown> | null }

/** The country the account keeps, or null when it keeps none, or something that is not a code of the list (a value written by hand). */
export function countryOf(user: WithMetadata): string | null {
  const value = user.user_metadata?.[COUNTRY_KEY]
  return isCountryCode(value) ? value : null
}

/** The calendar day an instant falls on in UTC (`utcDayOf`): the day a form judges a date of birth on, since the server counts ages on the UTC calendar, so that the two never disagree about a birthday that is today. */
export const calendarDateOf = utcDayOf

const pad = (value: number, length: number): string => String(value).padStart(length, "0")

/** A date as it is kept: `YYYY-MM-DD`. */
export const birthdateOfParts = ({ year, month, day }: CalendarDate): string => `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`

/** The year of a date of birth: the one part a page shows of it. */
export const birthYearOf = (birthdate: string): number => Number(birthdate.slice(0, 4))

/** What the three fields of a date of birth hold, as they were typed. */
export type BirthdateFields = { day: string; month: string; year: string }

/** The fields of the form for a date (`YYYY-MM-DD`), or empty ones when there is none. */
export function birthdateFields(birthdate: string | null): BirthdateFields {
  if (birthdate === null) return { day: "", month: "", year: "" }
  const [year = "", month = "", day = ""] = birthdate.split("-")
  return { day: String(Number(day)), month: String(Number(month)), year }
}

/** Which of the three fields a problem is about, for the one to put the cursor in; none when it is the date as a whole. */
export type BirthdateField = keyof BirthdateFields

/**
 * The three fields of a date of birth judged: the date to declare as `YYYY-MM-DD`, or null when all three are empty (nothing to declare yet), or what is wrong, in plain words. The date has to exist, not be in the future, not be further
 * back than 120 years and not make the member younger than 13, which is what the Terms of Use ask: the server judges it the same way (`birthdateProblem`). `today` is the day on the UTC calendar (`calendarDateOf(new Date())`).
 */
export function checkBirthdate(fields: BirthdateFields, today: CalendarDate): { ok: true; birthdate: string | null } | { ok: false; problem: string; field: BirthdateField | null } {
  const day = fields.day.trim()
  const month = fields.month.trim()
  const year = fields.year.trim()
  if (day === "" && month === "" && year === "") return { ok: true, birthdate: null }
  const missing: BirthdateField | undefined = day === "" ? "day" : month === "" ? "month" : year === "" ? "year" : undefined
  if (missing) return { ok: false, problem: "Enter the day, the month and the year.", field: missing }
  if (!/^\d{1,2}$/.test(day)) return { ok: false, problem: "Use numbers only for the day.", field: "day" }
  if (!/^\d{1,2}$/.test(month)) return { ok: false, problem: "Use numbers only for the month.", field: "month" }
  if (!/^\d{4}$/.test(year)) return { ok: false, problem: "Write the year with four digits.", field: "year" }
  const date: CalendarDate = { year: Number(year), month: Number(month), day: Number(day) }
  if (!isRealDay(date)) return { ok: false, problem: "That date does not exist.", field: null }
  const age = ageOn(date, today)
  if (age < 0) return { ok: false, problem: "That date is in the future.", field: "year" }
  if (age > OLDEST_AGE) return { ok: false, problem: `That is more than ${OLDEST_AGE} years ago. Check the year.`, field: "year" }
  if (age < SITE_MINIMUM_AGE) return { ok: false, problem: `You must be at least ${SITE_MINIMUM_AGE} to use the site.`, field: null }
  return { ok: true, birthdate: birthdateOfParts(date) }
}

/** The country or region a form hands over, judged: its code, or null when none is chosen (it can be taken away), or what is wrong. */
export function checkCountry(value: string): { ok: true; country: string | null } | { ok: false; problem: string } {
  const code = value.trim().toUpperCase()
  if (code === "") return { ok: true, country: null }
  return isCountryCode(code) ? { ok: true, country: code } : { ok: false, problem: "Choose a country or region from the list." }
}
