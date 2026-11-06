"use client"

import * as React from "react"
import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group"

/**
 * A password field: an input with a button at its end that shows what is typed or hides it again, for a long password or a small keyboard. It takes the props of an input but for its type, which is the button's to
 * change (`defaultShown` opens it showing the password); `className` is for the whole field, and `aria-invalid` turns all of it red, button included.
 */
function PasswordInput({
  className,
  defaultShown = false,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  defaultShown?: boolean
}) {
  const [shown, setShown] = React.useState(defaultShown)
  const label = shown ? "Hide password" : "Show password"
  return (
    <InputGroup className={className}>
      <InputGroupInput type={shown ? "text" : "password"} disabled={disabled} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label={label} title={label} disabled={disabled} onClick={() => setShown((value) => !value)}>
          <HugeiconsIcon icon={shown ? ViewOffIcon : ViewIcon} strokeWidth={2} aria-hidden="true" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export { PasswordInput }
