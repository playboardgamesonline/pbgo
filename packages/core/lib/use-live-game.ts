"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiClientError, api } from "./api"
import type { PublicGame } from "./game-types"
import { subscribeToGame } from "./realtime"

export function useLiveGame(code: string) {
  const [game, setGame] = useState<PublicGame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const version = useRef(-1)

  const apply = useCallback((p: PublicGame) => {
    if (p.version < version.current) return
    version.current = p.version
    setGame(p)
  }, [])

  const reload = useCallback(async () => {
    try {
      apply(await api.read(code))
      setError(null)
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === "GAME_NOT_FOUND" || e.code === "INVALID_CODE")) setError(e.code)
    }
  }, [code, apply])

  useEffect(() => {
    void Promise.resolve().then(reload)
    const stop = subscribeToGame(code, (v) => {
      if (v > version.current) reload()
    })
    const poll = setInterval(reload, 8000)
    const onFocus = () => reload()
    window.addEventListener("focus", onFocus)
    return () => {
      stop()
      clearInterval(poll)
      window.removeEventListener("focus", onFocus)
    }
  }, [code, reload])

  return { game, error, apply, reload }
}
