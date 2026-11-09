import { birthdateProblem } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { ApiError, handle, readJson } from "../../../../server/api"
import { saveBirthdate } from "../../../../server/birthdate"
import { rateLimit } from "../../../../server/rate-limit"

/**
 * `POST /api/hub/birthdate`: a signed-in member declares their date of birth (`{ "birthdate": "YYYY-MM-DD" }`), for the games and expansions that ask for an age (PLT-125). It is not a game's route: the member is asked of Supabase Auth (`getAccount`), and a
 * visitor who is not signed in gets a 401. The date is judged here, on the server (`birthdateProblem`: a day that exists, not in the future, not more than 120 years ago, and the member old enough for the site), and kept where only the server reads it
 * (`member_birthdates`). It is declared once: an account that has one gets `BIRTHDATE_LOCKED`, and the date is never replaced, so that a refusal cannot be got round by declaring another. The demo account of development is in no database: its answer is
 * `saved` and nothing is written (the check counts it as an adult).
 */
export const POST = handle(async (request: Request) => {
  await rateLimit(null, request, "birthdate")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  const { birthdate } = await readJson<{ birthdate?: unknown }>(request)
  const problem = birthdateProblem(birthdate, new Date())
  if (problem === "invalid") throw new ApiError("BIRTHDATE_INVALID")
  if (problem === "under-minimum") throw new ApiError("BIRTHDATE_UNDER_MINIMUM")
  if (!isDemoAccount(account) && !(await saveBirthdate(account.id, birthdate as string))) throw new ApiError("BIRTHDATE_LOCKED", 409)
  return { saved: true }
})
