// The personal details a member may record on their account (PLT-111): the country or region they are in and their date of birth. Both are optional and are only the member's own word, kept for a check of the age of the games for adults. They
// are kept like the nickname and the preferences, in `user_metadata` under keys of ours, one writer each in `./client` and one reader here (`accountOf`), so that they move to a `profiles` table the day it exists (PLT-13). THE MEMBER CAN WRITE
// THEIR OWN `user_metadata`, so neither value is ever a permission, and a date of birth kept here cannot gate anything by itself: a check of the age will have to keep the date where the member cannot write it (docs/legal.md). Pure, with no
// import, so that the browser, the server and the tests read it the same way (docs/accounts.md, "Settings").

/** The country or region the member recorded: an ISO 3166-1 alpha-2 code (`FR`), which the name is made from when it is shown. */
export const COUNTRY_KEY = "pbgo_country"

/** The date of birth the member recorded, as `YYYY-MM-DD`. */
export const BIRTHDATE_KEY = "pbgo_birthdate"

/** The youngest a member can be: the Terms of Use say 13 (`/legal/terms`, "Who can use the site"). A date that makes the member younger is refused and not kept. */
export const MINIMUM_AGE = 13

/** The oldest a date of birth can be: further back is a mistake in the year. */
export const MAXIMUM_AGE = 120

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

/** A day of the calendar, as a person says it: the year, the month from 1 to 12 and the day from 1. */
export type CalendarDate = { year: number; month: number; day: number }

/** The calendar day a `Date` falls on, in the clock of the device that made it (a person's birthday is a day of their own calendar). */
export const calendarDateOf = (date: Date): CalendarDate => ({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })

/** Whether the three numbers are a day that exists (`31 February` is not). Any year is allowed, the four digits of the form included. */
function isRealDate({ year, month, day }: CalendarDate): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** The whole years between a birth and a day: a birthday counts on its day, and not before. */
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  const birthday = today.month > birth.month || (today.month === birth.month && today.day >= birth.day)
  return today.year - birth.year - (birthday ? 0 : 1)
}

const pad = (value: number, length: number): string => String(value).padStart(length, "0")

/** A date as it is kept: `YYYY-MM-DD`. */
export const birthdateOfParts = ({ year, month, day }: CalendarDate): string => `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`

/** The date of birth the account keeps, or null when it keeps none or something that is not a day that exists in the shape `YYYY-MM-DD`. The limits of the form (not in the future, not further back than 120 years, 13 or older) are not read here: they are the form's (`checkBirthdate`), which knows what day it is. */
export function birthdateOf(user: WithMetadata): string | null {
  const value = user.user_metadata?.[BIRTHDATE_KEY]
  if (typeof value !== "string") return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!parts) return null
  return isRealDate({ year: Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) }) ? value : null
}

/** The year of a date of birth that is kept: the one part a page shows of it until the member edits it. */
export const birthYearOf = (birthdate: string): number => Number(birthdate.slice(0, 4))

/** What the three fields of a date of birth hold, as they were typed (or are prefilled from a date that is kept). */
export type BirthdateFields = { day: string; month: string; year: string }

/** The fields of the form for a date that is kept (`YYYY-MM-DD`), or empty ones when there is none. */
export function birthdateFields(birthdate: string | null): BirthdateFields {
  if (birthdate === null) return { day: "", month: "", year: "" }
  const [year = "", month = "", day = ""] = birthdate.split("-")
  return { day: String(Number(day)), month: String(Number(month)), year }
}

/** Which of the three fields a problem is about, for the one to put the cursor in; none when it is the date as a whole. */
export type BirthdateField = keyof BirthdateFields

/**
 * The three fields of a date of birth judged: the date to keep as `YYYY-MM-DD`, or null when all three are empty (the member takes it away), or what is wrong, in plain words. The date has to exist, not be in the future, not be further
 * back than 120 years and not make the member younger than 13, which is what the Terms of Use ask. `today` is the day on the member's own calendar (`calendarDateOf(new Date())`).
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
  if (!isRealDate(date)) return { ok: false, problem: "That date does not exist.", field: null }
  const age = ageOn(date, today)
  if (age < 0) return { ok: false, problem: "That date is in the future.", field: "year" }
  if (age > MAXIMUM_AGE) return { ok: false, problem: `That is more than ${MAXIMUM_AGE} years ago. Check the year.`, field: "year" }
  if (age < MINIMUM_AGE) return { ok: false, problem: `You must be at least ${MINIMUM_AGE} to use the site.`, field: null }
  return { ok: true, birthdate: birthdateOfParts(date) }
}

/** The country or region a form hands over, judged: its code, or null when none is chosen (it can be taken away), or what is wrong. */
export function checkCountry(value: string): { ok: true; country: string | null } | { ok: false; problem: string } {
  const code = value.trim().toUpperCase()
  if (code === "") return { ok: true, country: null }
  return isCountryCode(code) ? { ok: true, country: code } : { ok: false, problem: "Choose a country or region from the list." }
}
