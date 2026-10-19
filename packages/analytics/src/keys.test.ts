import { describe, expect, it } from "vitest"
import { CONSENT_KEY } from "./consent"
import { clearPostHogKeys, isPostHogKey, type StorageArea } from "./keys"

const KEY = "phc_abc123"

describe("isPostHogKey", () => {
  it("recognises what the SDK stores for this project", () => {
    for (const name of [
      `ph_${KEY}_posthog`,
      `ph_${KEY}_window_id`,
      `ph_${KEY}_primary_window_exists`,
      `__ph_opt_in_out_${KEY}`,
    ]) {
      expect(isPostHogKey(name, KEY), name).toBe(true)
    }
  })

  it("leaves every other name alone, the answer to the banner included", () => {
    for (const name of [CONSENT_KEY, "pbgo-locale", "ph_phc_other_posthog", "__ph_opt_in_out_phc_other", "hanabi_player", KEY, ""]) {
      expect(isPostHogKey(name, KEY), name).toBe(false)
    }
  })
})

function area(initial: string[]): StorageArea & { left(): string[] } {
  const names = new Set(initial)
  return {
    names: () => [...names],
    remove: (name) => void names.delete(name),
    left: () => [...names],
  }
}

describe("clearPostHogKeys", () => {
  it("removes the names of this project in every area and nothing else", () => {
    const local = area([`ph_${KEY}_posthog`, CONSENT_KEY, "ph_phc_other_posthog"])
    const session = area([`ph_${KEY}_window_id`, `ph_${KEY}_primary_window_exists`, "unrelated"])
    const cookies = area([`ph_${KEY}_posthog`, "pbgo-locale", "hanabi_player"])
    clearPostHogKeys(KEY, [local, session, cookies])
    expect(local.left()).toEqual([CONSENT_KEY, "ph_phc_other_posthog"])
    expect(session.left()).toEqual(["unrelated"])
    expect(cookies.left()).toEqual(["pbgo-locale", "hanabi_player"])
  })

  it("keeps going when an area refuses", () => {
    const refusing: StorageArea = {
      names() {
        throw new Error("SecurityError")
      },
      remove() {},
    }
    const cookies = area([`ph_${KEY}_posthog`])
    expect(() => clearPostHogKeys(KEY, [refusing, cookies])).not.toThrow()
    expect(cookies.left()).toEqual([])
  })

  it("keeps going when a name cannot be removed", () => {
    const names = [`ph_${KEY}_a`, `ph_${KEY}_b`]
    const removed: string[] = []
    const stubborn: StorageArea = {
      names: () => names,
      remove(name) {
        removed.push(name)
        throw new Error("QuotaExceededError")
      },
    }
    const cookies = area([`ph_${KEY}_posthog`])
    expect(() => clearPostHogKeys(KEY, [stubborn, cookies])).not.toThrow()
    expect(removed).toEqual([`ph_${KEY}_a`, `ph_${KEY}_b`])
    expect(cookies.left()).toEqual([])
  })
})
