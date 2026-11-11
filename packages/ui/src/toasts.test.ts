import { describe, expect, it } from "vitest"
import { TOAST_DURATION, toastDuration, withToastDefaults } from "./toasts"

describe("toastDuration", () => {
  it("keeps a warning and an error longer than a confirmation", () => {
    expect(toastDuration("success")).toBe(TOAST_DURATION.quick)
    expect(toastDuration("info")).toBe(TOAST_DURATION.quick)
    expect(toastDuration("message")).toBe(TOAST_DURATION.quick)
    expect(toastDuration("warning")).toBe(TOAST_DURATION.careful)
    expect(toastDuration("error")).toBe(TOAST_DURATION.careful)
    expect(TOAST_DURATION.careful).toBeGreaterThan(TOAST_DURATION.quick)
  })

  it("adds the time to read a second line", () => {
    expect(toastDuration("success", true)).toBe(TOAST_DURATION.quick + TOAST_DURATION.description)
    expect(toastDuration("error", true)).toBe(TOAST_DURATION.careful + TOAST_DURATION.description)
  })

  it("leaves the buttons of a toast that asks for an answer the longest time", () => {
    expect(TOAST_DURATION.request).toBeGreaterThan(toastDuration("error", true))
  })
})

describe("withToastDefaults", () => {
  it("gives a toast the duration of its kind", () => {
    expect(withToastDefaults("success").duration).toBe(TOAST_DURATION.quick)
    expect(withToastDefaults("error", { description: "Try again later" }).duration).toBe(TOAST_DURATION.careful + TOAST_DURATION.description)
  })

  it("keeps a duration the caller gave", () => {
    expect(withToastDefaults("error", { duration: 1_000 }).duration).toBe(1_000)
  })

  it("keeps the other options as they are", () => {
    const action = { label: "Sign in", onClick: () => {} }
    expect(withToastDefaults("error", { description: "Try again", action })).toMatchObject({ action, description: "Try again" })
  })

  it("keeps a fixed toast until it is closed, and gives it the cross that closes it", () => {
    const options = withToastDefaults("info", { fixed: true })
    expect(options.duration).toBe(Number.POSITIVE_INFINITY)
    expect(options.closeButton).toBe(true)
  })

  it("never tells sonner about `fixed`", () => {
    expect("fixed" in withToastDefaults("info", { fixed: true })).toBe(false)
    expect("fixed" in withToastDefaults("info", { fixed: false })).toBe(false)
  })

  it("keeps the cross of a fixed toast whatever was asked, and a duration it was given is not kept", () => {
    const options = withToastDefaults("info", { fixed: true, closeButton: false, duration: 1_000 })
    expect(options.closeButton).toBe(true)
    expect(options.duration).toBe(Number.POSITIVE_INFINITY)
  })

  it("is a plain toast for `fixed: false`, with no cross of its own", () => {
    const options = withToastDefaults("info", { fixed: false })
    expect(options.duration).toBe(TOAST_DURATION.quick)
    expect("closeButton" in options).toBe(false)
  })
})
