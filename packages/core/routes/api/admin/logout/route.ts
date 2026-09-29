import { logoutAdmin } from "../../../../server/admin"
import { handle } from "../../../../server/api"

export const POST = handle(async () => {
  await logoutAdmin()
  return { ok: true }
})
