import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Share08Icon } from "@hugeicons/core-free-icons"
import { Button } from "@pbgo/ui/platform/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@pbgo/ui/platform/dialog"
import { Field, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@pbgo/ui/platform/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@pbgo/ui/platform/tooltip"
import { CookieBannerDemo } from "../_components/cookie-banner-demo"
import { MenuDemo } from "../_components/menu-demo"
import { Demo, Section } from "../_components/layout"
import { ToastDemo } from "../_components/toast-demo"

const ROW = "flex flex-wrap items-center gap-3"
const SIDES = ["top", "right", "bottom", "left"] as const

export function Dialogs() {
  return (
    <Section
      id="dialog"
      module="dialog"
      intro="A modal that interrupts the page for one decision or one short form. It traps focus, closes on Escape and on a click outside, and carries the `platform` class itself since it renders in a portal."
    >
      <Demo
        title="Confirmation and form"
        description="The title and description name the decision. Footer buttons go from least to most committing, the destructive one last. `DialogFooter` adds a Close button with `showCloseButton`."
        className={ROW}
        code={`<Dialog>
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
</Dialog>`}
      >
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
      </Demo>
    </Section>
  )
}

export function Sheets() {
  return (
    <Section
      id="sheet"
      module="sheet"
      intro="A panel that slides in from an edge: a menu on a phone, a settings drawer, a long form. Same behaviour as a dialog, and the one component that uses `duration-slow`."
    >
      <Demo
        title="Four sides"
        className={ROW}
        code={`<Sheet>
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
</Sheet>`}
      >
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
      </Demo>
    </Section>
  )
}

export function Dropdowns() {
  return (
    <Section
      id="dropdown-menu"
      module="dropdown-menu"
      intro="A list of actions behind one button. Rows can carry an icon, a shortcut, a check or a radio; groups take a label and are split by separators; a row can open a sub-menu."
    >
      <Demo
        title="Every kind of row"
        description="The checked state belongs to the caller: the component only draws it."
        code={`<DropdownMenu>
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
</DropdownMenu>`}
      >
        <MenuDemo />
      </Demo>
    </Section>
  )
}

export function Tooltips() {
  return (
    <Section
      id="tooltip"
      module="tooltip"
      intro="A one-line hint on hover and focus, for an icon button or a truncated label. It never holds anything the user must read or click. `TooltipProvider` goes once above the tooltips."
    >
      <Demo
        title="Sides, and on an icon button"
        className={ROW}
        code={`<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Copy link">
        <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">Copy link</TooltipContent>
  </Tooltip>
</TooltipProvider>`}
      >
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
      </Demo>
    </Section>
  )
}

export function Toasts() {
  return (
    <Section
      id="toast"
      module="sonner"
      intro="A message that confirms something happened and fades by itself. Call `toast()` from anywhere; the `Toaster` is mounted once per layout: the gamemaster layout mounts this one, the games mount their own style (`AppToaster` in `packages/core/components/toaster.tsx`). This page mounts its own."
    >
      <Demo
        title="Kinds"
        description="Keep a toast to a few words. `toast.promise` follows a request from loading to done."
        code={`import { toast } from "@pbgo/ui/platform/sonner"

toast("Table created")
toast.success("Invitation link copied")
toast.error("The table could not be saved")
toast.promise(save(), { loading: "Saving…", success: "Saved", error: "Not saved" })`}
      >
        <ToastDemo />
      </Demo>
    </Section>
  )
}

export function CookieBanners() {
  return (
    <Section
      id="cookie-banner"
      module="cookie-banner"
      intro="The question about statistics and recordings: one line docked to the bottom of the screen, a sentence that ends with a link to the details, then Refuse and Accept. They are the same button side by side, so refusing is as easy and as visible as accepting. The bar never sits over the page: its caller measures it and makes the room (`@pbgo/analytics` publishes its height as `--consent-h` on `<body>`), so the page ends above it and a screen that fills the viewport subtracts the variable, `h-[calc(100dvh-var(--consent-h,0px))]`. The words and the answers come from the caller (`@pbgo/analytics` picks the language and keeps the stored answer); the bar carries the `platform` class itself, since it also sits over a game page. The frames below dock it with `absolute` and make the room on the frame, where a page docks it with `fixed` and makes it on `<body>`."
    >
      <Demo
        title="First visit"
        description="No close button: the banner stays until the visitor answers. Try either button, and watch the button at the bottom of the page: it rises above the bar and drops back when the bar closes."
        code={`const bar = useRef<HTMLDivElement>(null)

// the page ends above the bar (--consent-h)
useLayoutEffect(() => reserveSpace(bar.current, document.body), [])

<CookieBanner
  ref={bar}
  texts={BANNER_TEXTS[locale]}
  moreHref="/legal#cookies"
  onAccept={() => consentStore.choose("accepted")}
  onRefuse={() => consentStore.choose("refused")}
/>`}
      >
        <CookieBannerDemo />
      </Demo>
      <Demo
        title="Reopened from the Cookies link"
        description="A visitor who already answered can change their mind from the footer or the settings menu. The bar then has a close button, closes on Escape and takes the focus, and closing it keeps the answer."
        code={`<CookieBanner
  texts={BANNER_TEXTS[locale]}
  moreHref="/legal#cookies"
  onAccept={…}
  onRefuse={…}
  onClose={consentStore.dismiss}
/>`}
      >
        <CookieBannerDemo reopened />
      </Demo>
    </Section>
  )
}
