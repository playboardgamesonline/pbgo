"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { HelpCircleIcon } from "@hugeicons/core-free-icons"
import { Button } from "@pbgo/ui/platform/button"
import { Popover, PopoverContent, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { SHORTCUTS } from "../../_specimens/scene/play/shortcuts"

const GROUPS = ["Edit", "Transitions", "Table", "Scene"] as const

const Key = ({ children }: { children: string }) => <kbd className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</kbd>

/** The keys of the playground, in a popover on the toolbar: the list the page listens to (`SHORTCUTS`), so it cannot drift from it */
export function Help({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
          <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Keyboard shortcuts" className="w-[34rem] gap-4 overflow-y-auto p-4">
        <p className="text-sm text-muted-foreground">The keys work anywhere on the page except while you type in a field or a dialog is open.</p>
        <div className="columns-2 gap-8">
          {GROUPS.map((group) => (
            <section key={group} className="mb-5 flex break-inside-avoid flex-col gap-2">
              <h2 className="text-xs tracking-wide text-muted-foreground uppercase">{group}</h2>
              <dl className="flex flex-col gap-1.5">
                {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                  <div key={shortcut.label} className="flex items-center justify-between gap-3 text-sm">
                    <dt>{shortcut.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1">{shortcut.keys.map((key, i) => (key === "–" ? <span key={i}>–</span> : <Key key={i}>{key}</Key>))}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
