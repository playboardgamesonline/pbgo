// The site's motion, as the member chose it (PLT-111, Accessibility & appearance): `auto` follows their device (`prefers-reduced-motion`), `always` reduces the animations, `never` keeps them whatever the device says. The choice is kept on
// the account (`PREFERENCE_KEYS.reduceMotion`) and mirrored on the device by a cookie, which is what lets a page honour it BEFORE its first paint without being rendered per request: a script in the head of every platform page reads the
// cookie and writes the choice on `<html>` (`MOTION_SCRIPT`), where the stylesheet and the scripts of the site read it. Pure apart from the document it is handed, with no import beyond the preference itself, so that the browser, the
// server and the tests read it the same way (docs/accounts.md, "Settings").

import { isDemoAccount } from "./demo"
import { isReduceMotion, type ReduceMotion } from "./preferences"

/** The cookie that remembers the choice on a device. `auto` is no cookie. */
export const MOTION_COOKIE = "pbgo-motion"

/** How long the cookie lasts: a year, in seconds. */
export const MOTION_COOKIE_MAX_AGE = 31536000

/** The attribute of `<html>` that carries the choice: `data-reduce-motion="always"` or `"never"`, and absent when the device decides. The stylesheet (`platform.css`) and `useReducedMotion` (`@pbgo/ui/reduced-motion`) read it. */
export const MOTION_ATTRIBUTE = "data-reduce-motion"

/** The cookie as `document.cookie` takes it: the choice for a year, or nothing at all for `auto`, which takes the cookie away. */
export function motionCookie(choice: ReduceMotion): string {
  return choice === "auto" ? `${MOTION_COOKIE}=; path=/; max-age=0; samesite=lax` : `${MOTION_COOKIE}=${choice}; path=/; max-age=${MOTION_COOKIE_MAX_AGE}; samesite=lax`
}

/** What a value read from a cookie says: `always` or `never`, and `auto` for anything else (no cookie, or a value written by hand). */
export const motionOf = (value: unknown): ReduceMotion => (value === "always" || value === "never" ? value : "auto")

/** The choice that a `document.cookie` string holds. */
export function motionFromCookies(cookies: string): ReduceMotion {
  for (const part of cookies.split(";")) {
    const index = part.indexOf("=")
    if (index !== -1 && part.slice(0, index).trim() === MOTION_COOKIE) return motionOf(part.slice(index + 1).trim())
  }
  return "auto"
}

/**
 * The script of the head of a platform page: it copies the cookie onto `<html>` before the first paint, so that the animations of the page start the way the member chose, and does nothing for a device with no cookie. It is plain, small and
 * written with the same names as this module (`motion.test.ts` runs it); the static pages carry it as they are, since it reads the device and never the server.
 */
export const MOTION_SCRIPT = `(function(){try{var m=/(?:^|;\\s*)${MOTION_COOKIE}=(always|never)/.exec(document.cookie);if(m)document.documentElement.setAttribute("${MOTION_ATTRIBUTE}",m[1])}catch(e){}})()`

/** What `applyMotion` writes into: a document, as far as it touches it. */
export type MotionDocument = { cookie: string; documentElement: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void } }

/** Puts a choice into effect on this device now, and keeps it: the attribute on `<html>`, which the page reads at once, and the cookie, which the next page reads before it paints. Writing the same thing twice does nothing more. */
export function applyMotion(choice: ReduceMotion, doc: MotionDocument = document): void {
  if (choice === "auto") doc.documentElement.removeAttribute(MOTION_ATTRIBUTE)
  else doc.documentElement.setAttribute(MOTION_ATTRIBUTE, choice)
  doc.cookie = motionCookie(choice)
}

/** What the sync needs to know of the visitor, as `useAccount` of `./client` says it. */
export type MotionVisitor = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; account: { id: string; preferences: { reduceMotion: ReduceMotion } } }

/**
 * The sync of a signed-in member's device with their account, each time the browser has read the session: the choice of the account is written on the device when the cookie holds another. The account wins, as the language's does, and `auto`
 * is a choice like the others, so a member who sets it takes the cookie away. Nothing for a visitor the browser has not read yet, for a guest (whose device keeps what it has) and for the demo account of development, which keeps nothing and
 * leaves the device to the row that was pressed. Returns the choice it wrote, or null when it wrote nothing.
 */
export function syncMotion(visitor: MotionVisitor, cookies: string, apply: (choice: ReduceMotion) => void): ReduceMotion | null {
  if (visitor.status !== "signed-in" || isDemoAccount(visitor.account)) return null
  const choice = visitor.account.preferences.reduceMotion
  if (!isReduceMotion(choice) || motionFromCookies(cookies) === choice) return null
  apply(choice)
  return choice
}
