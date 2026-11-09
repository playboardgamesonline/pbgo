/**
 * When the debug tools may run: one rule, read by every way in (the address, the browser's storage, the keyboard, the build). They never run on the
 * production deployment, whatever is asked; a preview deployment and a machine in development may use them.
 *
 * `NEXT_PUBLIC_APP_ENV` is the `VERCEL_ENV` that `apps/web/next.config.ts` copies (`production`, `preview`, or `development` where Vercel is not involved).
 * Pure, so that the rule is tested without a browser (`debug-rule.test.ts`).
 */
export const debugAllowed = (appEnv: string | undefined = process.env.NEXT_PUBLIC_APP_ENV) => appEnv !== "production"

/** The local storage key Shift+D leaves the flag in */
export const DEBUG_STORAGE_KEY = "game:debug"

/** The tools are asked for: `?debug` in the address, or the flag that Shift+D left in the storage. Never in production */
export const debugAsked = ({ allowed, search, stored }: { allowed: boolean; search: string; stored: string | null }) =>
  allowed && (new URLSearchParams(search).has("debug") || stored === "1")

/** The tools load without being asked for: a development build loads them on its own, any other build once they are asked for. Never in production */
export const debugLoadsAlone = ({ allowed, nodeEnv, asked }: { allowed: boolean; nodeEnv: string | undefined; asked: boolean }) => allowed && (nodeEnv !== "production" || asked)

/** A key press is the shortcut: Shift+D outside a field where the visitor types (a capital D in the chat or the feedback form is only a letter). Never in production */
export const debugKeyToggles = ({ allowed, shiftKey, key, inField }: { allowed: boolean; shiftKey: boolean; key: string; inField: boolean }) =>
  allowed && shiftKey && key.toLowerCase() === "d" && !inField
