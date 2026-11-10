// How the site is shown on a device, as the member chose it (PLT-111, Accessibility and Appearance): its motion and its transparency, each `auto` (follow the device: `prefers-reduced-motion`, `prefers-reduced-transparency`), `always`
// (reduced) or `never` (kept, whatever the device says). A choice is kept on the account (`PREFERENCE_KEYS`) and mirrored on the device by a cookie, which is what lets a page honour it BEFORE its first paint without being rendered per request:
// a script in the head of every platform page reads the cookies and writes each choice on `<html>` (`DISPLAY_SCRIPT`), where the stylesheet and the scripts of the site read it. Pure apart from the document it is handed, with no import
// beyond the preferences, so that the browser, the server and the tests read it the same way (docs/accounts.md, "Settings").

import { isDemoAccount } from "./demo"
import { isReduceChoice, type Preferences, type ReduceChoice } from "./preferences"

/** The attribute of `<html>` that carries the choice for the motion: `data-reduce-motion="always"` or `"never"`, and absent when the device decides. The stylesheet (`platform.css`) and `useReducedMotion` (`@pbgo/ui/reduced-motion`) read it. */
export const MOTION_ATTRIBUTE = "data-reduce-motion"

/** The attribute of `<html>` that carries the choice for the transparency, the same way. The stylesheet reads it. */
export const TRANSPARENCY_ATTRIBUTE = "data-reduce-transparency"

/** The settings of how the site is shown, each with the cookie that remembers the choice on a device (`auto` is no cookie) and the attribute of `<html>` that carries it. */
export const DISPLAY_SETTINGS = {
  reduceMotion: { cookie: "pbgo-motion", attribute: MOTION_ATTRIBUTE },
  reduceTransparency: { cookie: "pbgo-transparency", attribute: TRANSPARENCY_ATTRIBUTE },
} as const

export type DisplaySetting = keyof typeof DISPLAY_SETTINGS

/** The settings, in the order the script and the sync go through them. */
export const DISPLAY_NAMES = Object.keys(DISPLAY_SETTINGS) as DisplaySetting[]

/** How long a cookie lasts: a year, in seconds. */
export const DISPLAY_COOKIE_MAX_AGE = 31536000

/** The cookie of a setting as `document.cookie` takes it: the choice for a year, or nothing at all for `auto`, which takes the cookie away. */
export function displayCookie(setting: DisplaySetting, choice: ReduceChoice): string {
  const { cookie } = DISPLAY_SETTINGS[setting]
  return choice === "auto" ? `${cookie}=; path=/; max-age=0; samesite=lax` : `${cookie}=${choice}; path=/; max-age=${DISPLAY_COOKIE_MAX_AGE}; samesite=lax`
}

/** What a value read from a cookie says: `always` or `never`, and `auto` for anything else (no cookie, or a value written by hand). */
export const displayChoiceOf = (value: unknown): ReduceChoice => (value === "always" || value === "never" ? value : "auto")

/** The choice that a `document.cookie` string holds for a setting. */
export function displayFromCookies(setting: DisplaySetting, cookies: string): ReduceChoice {
  const { cookie } = DISPLAY_SETTINGS[setting]
  for (const part of cookies.split(";")) {
    const index = part.indexOf("=")
    if (index !== -1 && part.slice(0, index).trim() === cookie) return displayChoiceOf(part.slice(index + 1).trim())
  }
  return "auto"
}

/**
 * The script of the head of a platform page: it copies the cookies onto `<html>` before the first paint, so that the page opens the way the member chose, and does nothing for a device with no cookie. It is plain, small and written with the
 * same names as this module (`display.test.ts` runs it); the static pages carry it as it is, since it reads the device and never the server.
 */
export const DISPLAY_SCRIPT = `(function(){try{var c=document.cookie,e=document.documentElement,m;${DISPLAY_NAMES.map((name) => {
  const { cookie, attribute } = DISPLAY_SETTINGS[name]
  return `m=/(?:^|;\\s*)${cookie}=(always|never)/.exec(c);if(m)e.setAttribute("${attribute}",m[1]);`
}).join("")}}catch(x){}})()`

/** What `applyDisplay` writes into: a document, as far as it touches it. */
export type DisplayDocument = { cookie: string; documentElement: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void } }

/** Puts a choice into effect on this device now, and keeps it: the attribute on `<html>`, which the page reads at once, and the cookie, which the next page reads before it paints. Writing the same thing twice does nothing more. */
export function applyDisplay(setting: DisplaySetting, choice: ReduceChoice, doc: DisplayDocument = document): void {
  const { attribute } = DISPLAY_SETTINGS[setting]
  if (choice === "auto") doc.documentElement.removeAttribute(attribute)
  else doc.documentElement.setAttribute(attribute, choice)
  doc.cookie = displayCookie(setting, choice)
}

/** What the sync needs to know of the visitor, as `useAccount` of `./client` says it. */
export type DisplayVisitor = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; account: { id: string; preferences: Pick<Preferences, DisplaySetting> } }

/**
 * The sync of a signed-in member's device with their account, each time the browser has read the session: the choice of the account is written on the device for each setting whose cookie holds another. The account wins, as the language's does,
 * and `auto` is a choice like the others, so a member who sets it takes the cookie away. Nothing for a visitor the browser has not read yet, for a guest (whose device keeps what it has) and for the demo account of development, which keeps nothing
 * and leaves the device to the row that was pressed. Returns the settings it wrote.
 */
export function syncDisplay(visitor: DisplayVisitor, cookies: string, apply: (setting: DisplaySetting, choice: ReduceChoice) => void): DisplaySetting[] {
  if (visitor.status !== "signed-in" || isDemoAccount(visitor.account)) return []
  const written: DisplaySetting[] = []
  for (const setting of DISPLAY_NAMES) {
    const choice = visitor.account.preferences[setting]
    if (!isReduceChoice(choice) || displayFromCookies(setting, cookies) === choice) continue
    apply(setting, choice)
    written.push(setting)
  }
  return written
}
