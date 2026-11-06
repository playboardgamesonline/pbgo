"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiClientError } from "./api"
import { useApi, useGameSlug } from "./binding-context"
import type { PublicGame } from "./game-types"
import { subscribeToGame } from "./realtime"

export function useLiveGame(code: string) {
  const slug = useGameSlug()
  const api = useApi()
  const [game, setGame] = useState<PublicGame | null>(null)
  // When `game` arrived (`performance.now()`): the ready check's time left is a duration measured from then (`PublicGame.readyInMs`)
  const [receivedAt, setReceivedAt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const version = useRef(-1)

  const apply = useCallback((p: PublicGame) => {
    if (p.version < version.current) return
    version.current = p.version
    setGame(p)
    setReceivedAt(performance.now())
  }, [])

  const reload = useCallback(async () => {
    try {
      apply(await api.read(code))
      setError(null)
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === "GAME_NOT_FOUND" || e.code === "INVALID_CODE")) setError(e.code)
    }
  }, [api, code, apply])

  useEffect(() => {
    void Promise.resolve().then(reload)
    const stop = subscribeToGame(slug, code, (v) => {
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
  }, [slug, code, reload])

  return { game, receivedAt, error, apply, reload }
}
