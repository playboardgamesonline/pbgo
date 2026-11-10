/**
 * What the properties of an event may hold, as a check that tests run on what a call site sends. The types keep a text that a person typed out of an event (`events.ts`); this
 * is the same rule at run time, on the values themselves: a boolean, a count, or a short word of a closed list (a game's slug, an error code, a state), never a sentence, a name, an address or a table code.
 */

/** The names that a property of an event never holds a value for: they are what a person's data is called. A flag with such a name (`nickname: true`: which of them changed) holds no data and is let through. */
export const PERSONAL_KEYS = ["nickname", "name", "email", "text", "message", "address", "ip", "password", "token", "handle", "tag", "player_id", "user_id", "member_id", "table_code", "birthdate_value"] as const

/** A word of a closed list, a slug, or an error code: lower case or upper case with `_` and `-`, no space, short. */
const WORD = /^(?:[a-z][a-z0-9_-]{0,39}|[A-Z][A-Z0-9_]{1,39})$/

/** A table's code (six letters or digits, upper case) wherever it appears in a text. */
const TABLE_CODE = /(?:^|[^A-Za-z0-9])(?:[A-Z0-9]{3}-[A-Z0-9]{3}|[A-Z0-9]{6})(?![A-Za-z0-9])/

function check(value: unknown, path: string): void {
  if (typeof value === "boolean") return
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${path} is a number that is not a count: ${value}`)
    return
  }
  if (typeof value === "string") {
    // A word with an underscore is a code of ours (`GAME_FULL`); one without that looks like a table's code is read as one
    const looksLikeTableCode = TABLE_CODE.test(value) && !value.includes("_")
    if (!WORD.test(value) || looksLikeTableCode) throw new Error(`${path} is a text that is not a word of a list`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => check(item, `${path}[${index}]`))
    return
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if ((PERSONAL_KEYS as readonly string[]).includes(key) && typeof item !== "boolean") throw new Error(`${path} has a property called ${key}`)
      check(item, `${path}.${key}`)
    }
    return
  }
  throw new Error(`${path} is neither a boolean, a count nor a word`)
}

/** Throws when `properties` holds something that could be personal: a key that is a person's data, or a value that is not a boolean, a count or a short word. */
export function assertNoPersonalData(properties: object): void {
  check(properties, "properties")
}
