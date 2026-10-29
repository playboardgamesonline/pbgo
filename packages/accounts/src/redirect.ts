// Where a sign-in goes back to. The page that asked for it puts its own path in the link (`/login?next=/me/games`), and the callback of the provider
// brings it back: it is a value anyone can write into a link, so it is a path of this site or it is nothing (an open redirect would make the
// sign-in page a way to send a visitor, signed in, anywhere). Pure, so that the login page, the callback and the tests all read it the same way.

/** Where a visitor lands when nothing says where they came from: their own page. */
export const AFTER_SIGN_IN = "/me"

/** The paths that are the way in and out themselves: going back to one of them would loop. */
const SIGN_IN_PATHS = ["/login", "/logout", "/auth"]

/**
 * The path to go back to: `value` when it is a path of this site (it starts with a single slash, holds no backslash and no control character, and is
 * not the sign-in's own way), else `fallback`. A query string and a fragment are kept.
 */
export function safeNext(value: string | null | undefined, fallback: string = AFTER_SIGN_IN): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback
  const path = value.split(/[?#]/)[0] ?? value
  if (SIGN_IN_PATHS.some((own) => path === own || path.startsWith(`${own}/`))) return fallback
  return value
}
