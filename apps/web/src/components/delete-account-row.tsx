"use client"

import { useState } from "react"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { CONTACT } from "@/site"

/**
 * The Delete account row of the settings: a red button that opens a window which says what deleting means (the profile and the personal data are erased, and it cannot be taken back) and how it is asked for. Today it is asked
 * for by e-mail, as the Privacy Policy says ("Your account stays until you ask us to delete it, by writing to…"): the window's button opens a message to the contact address, with no address of the member in it. Deleting from the page
 * itself is PLT-36. An account that came from a provider with no e-mail address (Steam) cannot write "from the address of the account": it gives the link of its profile, which names the account but proves nothing (it is
 * public), so the window says that proof may be asked (`provider`: the name of that provider, null for an account with an address).
 */
export function DeleteAccountRow({ provider }: { provider: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Item className="border-destructive/30">
        <ItemContent>
          <ItemTitle>Delete your account</ItemTitle>
          <ItemDescription className="line-clamp-none">Erases your profile and your personal data. This cannot be undone.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </ItemActions>
      </Item>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription>
              {provider
                ? `Write to us with the link of your ${provider} profile and we delete the account, with what it holds: your profile and your personal data. We may ask you to prove that it is yours. This cannot be undone.`
                : "Write to us from the e-mail address of your account and we delete it, with what it holds: your profile and your personal data. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button asChild variant="destructive">
              <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("Delete my account")}`}>Write to us</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
