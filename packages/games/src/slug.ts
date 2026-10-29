// What a game's slug and name can be: the one definition, read by the registry test and by the scripts that create a game
// (scripts/lib.sh). Pure and without any import, so that Node runs it as it is (type stripping) and the test and the scripts
// cannot disagree.

/**
 * The names a slug cannot take because they are a route or a file of apps/web: its top-level routes (and `/api/media` and
 * `/api/catalog`, global API routes next to `/api/<slug>`), the pages and API routes of the gamemaster that sit next to
 * `/gamemaster/<slug>` (`login`, `logout`, `api`), plus a game's own segments. `ingest` is the PostHog proxy (a rewrite).
 * `slug.test.ts` reads the folders of the app and fails when one of them is missing here.
 */
export const RESERVED_SLUGS: readonly string[] = ["api", "legal", "design", "gamemaster", "ingest", "login", "logout", "media", "catalog", "admin", "preview", "game", "games", "privacy", "terms", "tables", "tournaments", "whats-new", "icons", "robots.txt", "sitemap.xml", "favicon.ico"]

/** Words of lowercase letters and digits joined by single dashes */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** A slug names a package, a token variable and a Studio host (a DNS label, 63 characters at most): a bound well below that. */
export const MAX_SLUG_LENGTH = 40

// The letters Unicode does not split into a letter and an accent
const LETTERS: Record<string, string> = { œ: "oe", æ: "ae", ß: "ss", ø: "o", ł: "l", đ: "d" }

/**
 * The slug a game's name makes: `The Crew` → `the-crew`, `Flip 7` → `flip-7`. Accents go (`Échecs` → `echecs`), an apostrophe disappears
 * (`Queen's Gambit` → `queens-gambit`), `&` is "and", and anything else that is not a letter or a digit is a dash. A name with no
 * Latin letter or digit makes "": the caller asks for a slug.
 */
export function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[œæßøłđ]/g, (letter) => LETTERS[letter] ?? letter)
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** What is wrong with a slug for a new game, in a sentence, or `undefined` when it is fine. `taken` = the slugs of the games that exist. */
export function slugProblem(slug: string, taken: readonly string[] = []): string | undefined {
  if (!slug) return "The slug is empty"
  if (!SLUG_PATTERN.test(slug)) return `"${slug}" is not a slug: lowercase letters and digits, words joined by single dashes (the-crew, 6-nimmt)`
  if (slug.length > MAX_SLUG_LENGTH) return `"${slug}" is ${slug.length} characters long, ${MAX_SLUG_LENGTH} at most (it names a package, a token and a Studio host)`
  if (RESERVED_SLUGS.includes(slug)) return `"${slug}" is a route of the site, a game cannot take it`
  if (taken.includes(slug)) return `"${slug}" is already a game of the site`
  return undefined
}

/** A name is printed on the hub, in the Studio and in the docs of the game's package: one line of text, this long at most. */
export const MAX_NAME_LENGTH = 60

/** A name as it is kept: trimmed, one space between words (a tab or a line break is a space). */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

/** The name a slug makes when none is given: `flip-7` → `Flip 7`, `the-crew` → `The Crew`. */
export function nameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/** What is wrong with the name of a new game, in a sentence, or `undefined` when it is fine. The name is judged as `cleanName` keeps it. */
export function nameProblem(name: string): string | undefined {
  const clean = cleanName(name)
  if (!clean) return "The name is empty"
  // What is left once the white space is gone: an escape, a null, a DEL… nothing a name can hold, and a terminal would obey it
  if (/\p{Cc}/u.test(clean)) return "The name has a control character: it is one line of printable text"
  const length = [...clean].length
  if (length > MAX_NAME_LENGTH) return `"${clean}" is ${length} characters long, ${MAX_NAME_LENGTH} at most`
  return undefined
}
