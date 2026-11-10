"use client"

import { useEffect, useState } from "react"

/**
 * A button that copies something: by default the address of the sign-in, which is what invites a friend (`copy`: a friend can come and sign in on it), or the `text` it is given (the setup key of the second step), and for two seconds
 * after it did `copied` is true, so that the button can say so.
 */
export function useCopied(text?: string): [copied: boolean, copy: () => void] {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return [
    copied,
    () => {
      navigator.clipboard?.writeText(text ?? `${window.location.origin}/login`).then(() => setCopied(true), () => {})
    },
  ]
}
