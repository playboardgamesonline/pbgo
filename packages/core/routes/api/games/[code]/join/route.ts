import type { AgeRulesSource } from "../../../../../lib/age-rules"
import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { asksSomething } from "../../../../../lib/table-settings"
import { ageGateFor } from "../../../../../server/age-gate"
import { handle, readJson } from "../../../../../server/api"
import { normalizeCode } from "../../../../../server/code"
import { servedGame } from "../../../../../server/games"
import { getOrCreatePlayerId } from "../../../../../server/player"
import { type ProfileInput, resolveSeat } from "../../../../../server/profile"
import { rateLimit } from "../../../../../server/rate-limit"
import { joinTable, startWhenFull } from "../../../../../server/table-seat"
import { readTableSettingsOf, viewerFor } from "../../../../../server/table-settings"

/**
 * `POST /api/<slug>/games/<code>/join`: sits somebody down at a table that waits (`joinTable`). `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in): a table that asks for an age, by its game or by an expansion it
 * is played with, is not sat at by somebody who does not have it (`server/age-gate.ts`, PLT-125). A public table may ask for a minimum rank and a language, and a table may have been set for fewer seats than the game takes (`TableSettings`, PLT-21):
 * somebody who does not meet what it asks is refused (403 `RANK_TOO_LOW`, `LANGUAGE_MISMATCH`), and a table whose seats are all taken is full (409 `GAME_FULL`); a player who sits already is never asked again. A ranked table is for members and asks
 * their tier to be near the one it opened at (403 `RANKED_MEMBERS_ONLY`, `RANK_GAP`). The join that takes the last seat begins the game: a full table does not wait for its host (`startWhenFull`).
 */
export const postJoin = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game, params }: GameRouteContext) => {
    await rateLimit(game.slug, request, "join")
    const seat = await resolveSeat(await readJson<ProfileInput>(request))
    const { profile, memberId } = seat
    const id = await getOrCreatePlayerId(game.slug)
    const { maxPlayers } = await loadSettings(game)
    const gate = await ageGateFor(ageRules, game, seat)
    // What the host set for the table: its seats, and the rank and the language it asks of a public table. Who the visitor is for those is looked up only when it asks for something
    const settings = await readTableSettingsOf(game.slug, normalizeCode(params.code ?? ""))
    const viewer = asksSomething(settings) ? await viewerFor(game.slug, memberId, settings) : null
    const { row, added } = await joinTable(game, params.code ?? "", { id, profile, memberId }, { gate, maxPlayers, settings, viewer })
    // The seat that fills a table is the one that begins it
    return servedGame(game, added ? await startWhenFull(game, row, { id, actor: seat }, { ageRules, settings }) : row, id)
  })
