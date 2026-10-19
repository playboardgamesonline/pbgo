import { CONFIG } from "./config"
import { createDriver } from "./driver"
import { clearPostHogKeys, type StorageArea } from "./keys"

/**
 * `localStorage` or `sessionStorage` as a `StorageArea`. Even reading the global can throw (blocked site data), so `pick` is
 * only called inside the methods, where `clearPostHogKeys` catches.
 */
function webStorage(pick: () => Storage): StorageArea {
  return {
    names() {
      const storage = pick()
      const names: string[] = []
      for (let index = 0; index < storage.length; index++) {
        const name = storage.key(index)
        if (name !== null) names.push(name)
      }
      return names
    },
    remove: (name) => pick().removeItem(name),
  }
}

/** The SDK sets its cookie on the path `/` and, with `cross_subdomain_cookie: false`, on no domain: the same path removes it. */
const cookies: StorageArea = {
  names: () =>
    document.cookie
      .split(";")
      .map((part) => part.split("=")[0]?.trim() ?? "")
      .filter((name) => name !== ""),
  remove(name) {
    document.cookie = `${name}=; Max-Age=0; Path=/`
  },
}

const driver = createDriver({
  config: CONFIG,
  pathname: () => (typeof window === "undefined" ? null : window.location.pathname),
  // Loaded when the first answer is known, never with the page: a visitor who is not asked (the gamemaster) never downloads it.
  load: () => import("posthog-js").then((module) => module.default),
  forget: (config) =>
    clearPostHogKeys(config.key, [webStorage(() => localStorage), webStorage(() => sessionStorage), cookies]),
  // A blocked script or a refused storage is the visitor's choice of browser: nothing to report in production.
  warn(error) {
    if (process.env.NODE_ENV !== "production") console.warn("[analytics]", error)
  },
})

/** Follows the answer to the banner (null: not answered yet). */
export const syncConsent = driver.sync

/** Sends a browser event; before consent it carries no identifier that outlives the page. */
export const trackClient = driver.track

/** Ties the visitor to the player they are at this table, once they accepted. */
export const identifyPlayer = driver.identify
