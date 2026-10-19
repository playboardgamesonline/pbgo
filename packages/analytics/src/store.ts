import {
  CONSENT_KEY,
  makeConsent,
  readConsent,
  writeConsent,
  type Choice,
  type Consent,
  type ConsentStore,
} from "./consent"

/** What the banner and the browser client read. */
export type Snapshot = {
  /** False on the server and during hydration, true once the browser has read its storage: nothing is known before. */
  ready: boolean
  consent: Consent | null
  /** The banner shows: no answer yet, or the visitor reopened it from a "Cookies" link. */
  open: boolean
}

/** What the store needs from the page, so a test hands in plain objects instead of a window. */
export type StoreEnv = {
  /** The visitor's `localStorage`; null when the browser refuses it (private window, blocked site data). */
  storage(): ConsentStore | null
  /** Calls back when another tab changed the stored answer; returns the way to stop listening. */
  onOtherTab(callback: () => void): () => void
  now(): Date
}

/** The server never knows the answer: it renders no banner, and the client finds out after hydration. */
export const SERVER_SNAPSHOT: Snapshot = { ready: false, consent: null, open: false }

function same(a: Snapshot, b: Snapshot): boolean {
  return a.ready === b.ready && a.open === b.open && a.consent?.choice === b.consent?.choice && a.consent?.at === b.consent?.at
}

/**
 * The visitor's answer to the banner, shaped for `useSyncExternalStore`: the snapshot is a stable object that is only replaced
 * when something changed, and every change reaches the subscribers once.
 */
export function createConsentStore(env: StoreEnv) {
  let snapshot: Snapshot = SERVER_SNAPSHOT
  let loaded = false
  let reopened = false
  /** The answer of this page view when the storage refused to keep it, so the question does not come back at once. */
  let kept: Consent | null = null
  let stopListening: (() => void) | undefined
  const listeners = new Set<() => void>()

  function read(): Snapshot {
    const store = env.storage()
    const consent = kept ?? (store ? readConsent(store, env.now()) : null)
    return { ready: true, consent, open: consent === null || reopened }
  }

  function update(): void {
    const next = read()
    if (loaded && same(snapshot, next)) return
    loaded = true
    snapshot = next
    for (const listener of [...listeners]) listener()
  }

  return {
    /** Read from the storage on the first call only, then kept up to date by `choose`, `reopen`, `dismiss` and the other tabs. */
    getSnapshot(): Snapshot {
      if (!loaded) {
        loaded = true
        snapshot = read()
      }
      return snapshot
    },

    getServerSnapshot(): Snapshot {
      return SERVER_SNAPSHOT
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      if (listeners.size === 1) {
        stopListening = env.onOtherTab(() => {
          // Another tab answered: its storage is the truth now.
          kept = null
          update()
        })
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          stopListening?.()
          stopListening = undefined
        }
      }
    },

    /** Stores the answer, dated now, and closes the banner. */
    choose(choice: Choice): Consent {
      const store = env.storage()
      const consent = store ? writeConsent(store, choice, env.now()) : makeConsent(choice, env.now())
      kept = consent
      reopened = false
      update()
      return consent
    },

    /** Shows the banner again, from a "Cookies" link, whatever was answered. */
    reopen(): void {
      reopened = true
      update()
    },

    /** Closes a reopened banner without changing the answer. */
    dismiss(): void {
      reopened = false
      update()
    },
  }
}

export type ConsentStoreApi = ReturnType<typeof createConsentStore>

function browserStorage(): ConsentStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    // Reading `window.localStorage` itself throws when the site data is blocked.
    return null
  }
}

/** The one store of the page. Nothing here touches `window` before a component asks for the snapshot. */
export const consentStore: ConsentStoreApi = createConsentStore({
  storage: browserStorage,
  onOtherTab(callback) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CONSENT_KEY) callback()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  },
  now: () => new Date(),
})
