import { ApiError, handle, readJson } from "../../../../server/api"
import { parsePlayRequest } from "../../../../lib/quick-play"
import { playSearch, type PlayDeps } from "../../../../server/quick-play"
import { rateLimit } from "../../../../server/rate-limit"

/**
 * `POST /api/hub/play` (PLT-21, phase C): the visitor presses Play, or, while their search lasts, asks again. The body is `{ games, mode, nickname?, poll?, waited? }` (`parsePlayRequest`): the slugs of the games they look for (ten at the most), `normal` or
 * `ranked`, and, for a guest, the nickname they sit down under. The answer is `{ tables }`, the table they sit at for each game (`PlayState`). It belongs to no game: the app hands in the games, the age they ask and their helpers (`PlayDeps`), which core cannot read.
 * Anybody may look for a normal table, a guest included (they sit down under their nickname); a ranked table is for members (403 `RANKED_MEMBERS_ONLY`). See `server/quick-play.ts` for what a search does.
 */
export const postPlay = (deps: PlayDeps) =>
  handle(async (request: Request) => {
    await rateLimit(null, request, "play")
    const input = parsePlayRequest(await readJson<unknown>(request))
    if (!input) throw new ApiError("INVALID_REQUEST")
    return playSearch(deps, request, input)
  })
