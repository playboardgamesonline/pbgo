import { describe, expect, it } from "vitest"
import { errorCodeOf } from "./error-code"
import type { ClientEvents, ServerEvents } from "./events"
import { assertNoPersonalData, PERSONAL_KEYS } from "./privacy"

// What an event may hold. The types do the first half: a property that is a plain `string`, or a list of them (anything a person could type), does not compile, but the slug of a game and the slugs of several.
// The fixtures do the second: there is one for every event (a new event with no fixture does not compile either), and every value of every fixture is checked at run time.

/** The keys of an event's properties that are a plain `string`, or a list of them. */
type OpenTextKeys<Properties> = {
  [Key in keyof Properties]-?: [Properties[Key]] extends [never]
    ? never
    : string extends Properties[Key]
      ? Key
      : Properties[Key] extends readonly (infer Item)[]
        ? string extends Item
          ? Key
          : never
        : never
}[keyof Properties]

/** The events that have a property of free text, the slugs of games apart: none may. */
type EventsWithFreeText<Events> = { [Name in keyof Events]: [Exclude<OpenTextKeys<Events[Name]>, "game" | "games">] extends [never] ? never : Name }[keyof Events]

const noFreeTextOnTheServer: [EventsWithFreeText<ServerEvents>] extends [never] ? true : never = true
const noFreeTextInTheBrowser: [EventsWithFreeText<ClientEvents>] extends [never] ? true : never = true

const SERVER: { [Name in keyof ServerEvents]: ServerEvents[Name] } = {
  game_created: { game: "courtisans", options: { speed: "fast", expansion: true }, max_players: 4, locale: "en", visibility: "public" },
  player_joined: { game: "courtisans", seat: 1, players: 2, visibility: "private" },
  game_started: { game: "courtisans", players: 2, options: {}, visibility: "public" },
  game_finished: { game: "courtisans", duration_s: 600, players: 2, moves_count: 42, ended_by: "natural", approximate: true },
  game_left: { game: "courtisans", phase: "playing" },
  table_deleted: { game: "courtisans", reason: "lobby_left" },
  feedback_sent: { game: "courtisans", type: "bug", with_screenshot: true, with_email: false },
  game_route_error: { game: "courtisans", route: "join", code: errorCodeOf("RANK_TOO_LOW"), status: 403 },
  signed_in: { method: "google", new_account: true },
  signed_out: {},
  account_deletion: { step: "requested" },
  rematch_started: { game: "courtisans" },
  takeover_vote_started: { game: "courtisans" },
  takeover_completed: { game: "courtisans" },
  turn_auto_played: { game: "courtisans", reason: "takeover" },
  chat_message_sent: { game: "courtisans", kind: "text" },
  quick_play_started: { mode: "ranked", games: ["courtisans", "flip-7"] },
  quick_play_matched: { game: "courtisans", mode: "normal", how: "joined", wait_s: 12, players: 3 },
  quick_play_cancelled: { mode: "normal", games: ["courtisans"], wait_s: 30 },
}

const CLIENT: { [Name in keyof ClientEvents]: ClientEvents[Name] } = {
  game_opened_from_hub: { game: "courtisans" },
  invite_link_copied: { game: "courtisans" },
  rules_opened: { game: "courtisans" },
  auth_started: { flow: "signup", method: "password" },
  signup_code_sent: { resent: false },
  signed_in: { method: "email_code", new_account: true },
  account_changed: { change: "provider_unlinked", service: "twitch" },
  setting_changed: { setting: "time_format" },
  table_setting_changed: { game: "courtisans", setting: "visibility", visibility: "public" },
  public_table_clicked: { game: "courtisans", from: "tables_tab" },
  list_searched: { list: "games", with_text: true, filters: 2, results: 14, sort: "trending" },
  game_page_clicked: { game: "courtisans", target: "create_table" },
  language_changed: { from: "en", to: "fr" },
  cookie_consent: { choice: "accepted", marketing: false },
  profile_viewed: { own: false, hidden: false, from: "leaderboard" },
  profile_updated: { nickname: true, tag: false },
  profile_update_refused: { reason: "taken" },
  profile_history_hidden: { hidden: true },
}

describe("the types of the events", () => {
  it("leave no room for a text that a person typed", () => {
    expect(noFreeTextOnTheServer).toBe(true)
    expect(noFreeTextInTheBrowser).toBe(true)
  })
})

describe.each([
  ["server", SERVER],
  ["browser", CLIENT],
])("every %s event", (_side, events) => {
  it.each(Object.entries(events))("%s holds nothing personal", (_name, properties) => {
    expect(() => assertNoPersonalData(properties)).not.toThrow()
  })

  it("is named in snake_case", () => {
    for (const name of Object.keys(events)) expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/)
  })
})

describe("assertNoPersonalData", () => {
  it("lets booleans, counts, short words of a closed list and the options of a table through", () => {
    expect(() => assertNoPersonalData({ game: "flip-7", players: 3, approximate: true, kind: "text", options: { fast: true, mode: "ranked" }, code: errorCodeOf("GAME_FULL") })).not.toThrow()
  })

  it.each([
    ["a nickname", { nickname: "Marly" }],
    ["an e-mail address", { reason: "marly@example.com" }],
    ["a sentence", { reason: "I could not join the table" }],
    ["a table code", { game: "courtisans", where: "/courtisans/game/4XV6A1" }],
    ["the code of a table written as the page's title does", { title: "Table #4XV-XA1" }],
    ["a long text", { reason: "a".repeat(41) }],
    ["a text in a list", { games: ["courtisans", "Marly's table"] }],
    ["an object that holds a name", { options: { host: "Marly dit bonjour" } }],
    ["a number that is not a count", { seats: -1 }],
    ["a number with decimals", { wait: 1.5 }],
  ])("refuses %s", (_what, properties) => {
    expect(() => assertNoPersonalData(properties)).toThrow()
  })

  it.each(PERSONAL_KEYS)("refuses a property called %s that holds something", (key) => {
    expect(() => assertNoPersonalData({ [key]: "marly" })).toThrow()
    expect(() => assertNoPersonalData({ nested: { [key]: "marly" } })).toThrow()
  })

  it.each(PERSONAL_KEYS)("lets a flag called %s through: it says which, not what", (key) => {
    expect(() => assertNoPersonalData({ [key]: true })).not.toThrow()
  })
})

describe("errorCodeOf", () => {
  it.each(["GAME_FULL", "RANK_TOO_LOW", "CONFLICT", "AGE_TABLE_NOT_ALLOWED"])("keeps %s", (code) => {
    expect(errorCodeOf(code)).toBe(code)
  })

  it.each([["a message", "The table is full"], ["lower case", "game_full"], ["an address", "marly@example.com"], ["too long", "A".repeat(41)], ["too short", "A"], ["nothing", undefined], ["a number", 403]])(
    "turns %s into UNKNOWN",
    (_what, value) => {
      expect(errorCodeOf(value)).toBe("UNKNOWN")
    },
  )
})
