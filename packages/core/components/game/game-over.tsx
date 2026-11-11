"use client"

import type { PlayerResult } from "@pbgo/engine-kit"
import { CrownIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { cn } from "@pbgo/ui/utils"
import { useApi, useBinding } from "../../lib/binding-context"
import { endingOf, placesOf, summaryOf, type GameOverEntry } from "../../lib/game-over"
import type { PublicGame } from "../../lib/game-types"
import { rematchOf } from "../../lib/rematch"
import { gameOverTheme } from "../../lib/ui-theme"
import { useMotion } from "../../lib/use-motion"
import { useSiteSettings } from "../settings-provider"
import { useSkin, useText } from "../skin-provider"
import { useContinue } from "./continue-context"
import { useGame } from "./context"
import { GameOverCard, type ResultDetailRenderer } from "./game-over-card"
import { HostIcon } from "./host-icon"
import { SharePreview } from "./preview-sharing"
import { useSeatTheme } from "./seat-label"
import { generateShareImage, type ShareRow } from "./sharing"
import { useRankChange } from "./use-rank-change"
import { useRematchToasts } from "./use-rematch-toasts"

export type { GameOverCardProps, ResultDetailRenderer } from "./game-over-card"
export { winnerAnnouncement } from "../../lib/game-over"

/**
 * The end screen of a game, in the game's look (`GameOverCard`, dressed by `UI_THEME.gameOver` and `UI_THEME.seat` and the skin: its crown and its pattern): centered on the screen, over the board with no veil around it, it puts the players on a podium, says how the game ended for
 * the visitor, and has the two buttons that go on from it. "Continue" leaves the finished table and goes on to the platform (`useContinue`: `GameClient` owns where). "Rematch" votes for another game at the same table (`POST …/replay`) and says how many of the
 * players still there agreed; when somebody else asks first, a toast of the game has the button that agrees (`useRematchToasts`). A member of a table that counted for the rank sees the rank points the game gave or took (`useRankChange`). The share thumbnail is the share button's, drawn in the background.
 * `renderDetail`: the game's own rendering of a player's score breakdown (default: `label +n` chips). The table that lost together has no winner: the card says "Defeat".
 */
export function GameOver({ onUpdate, renderDetail }: { onUpdate: (p: PublicGame) => void; renderDetail?: ResultDetailRenderer }) {
  const t = useText()
  const { GAME, SLUG, UI_THEME } = useBinding()
  const api = useApi()
  const { hostIcon, decor, locale } = useSkin()
  const seat = useSeatTheme()
  const theme = useMemo(() => gameOverTheme(UI_THEME?.gameOver), [UI_THEME?.gameOver])
  const { view, game, nickname, color, avatarUrl } = useGame()
  const { title } = useSiteSettings()
  const mode = useMotion()
  const goOn = useContinue()
  const [voting, setVoting] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)
  const results = game.status === "over" ? view.results : null
  const lost = !!results && endingOf(results) === "defeat"
  const me = game.players.find((player) => player.id === game.meId)
  const rematch = rematchOf(game.players, game.replay, game.meId, GAME?.minPlayers ?? 1)
  // A guest has no rank to move: only a member asks for the points
  const rank = useRankChange(game.code, !!results && !!me?.tag)

  const resultsKey = results ? `${game.code}|${results.coop ?? ""}|${results.winners.join()}|${results.players.map((j) => `${j.playerId}:${j.total}`).join()}` : null
  useEffect(() => {
    if (!results) return
    let cancelled = false
    const lines: ShareRow[] = [...results.players]
      .sort((a, b) => a.rank - b.rank)
      .map((j) => ({
        rank: j.rank,
        nickname: game.players.find((x) => x.id === j.playerId)?.nickname ?? "?",
        color: color(j.playerId),
        total: j.total,
        winner: results.winners.includes(j.playerId),
      }))
    const timer = setTimeout(() => {
      generateShareImage(lines, SLUG, game.code, title, locale, t, lost)
        .then((f) => !cancelled && setImage(f))
        .catch(() => !cancelled && toast.error(t("imageError")))
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey, locale])

  /** Votes for another game: whether it went through (a vote that is refused says why, in a toast, and the button can be pressed again). */
  async function vote(): Promise<boolean> {
    setVoting(true)
    try {
      onUpdate(await api.replay(game.code))
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    } finally {
      setVoting(false)
    }
  }
  useRematchToasts(game, rematch.mine, vote)

  if (!results) return null
  const entry = (result: PlayerResult): GameOverEntry => ({ result, nickname: nickname(result.playerId), color: color(result.playerId), imageUrl: avatarUrl(result.playerId) })
  // Players who share a rank share a place on the podium (a tie, the members of a team); a table that plays together has one place
  const places = placesOf(results).map((place) => ({ rank: place.rank, entries: place.results.map(entry) }))
  // A table that lost together has no winner to name: the text names the whole table
  const names = (lost ? results.players : results.players.filter((v) => results.winners.includes(v.playerId))).map((v) => nickname(v.playerId)).join(" & ")
  const points = (lost ? results.players[0]?.total : results.players.find((v) => results.winners.includes(v.playerId))?.total) ?? 0
  const shareText = lost ? t("lostWith", { names, points }) : t("winsWith", { names, points })

  return (
    <>
      <SharePreview file={preview ? image : null} text={shareText} onClose={() => setPreview(false)} />
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6 short:p-3">
        <GameOverCard
          theme={theme}
          seat={seat}
          pattern={decor.pattern}
          crown={(size) =>
            hostIcon ? <HostIcon className={cn("inline-block shrink-0 bg-current", size)} /> : <CrownIcon aria-hidden className={cn("fill-current text-current", size)} />
          }
          summary={summaryOf(results, game.meId)}
          places={places}
          winners={results.winners}
          together={results.coop}
          meId={game.meId}
          rank={rank}
          rematch={rematch}
          voting={voting}
          onRematch={() => void vote()}
          onContinue={goOn ?? undefined}
          onShare={image ? () => setPreview(true) : undefined}
          renderDetail={renderDetail}
          motion={mode}
        />
      </div>
    </>
  )
}
