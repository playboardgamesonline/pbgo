import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PasswordInput } from "./platform/password-input"

function render(props: React.ComponentProps<typeof PasswordInput> = {}): string {
  return renderToStaticMarkup(React.createElement(PasswordInput, props))
}

/** The one `<input>` of the field and the one `<button>` at its end, as tags. */
const inputOf = (html: string) => /<input[^>]*>/.exec(html)?.[0] ?? ""
const buttonOf = (html: string) => /<button[^>]*>/.exec(html)?.[0] ?? ""

describe("PasswordInput", () => {
  it("hides what is typed to begin with", () => {
    const html = render()
    expect(inputOf(html)).toContain('type="password"')
    expect(html.match(/<input/g)).toHaveLength(1)
  })

  it("has a button after the input that offers to show the password, and that never submits the form", () => {
    const html = render()
    const button = buttonOf(html)
    expect(button).toContain('aria-label="Show password"')
    expect(button).toContain('type="button"')
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf("<button"))
  })

  it("can open showing the password, and then the button offers to hide it", () => {
    const html = render({ defaultShown: true })
    expect(inputOf(html)).toContain('type="text"')
    expect(buttonOf(html)).toContain('aria-label="Hide password"')
  })

  it("draws an icon in the button, which a screen reader skips since the button has a name", () => {
    expect(render()).toMatch(/<button[^>]*><svg[^>]*aria-hidden="true"/)
  })

  it("gives the props of an input to the input, so that a label, a password manager and the form find it", () => {
    const input = inputOf(render({ id: "signup-password", name: "password", autoComplete: "new-password", required: true, minLength: 8, "aria-invalid": true }))
    expect(input).toContain('id="signup-password"')
    expect(input).toContain('name="password"')
    expect(input).toContain('autoComplete="new-password"')
    expect(input).toContain('required=""')
    expect(input).toContain('minLength="8"')
    expect(input).toContain('aria-invalid="true"')
  })

  it("keeps the class for the whole field, not for the input", () => {
    const html = render({ className: "max-w-sm" })
    expect(html).toMatch(/^<div[^>]*role="group"[^>]*max-w-sm/)
    expect(inputOf(html)).not.toContain("max-w-sm")
  })

  it("disables the button with the input", () => {
    const html = render({ disabled: true })
    expect(inputOf(html)).toContain('disabled=""')
    expect(buttonOf(html)).toContain('disabled=""')
  })

  it("leaves both enabled otherwise", () => {
    const html = render()
    expect(inputOf(html)).not.toContain('disabled=""')
    expect(buttonOf(html)).not.toContain('disabled=""')
  })
})
