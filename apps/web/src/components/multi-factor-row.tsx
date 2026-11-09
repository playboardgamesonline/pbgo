import { Badge } from "@pbgo/ui/platform/badge"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"

/**
 * The Multi-factor authentication row of the settings: a code from an authenticator app asked on top of the password at each sign-in. It has its place between the password and the devices, as the apps the owner pointed to have it; the second
 * step itself is not built (`docs/accounts.md`), so the row says so with the badge that the games to come wear, and holds no control.
 */
export function MultiFactorRow() {
  return (
    <Item>
      <ItemContent>
        <ItemTitle>Multi-factor authentication</ItemTitle>
        <ItemDescription>A code from an authenticator app, asked on top of your password each time you sign in.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="secondary">Coming soon</Badge>
      </ItemActions>
    </Item>
  )
}
