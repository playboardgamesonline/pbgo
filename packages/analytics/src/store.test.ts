import { describe, expect, it, vi } from "vitest"
import { CONSENT_KEY, type ConsentStore } from "./consent"
import { createConsentStore, SERVER_SNAPSHOT, type StoreEnv } from "./store"

const NOW = new Date("2026-10-13T09:00:00.000Z")

function memoryStorage(initial: Record<string, string> = {}): ConsentStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

function setup(options: { storage?: ConsentStore | null } = {}) {
  const storage = options.storage === undefined ? memoryStorage() : options.storage
  const stop = vi.fn()
  let notifyOtherTab = () => {}
  const env: StoreEnv = {
    storage: () => storage,
    onOtherTab: (callback) => {
      notifyOtherTab = callback
      return stop
    },
    now: () => NOW,
  }
  const store = createConsentStore(env)
  return { store, storage, stop, otherTab: () => notifyOtherTab() }
}

const stored = (choice: string, at: string) => ({ [CONSENT_KEY]: JSON.stringify({ choice, at }) })

describe("consent store", () => {
  it("knows nothing on the server", () => {
    const { store } = setup()
    expect(store.getServerSnapshot()).toBe(SERVER_SNAPSHOT)
    expect(SERVER_SNAPSHOT).toEqual({ ready: false, consent: null, open: false })
  })

  it("asks the question when nothing was answered", () => {
    const { store } = setup()
    expect(store.getSnapshot()).toEqual({ ready: true, consent: null, open: true })
  })

  it("stays closed on a stored answer that still counts", () => {
    const { store } = setup({ storage: memoryStorage(stored("accepted", "2026-06-01T00:00:00.000Z")) })
    expect(store.getSnapshot()).toEqual({
      ready: true,
      consent: { choice: "accepted", at: "2026-06-01T00:00:00.000Z" },
      open: false,
    })
  })

  it("asks again once the answer is older than the renewal delay", () => {
    const { store } = setup({ storage: memoryStorage(stored("accepted", "2025-01-01T00:00:00.000Z")) })
    expect(store.getSnapshot()).toEqual({ ready: true, consent: null, open: true })
  })

  it("hands back the same object until something changes", () => {
    const { store } = setup()
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })

  it("treats a browser without storage as an empty one", () => {
    const { store } = setup({ storage: null })
    expect(store.getSnapshot()).toEqual({ ready: true, consent: null, open: true })
  })

  it("treats a storage that throws as an empty one", () => {
    const storage: ConsentStore = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    }
    const { store } = setup({ storage })
    expect(store.getSnapshot().consent).toBeNull()
  })

  describe("choose", () => {
    it("stores the dated answer, closes the banner and tells the subscribers once", () => {
      const { store, storage } = setup()
      const listener = vi.fn()
      store.subscribe(listener)
      store.getSnapshot()
      const consent = store.choose("refused")
      expect(consent).toEqual({ choice: "refused", at: NOW.toISOString() })
      expect(JSON.parse((storage as ReturnType<typeof memoryStorage>).data[CONSENT_KEY])).toEqual(consent)
      expect(store.getSnapshot()).toEqual({ ready: true, consent, open: false })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it("keeps the answer of a visitor who allowed the analytics only, and gives it back on the next visit", () => {
      const { store, storage } = setup()
      store.getSnapshot()
      expect(store.choose("analytics")).toEqual({ choice: "analytics", at: NOW.toISOString() })
      expect(setup({ storage }).store.getSnapshot()).toMatchObject({ open: false, consent: { choice: "analytics" } })
    })

    it("closes a reopened banner", () => {
      const { store } = setup({ storage: memoryStorage(stored("accepted", "2026-06-01T00:00:00.000Z")) })
      store.reopen()
      expect(store.getSnapshot().open).toBe(true)
      store.choose("refused")
      expect(store.getSnapshot()).toMatchObject({ open: false, consent: { choice: "refused" } })
    })

    it("keeps the answer for the page view when the storage refuses it", () => {
      const storage: ConsentStore = { getItem: () => null, setItem: () => { throw new Error("full") }, removeItem: () => {} }
      const { store } = setup({ storage })
      store.getSnapshot()
      store.choose("accepted")
      expect(store.getSnapshot()).toMatchObject({ open: false, consent: { choice: "accepted" } })
    })

    it("keeps the answer for the page view when there is no storage at all", () => {
      const { store } = setup({ storage: null })
      store.getSnapshot()
      store.choose("refused")
      expect(store.getSnapshot()).toMatchObject({ open: false, consent: { choice: "refused" } })
    })
  })

  describe("reopen and dismiss", () => {
    it("shows the banner again without touching the answer, then hides it", () => {
      const { store } = setup({ storage: memoryStorage(stored("accepted", "2026-06-01T00:00:00.000Z")) })
      const listener = vi.fn()
      store.subscribe(listener)
      expect(store.getSnapshot().open).toBe(false)
      store.reopen()
      expect(store.getSnapshot()).toMatchObject({ open: true, consent: { choice: "accepted" } })
      store.dismiss()
      expect(store.getSnapshot()).toMatchObject({ open: false, consent: { choice: "accepted" } })
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it("does not notify when nothing changes", () => {
      const { store } = setup()
      const listener = vi.fn()
      store.subscribe(listener)
      store.getSnapshot()
      store.dismiss()
      store.reopen()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe("other tabs", () => {
    it("follows an answer given in another tab", () => {
      const { store, storage, otherTab } = setup()
      const listener = vi.fn()
      store.subscribe(listener)
      expect(store.getSnapshot().open).toBe(true)
      ;(storage as ReturnType<typeof memoryStorage>).data[CONSENT_KEY] = JSON.stringify({
        choice: "accepted",
        at: NOW.toISOString(),
      })
      otherTab()
      expect(store.getSnapshot()).toMatchObject({ open: false, consent: { choice: "accepted" } })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it("lets the other tab win over this tab's own earlier answer", () => {
      const { store, storage, otherTab } = setup()
      store.subscribe(() => {})
      store.choose("accepted")
      ;(storage as ReturnType<typeof memoryStorage>).data[CONSENT_KEY] = JSON.stringify({
        choice: "refused",
        at: "2026-10-13T09:30:00.000Z",
      })
      otherTab()
      expect(store.getSnapshot().consent).toEqual({ choice: "refused", at: "2026-10-13T09:30:00.000Z" })
    })

    it("listens only while someone subscribes", () => {
      const { store, stop } = setup()
      const first = store.subscribe(() => {})
      const second = store.subscribe(() => {})
      first()
      expect(stop).not.toHaveBeenCalled()
      second()
      expect(stop).toHaveBeenCalledTimes(1)
    })
  })
})
