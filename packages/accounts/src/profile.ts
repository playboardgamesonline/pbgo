// The profile of a member without a database (PLT-39, PLT-111): the handle (nickname and tag, "Alex#0042"), the address of the public page (`/player/Alex-0042`), where a link was drawn, and what is wrong with a tag. Pure, so forms, server, pages and tests read it the same way.

import { DISPLAY_NAME_MAX, NAME_FORBIDDEN_CHARACTERS, cleanDisplayName } from "./signup"

/** How many digits a tag is written with ("0042"). */
export const TAG_DIGITS = 4

/** The lowest and the highest tag. 0 is not one: the pages call it "no tag", which is what a guest has. */
export const TAG_MIN = 1
export const TAG_MAX = 9999

/** A member as the others name them: the nickname they chose and the tag that tells two members of one name apart. The pair is theirs alone, whatever the case of the nickname (`profiles_handle_idx`, migration 0015). */
export type Handle = { nickname: string; tag: number }

/** A tag as it is written: "0042" for 42. */
export const tagText = (tag: number): string => String(tag).padStart(TAG_DIGITS, "0")

/** A member as the platform writes them: "Alex#0042". */
export const handleText = (handle: Handle): string => `${handle.nickname}#${tagText(handle.tag)}`

/** The folder of the profiles in the hub's routes: a profile is `/player/<nickname>-<tag>`. */
export const PROFILE_PATH = "/player"

/** Where a visitor came to a profile from, which the link says (`?from=`) and the page tells the analytics: a seat's card, a leaderboard, the games of another profile, or the member's own account (their menu and their settings). */
export const PROFILE_SOURCES = ["seat", "leaderboard", "history", "account"] as const

export type ProfileSource = (typeof PROFILE_SOURCES)[number]

/** The source a value says, or null: anyone can write a link, so only the words above count. */
export const profileSourceOf = (value: unknown): ProfileSource | null => PROFILE_SOURCES.find((source) => source === value) ?? null

/**
 * The address of a profile: `/player/Alex-0042`, the nickname written for a path (a space is `%20`) and the tag with its four digits, which a reader takes from the end since a nickname may hold a dash. `from` is where the link is drawn
 * (`ProfileSource`), so that the page can say how a visitor got there.
 */
export function profilePath(handle: Handle, from?: ProfileSource): string {
  const path = `${PROFILE_PATH}/${encodeURIComponent(handle.nickname)}-${tagText(handle.tag)}`
  return from ? `${path}?from=${from}` : path
}

/** Whether a text can be the nickname of a profile: what `checkNickname` keeps (cleaned, 20 characters at most, none of `#`, `/` and `\`). */
const isNickname = (text: string): boolean => text !== "" && text === cleanDisplayName(text) && Array.from(text).length <= DISPLAY_NAME_MAX && !NAME_FORBIDDEN_CHARACTERS.test(text)

/**
 * The handle that the last segment of a profile's address says (`Alex-0042`, still written for a path or not), or null when it cannot be one: no tag of four digits at the end, a tag of 0000, or a nickname that no profile can have. The case is the
 * database's to compare, so it is kept as it came.
 */
export function parseProfileSegment(segment: string): Handle | null {
  let text: string
  try {
    text = decodeURIComponent(segment)
  } catch {
    // A "%" that is not the start of an escape: the segment came decoded already, and is read as it is
    text = segment
  }
  const match = /^([\s\S]+)-(\d{4})$/u.exec(text)
  if (!match) return null
  const tag = Number(match[2])
  const nickname = match[1] ?? ""
  return tag >= TAG_MIN && tag <= TAG_MAX && isNickname(nickname) ? { nickname, tag } : null
}

/** A tag as a member typed it ("42", "0042" or "#0042"): the number, or what is wrong with it. */
export function checkTag(text: string): { ok: true; tag: number } | { ok: false; problem: string } {
  const digits = text.trim().replace(/^#/, "")
  if (digits === "") return { ok: false, problem: "Enter a tag." }
  if (!/^\d+$/.test(digits) || digits.length > TAG_DIGITS) return { ok: false, problem: `A tag is up to ${TAG_DIGITS} digits.` }
  const tag = Number(digits)
  if (tag < TAG_MIN) return { ok: false, problem: `A tag is ${tagText(TAG_MIN)} or more.` }
  return { ok: true, tag }
}

/** The tag of a request, which a client may send as a number or as the text a member typed: a whole number from `TAG_MIN` to `TAG_MAX`, or null. */
export function tagOfRequest(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= TAG_MIN && value <= TAG_MAX ? value : null
  if (typeof value === "string") {
    const checked = checkTag(value)
    return checked.ok ? checked.tag : null
  }
  return null
}

/**
 * What a visitor sees of a member's profile: `own` when the visitor is the member, and `showGames` when the games, records and ranks are shown to them. A member who hides them (`hideHistory`) shows them to nobody but themselves. A guest and the demo account are never the member. The page asks this before it reads a single game.
 */
export function profileViewOf(owner: { userId: string; hideHistory: boolean }, viewer: { id: string } | null): { own: boolean; showGames: boolean } {
  const own = viewer !== null && viewer.id === owner.userId
  return { own, showGames: own || !owner.hideHistory }
}

/** A member's own handle as the browser holds it, from what `GET /api/hub/profile` answers: the nickname of their profile and their tag, which is null where the database has no profile for them (the name stands alone). */
export type OwnHandle = { nickname: string; tag: number | null }

/** The own handle that an answer says, or null when it says none: anything that is not a nickname (a text of 1 to 20 characters, as the profile keeps it) with a tag in range or none. A browser never draws what the server did not send. */
export function ownHandleOf(body: unknown): OwnHandle | null {
  if (typeof body !== "object" || body === null) return null
  const { nickname, tag } = body as Record<string, unknown>
  if (typeof nickname !== "string" || nickname === "" || Array.from(nickname).length > DISPLAY_NAME_MAX) return null
  if (tag === null) return { nickname, tag: null }
  return typeof tag === "number" && Number.isInteger(tag) && tag >= TAG_MIN && tag <= TAG_MAX ? { nickname, tag } : null
}
