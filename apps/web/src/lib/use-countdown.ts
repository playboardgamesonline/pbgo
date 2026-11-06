"use client"

import { useEffect, useState } from "react"
import { secondsLeft } from "@pbgo/accounts"

/**
 * A countdown that a press starts (`start`, in seconds), for the button that asks for another code. It counts to a time and not by the ticks of a timer, which a tab in the background slows down, so it is right when the visitor
 * comes back: `left` is the seconds to go, 0 before it starts and once it is over.
 */
export function useCountdown(): [left: number, start: (seconds: number) => void] {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (until === 0) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= until) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [until])
  const start = (seconds: number) => {
    const current = Date.now()
    setNow(current)
    setUntil(current + seconds * 1000)
  }
  return [secondsLeft(until, now), start]
}
