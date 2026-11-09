"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { cn } from "../utils"

/** What a code may be made of, for `pattern`: digits alone, or digits and letters. The input under the slots refuses anything else, typed or pasted. Read them in a client component, as the form of a code is: from a server component they are references to this module, not the strings. */
export { REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"

/** Whether the code is marked invalid: `InputOTP` says it to its slots, which cannot read the attribute of the input under them. */
const InvalidContext = React.createContext(false)

/**
 * A code typed one character at a time, with a slot drawn for each (`maxLength`): the confirmation code of an e-mail, six digits. It is one real input under the slots, so a code pasted or filled in from a message
 * lands in all of them, the keyboard of a phone is the right one (`inputMode`, `pattern`) and `onComplete` fires with the last character. Name the input with `aria-label`; `aria-invalid` turns the slots red.
 */
function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  return (
    <InvalidContext.Provider value={invalid}>
      <OTPInput
        data-slot="input-otp"
        // The digits are text in the slots, which the masking of inputs in recordings does not reach (`ph-mask` does: a one-time code is a secret for as long as it is good)
        containerClassName={cn("ph-mask flex items-center gap-2 has-disabled:opacity-50", containerClassName)}
        className={cn("disabled:cursor-not-allowed", className)}
        {...props}
      />
    </InvalidContext.Provider>
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className={cn("flex items-center gap-2", className)} {...props} />
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const invalid = React.useContext(InvalidContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      data-invalid={invalid || undefined}
      className={cn(
        "bg-input/50 text-foreground relative flex h-12 w-10 items-center justify-center rounded-xl border text-xl transition-[color,box-shadow,background-color] outline-none",
        // Decided here and not by the cascade: an active slot of a code that is invalid is red, not the colour of the focus
        invalid ? "border-destructive/50 ring-destructive/40 z-10 ring-3" : isActive ? "border-ring ring-ring/30 z-10 ring-3" : "border-transparent",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="bg-foreground h-5 w-px animate-pulse" />
        </div>
      )}
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot }
