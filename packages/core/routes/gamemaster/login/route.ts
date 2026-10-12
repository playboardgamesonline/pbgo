import { loginAdmin } from "../../../server/admin"
import { handle, readJson } from "../../../server/api"
import { rateLimit } from "../../../server/rate-limit"

export const POST = handle(async (request: Request) => {
  await rateLimit(null, request, "adminLogin")
  const body = await readJson<{ login?: unknown; password?: unknown }>(request)
  await loginAdmin(typeof body.login === "string" ? body.login.trim() : "", typeof body.password === "string" ? body.password : "")
  return { ok: true }
})
