import { Badge } from "@pbgo/ui/platform/badge"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"

/**
 * The Account standing row of the settings, the first of the Account status group: where the warnings and the limits on an account are told, when there is one. No account can be warned or limited yet, so every account is in good standing; the
 * day one can, this is the row that says it, and the group is where more rows (the age group, the details of a warning) go (`docs/accounts.md`).
 */
export function AccountStatusRow() {
  return (
    <Item>
      <ItemContent>
        <ItemTitle>Account standing</ItemTitle>
        <ItemDescription>Warnings and limits on your account appear here.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="success">All good</Badge>
      </ItemActions>
    </Item>
  )
}
