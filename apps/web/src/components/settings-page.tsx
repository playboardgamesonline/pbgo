import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"

/**
 * One page of the settings: its title, a line that says what is in it, and its groups, one under the other. The title is the page's own heading, under the window's (`Settings`, which only a screen reader reads: `SettingsModal`), so that a
 * screen reader finds the section in the window.
 */
export function SettingsPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-10">
      <header>
        <h2 className="font-heading text-3xl">{title}</h2>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  )
}

/** A setting that stands under a heading of its own, with a line that says what it is for and its control under them: the way a setting with a long list or a few choices to read is laid out (`Language & Time`), where a row with a switch would be too small. */
export function SettingsField({ title, description, className, children }: { title: string; description?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-4", className)}>
      <div>
        <h3 className="text-base">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/** A group of rows under a small title, with a line under it when the group needs one: `Item`s one under the other, 8px apart. */
export function SettingsGroup({ title, description, className, children }: { title: string; description?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3", className)}>
      <div>
        <h3 className="text-sm text-muted-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}
