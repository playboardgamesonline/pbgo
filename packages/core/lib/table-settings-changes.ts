import type { TableSettingKey } from "@pbgo/analytics"
import type { TableSettingsInput } from "./table-settings"

/** The settings of a table that are not the same in two states of it, in the order the lobby shows them, named as the counts name them (`table_setting_changed`). */
export function changedSettings(before: TableSettingsInput, after: TableSettingsInput): TableSettingKey[] {
  const changed: TableSettingKey[] = []
  if (before.visibility !== after.visibility) changed.push("visibility")
  if (before.minRank !== after.minRank) changed.push("min_rank")
  if (before.language !== after.language) changed.push("language")
  if (before.pace !== after.pace) changed.push("pace")
  if (before.seats !== after.seats) changed.push("seats")
  return changed
}
