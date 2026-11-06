"use client"

import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from "@pbgo/ui/platform/input-otp"

/** A code of six digits, typed in the slots, and the same code marked invalid. */
export function CodeSpecimen() {
  return (
    <div className="flex flex-col gap-4">
      <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} aria-label="Confirmation code">
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} defaultValue="123456" aria-label="Confirmation code, invalid" aria-invalid>
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}
