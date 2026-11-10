import { ApiError, handle, readJson } from "../../../../../server/api"
import { parseCancelRequest } from "../../../../../lib/quick-play"
import { playCancel } from "../../../../../server/quick-play"
import { rateLimit } from "../../../../../server/rate-limit"

/**
 * `POST /api/hub/play/cancel`: the visitor stops looking. The body is `{ tables, mode?, waited? }` (`parseCancelRequest`): the tables the search sat them at, which they leave if they sit there still and it waits for players. The answer is `{ left }`, how many they left.
 */
export const POST = handle(async (request: Request) => {
  await rateLimit(null, request, "play")
  const input = parseCancelRequest(await readJson<unknown>(request))
  if (!input) throw new ApiError("INVALID_REQUEST")
  return playCancel(input)
})
