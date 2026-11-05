"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Logout01Icon, Settings02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@pbgo/ui/platform/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pbgo/ui/platform/dropdown-menu"

/** A dropdown with the rows the site uses: a label, an item with an icon, a radio choice and a destructive item; the chosen value lives here, the component only draws it. */
export function MenuDemo() {
  const [view, setView] = useState("grid")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
          Table options
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>Table</DropdownMenuLabel>
        <DropdownMenuItem>
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={view} onValueChange={setView}>
          <DropdownMenuRadioItem value="grid">Grid</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
          Leave the table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
