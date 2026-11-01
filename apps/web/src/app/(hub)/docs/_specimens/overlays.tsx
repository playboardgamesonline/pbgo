// The live specimens of the overlays page of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Share08Icon } from "@hugeicons/core-free-icons"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@pbgo/ui/platform/dialog"
import { Field, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@pbgo/ui/platform/sheet"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@pbgo/ui/platform/tooltip"
import { CookieBannerDemo } from "./cookie-banner-demo"
import { MenuDemo } from "./menu-demo"
import { ToastDemo } from "./toast-demo"
import { Frame } from "./text"

const ROW = "flex flex-wrap items-center gap-3"

const SIDES = ["top", "right", "bottom", "left"] as const

function DialogConfirmationAndForm() {
  return (
    <Frame className={ROW} code={`<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Leave the table</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Leave the table?</DialogTitle>
      <DialogDescription>Your seat goes to the next player.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Stay</Button>
      </DialogClose>
      <Button variant="destructive">Leave</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog>
  <DialogTrigger asChild>
    <Button>Rename the table</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Rename the table</DialogTitle>
      <DialogDescription>Everyone at the table sees the new name.</DialogDescription>
    </DialogHeader>
    <Field>
      <FieldLabel htmlFor="dialog-name">Name</FieldLabel>
      <Input id="dialog-name" defaultValue="Friday night" />
    </Field>
    <DialogFooter showCloseButton>
      <Button>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Leave the table</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave the table?</DialogTitle>
            <DialogDescription>
              Your seat goes to the next player. You can come back with the same link while the game is not over.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Stay</Button>
            </DialogClose>
            <Button variant="destructive">Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button>Rename the table</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename the table</DialogTitle>
            <DialogDescription>Everyone at the table sees the new name.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="dialog-name">Name</FieldLabel>
            <Input id="dialog-name" defaultValue="Friday night" />
          </Field>
          <DialogFooter showCloseButton>
            <Button>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Frame>
  )
}

function SheetFourSides() {
  return (
    <Frame className={ROW} code={`<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Table settings</SheetTitle>
      <SheetDescription>Opens from the right.</SheetDescription>
    </SheetHeader>
    <SheetFooter>
      <SheetClose asChild>
        <Button variant="outline">Close</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>`}>
      {SIDES.map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="outline" className="capitalize">
              {side}
            </Button>
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>Table settings</SheetTitle>
              <SheetDescription>This sheet opens from the {side}.</SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Close</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </Frame>
  )
}

function DropdownMenuEveryKindOfRow() {
  return (
    <Frame code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Table options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-60">
    <DropdownMenuLabel>Table</DropdownMenuLabel>
    <DropdownMenuItem>Rename<DropdownMenuShortcut>⌘R</DropdownMenuShortcut></DropdownMenuItem>
    <DropdownMenuCheckboxItem checked={sound} onCheckedChange={setSound}>Sound</DropdownMenuCheckboxItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">Delete table</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}>
      <MenuDemo />
    </Frame>
  )
}

function PopoverHeaderAndChips() {
  return (
    <Frame className={ROW} code={`<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Players</Button>
  </PopoverTrigger>
  <PopoverContent aria-label="Number of players">
    <PopoverHeader>
      <PopoverTitle>Number of players</PopoverTitle>
      <Button variant="ghost" size="sm">Clear</Button>
    </PopoverHeader>
    <ToggleGroup type="single" aria-label="Number of players">…</ToggleGroup>
  </PopoverContent>
</Popover>`}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Players</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Number of players">
          <PopoverHeader>
            <PopoverTitle>Number of players</PopoverTitle>
            <Button variant="ghost" size="sm">
              Clear
            </Button>
          </PopoverHeader>
          <ToggleGroup type="single" defaultValue="4" aria-label="Number of players">
            {["1", "2", "3", "4", "5", "6", "7", "8+"].map((count) => (
              <ToggleGroupItem key={count} value={count}>
                {count}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PopoverContent>
      </Popover>
    </Frame>
  )
}

function TooltipSidesAndIconButton() {
  return (
    <Frame className={ROW} code={`<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Copy link">
        <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">Copy link</TooltipContent>
  </Tooltip>
</TooltipProvider>`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Copy link">
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy link</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Share">
              <HugeiconsIcon icon={Share08Icon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Share the table</TooltipContent>
        </Tooltip>
        {SIDES.map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger asChild>
              <Button variant="ghost" className="capitalize">
                {side}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={side}>On the {side}</TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </Frame>
  )
}

function ToastKinds() {
  return (
    <Frame code={`import { toast } from "@pbgo/ui/platform/sonner"

toast("Table created")
toast.success("Invitation link copied")
toast.error("The table could not be saved")
toast.promise(save(), { loading: "Saving…", success: "Saved", error: "Not saved" })`}>
      <ToastDemo />
    </Frame>
  )
}

function CookieBannerFirstVisit() {
  return (
    <Frame code={`const banner = useRef<HTMLDivElement>(null)

// the page ends above the card (--consent-h)
useLayoutEffect(() => reserveSpace(banner.current, document.body), [])

<CookieBanner
  ref={banner}
  texts={BANNER_TEXTS[locale]}
  moreHref="/legal#cookies"
  onAccept={() => consentStore.choose("accepted")}
  onRefuse={() => consentStore.choose("refused")}
/>`}>
      <CookieBannerDemo />
    </Frame>
  )
}

function CookieBannerReopened() {
  return (
    <Frame code={`<CookieBanner
  texts={BANNER_TEXTS[locale]}
  moreHref="/legal#cookies"
  onAccept={…}
  onRefuse={…}
  onClose={consentStore.dismiss}
/>`}>
      <CookieBannerDemo reopened />
    </Frame>
  )
}

export const overlaysSpecimens: Specimens = {
  "dialog-confirmation-and-form": DialogConfirmationAndForm,
  "sheet-four-sides": SheetFourSides,
  "dropdown-menu-every-kind-of-row": DropdownMenuEveryKindOfRow,
  "popover-header-and-chips": PopoverHeaderAndChips,
  "tooltip-sides-and-icon-button": TooltipSidesAndIconButton,
  "toast-kinds": ToastKinds,
  "cookie-banner-first-visit": CookieBannerFirstVisit,
  "cookie-banner-reopened": CookieBannerReopened,
}
