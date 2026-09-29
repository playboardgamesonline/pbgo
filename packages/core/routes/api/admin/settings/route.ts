import type { SiteSettings } from "../../../../lib/settings"
import { requireAdmin } from "../../../../server/admin"
import { handle, readJson } from "../../../../server/api"
import { readSettingsFresh, saveSettings } from "../../../../server/settings"

export const GET = handle(async () => {
  await requireAdmin()
  return readSettingsFresh()
})

export const PUT = handle(async (request: Request) => {
  await requireAdmin()
  return saveSettings(await readJson<Partial<SiteSettings>>(request))
})
