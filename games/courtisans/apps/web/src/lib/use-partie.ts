"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiClientError, api } from "./api"
import type { PartiePublique } from "./partie-types"
import { ecouterPartie } from "./realtime"

export function usePartie(code: string) {
  const [partie, setPartie] = useState<PartiePublique | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const version = useRef(-1)

  const appliquer = useCallback((p: PartiePublique) => {
    if (p.version < version.current) return
    version.current = p.version
    setPartie(p)
  }, [])

  const recharger = useCallback(async () => {
    try {
      appliquer(await api.lire(code))
      setErreur(null)
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === "PARTIE_INTROUVABLE" || e.code === "CODE_INVALIDE")) setErreur(e.code)
    }
  }, [code, appliquer])

  useEffect(() => {
    void Promise.resolve().then(recharger)
    const stop = ecouterPartie(code, (v) => {
      if (v > version.current) recharger()
    })
    const poll = setInterval(recharger, 8000)
    const onFocus = () => recharger()
    window.addEventListener("focus", onFocus)
    return () => {
      stop()
      clearInterval(poll)
      window.removeEventListener("focus", onFocus)
    }
  }, [code, recharger])

  return { partie, erreur, appliquer, recharger }
}
