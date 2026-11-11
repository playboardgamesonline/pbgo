"use client"

import { useEffect, useState } from "react"
import { useApi } from "../../lib/binding-context"
import { RANK_ASKS, type RankChange } from "../../lib/rank-change"

/**
 * What the game that has just ended did to the visitor's rank points, for the end screen. `active` is a member looking at a table that is over (a guest has no rank to move). The game is written down a moment after it ends, so the server says it
 * is not yet (`recorded` false) and this asks again, `RANK_ASKS.tries` times at most; a request that fails is asked again the same way and, once the tries are spent, leaves the end screen without the points. Null until it is known.
 */
export function useRankChange(code: string, active: boolean): RankChange | null {
  const api = useApi()
  const [change, setChange] = useState<RankChange | null>(null)

  useEffect(() => {
    if (!active) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const ask = async (attempt: number) => {
      let answer: RankChange | null = null
      try {
        answer = await api.rank(code)
      } catch {
        // Asked again below, or given up on: the end screen does not need the points
      }
      if (stopped) return
      if (answer) setChange(answer)
      if (answer?.recorded || attempt >= RANK_ASKS.tries) return
      timer = setTimeout(() => void ask(attempt + 1), RANK_ASKS.everyMs)
    }
    void ask(1)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [api, code, active])

  return active ? change : null
}
