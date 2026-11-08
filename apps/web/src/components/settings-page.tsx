import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"

/**
 * One page of the settings: its title, a line that says what is in it, and its groups, one under the other. The title is the page's own heading (the account's header above has the `h1`), so that a screen reader finds the
 * section under the member's name.
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
