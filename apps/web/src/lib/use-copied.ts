"use client"

import { useEffect, useState } from "react"

/**
 * The button that invites a friend: it copies the address of the sign-in, which a friend can come and sign in on (`copy`), and for two seconds after it did
 * `copied` is true, so that the button can say so.
 */
export function useCopied(): [copied: boolean, copy: () => void] {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return [
    copied,
    () => {
      navigator.clipboard?.writeText(`${window.location.origin}/login`).then(() => setCopied(true), () => {})
    },
  ]
}
