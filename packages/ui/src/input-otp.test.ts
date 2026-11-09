import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from "./platform/input-otp"

/** A code of `length` characters, as a form draws it: one group of slots. */
function render({ length = 6, ...props }: { length?: number } & Partial<React.ComponentProps<typeof InputOTP>> = {}): string {
  return renderToStaticMarkup(
    React.createElement(
      InputOTP,
      { maxLength: length, pattern: REGEXP_ONLY_DIGITS, "aria-label": "Confirmation code", ...props } as React.ComponentProps<typeof InputOTP>,
      React.createElement(
        InputOTPGroup,
        null,
        Array.from({ length }, (_, index) => React.createElement(InputOTPSlot, { key: index, index })),
      ),
    ),
  )
}

const inputOf = (html: string) => /<input[^>]*>/.exec(html)?.[0] ?? ""
const slotsOf = (html: string) => html.match(/<div data-slot="input-otp-slot"[^>]*>[^<]*(?:<div[^>]*><div[^>]*><\/div><\/div>)?<\/div>/g) ?? []

describe("InputOTP", () => {
  it("is one real input under the slots, for a code that is typed, pasted or filled in", () => {
    const html = render()
    expect(html.match(/<input/g)).toHaveLength(1)
    const input = inputOf(html)
    expect(input).toContain('autoComplete="one-time-code"')
    expect(input).toContain('inputMode="numeric"')
    expect(input).toContain('maxLength="6"')
    expect(input).toContain('pattern="^\\d+$"')
  })

  it("draws a slot for each character of the code", () => {
    expect(slotsOf(render())).toHaveLength(6)
    expect(slotsOf(render({ length: 4 }))).toHaveLength(4)
  })

  it("names the input, which is all a screen reader has of a row of boxes", () => {
    expect(inputOf(render())).toContain('aria-label="Confirmation code"')
    expect(inputOf(render({ id: "signup-code" }))).toContain('id="signup-code"')
  })

  it("writes the characters of the value in the slots, in order, and leaves the rest empty", () => {
    const slots = slotsOf(render({ value: "123" })).map((slot) => />([^<]*)(?:<div|<\/div>)/.exec(slot)?.[1])
    expect(slots).toEqual(["1", "2", "3", "", "", ""])
  })

  it("has no slot of the colour of an error when the code is not marked invalid", () => {
    const html = render({ value: "12" })
    expect(html).not.toContain("data-invalid")
    expect(html).not.toContain("border-destructive")
  })

  it("turns the slots red when the code is invalid, and marks the input", () => {
    const html = render({ value: "123456", "aria-invalid": true })
    expect(inputOf(html)).toContain('aria-invalid="true"')
    const slots = slotsOf(html)
    expect(slots).toHaveLength(6)
    for (const slot of slots) {
      expect(slot).toContain('data-invalid="true"')
      expect(slot).toContain("border-destructive/50")
    }
  })

  it("disables the input, and the whole row goes half transparent", () => {
    const html = render({ disabled: true })
    expect(inputOf(html)).toContain('disabled=""')
    expect(html).toContain("has-disabled:opacity-50")
  })

  it("is masked in session recordings: the digits are text in the slots, which the masking of inputs does not reach", () => {
    expect(render({ value: "123456" })).toMatch(/data-input-otp-container="true"[^>]*class="[^"]*\bph-mask\b/)
  })

  it("keeps the classes it is given for the row and for the slots", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        InputOTP,
        { maxLength: 2, containerClassName: "w-full" } as React.ComponentProps<typeof InputOTP>,
        React.createElement(InputOTPGroup, { className: "w-full" }, React.createElement(InputOTPSlot, { index: 0, className: "flex-1" }), React.createElement(InputOTPSlot, { index: 1, className: "flex-1" })),
      ),
    )
    expect(html).toMatch(/data-input-otp-container="true"[^>]*class="[^"]*w-full/)
    expect(html).toMatch(/data-slot="input-otp-group" class="[^"]*w-full/)
    expect(slotsOf(html).every((slot) => slot.includes("flex-1"))).toBe(true)
  })
})
