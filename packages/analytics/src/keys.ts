/**
 * What the browser SDK leaves on a device once it was allowed to store anything (localStorage, sessionStorage, a cookie): its
 * identifier, the properties it registers, the window and session ids. Every name carries this project's key, either as
 * `ph_<key>…` or as `__ph_opt_in_out_<key>`, so a PostHog of another project on the same origin is never touched.
 *
 * The visitor's answer to the banner (`CONSENT_KEY`) is not one of them: it has to survive a refusal, it is how the refusal is
 * remembered.
 */
export function isPostHogKey(name: string, key: string): boolean {
  return name.startsWith(`ph_${key}`) || name.startsWith(`__ph_opt_in_out_${key}`)
}

/** A place the SDK stores things in: `localStorage`, `sessionStorage` or the cookies. */
export type StorageArea = {
  /** Every name in it, as a list taken before anything is removed. */
  names(): string[]
  remove(name: string): void
}

/** Removes what the SDK left in each area. An area that refuses (private window, blocked site data) has nothing of ours in it. */
export function clearPostHogKeys(key: string, areas: StorageArea[]): void {
  for (const area of areas) {
    let names: string[]
    try {
      names = area.names()
    } catch {
      continue
    }
    for (const name of names) {
      if (!isPostHogKey(name, key)) continue
      try {
        area.remove(name)
      } catch {
        // One name that stays does not keep the others.
      }
    }
  }
}
