import { ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { Badge } from "@pgo/ui/admin/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pgo/ui/admin/card"
import { Progress } from "@pgo/ui/admin/progress"
import { cn } from "@pgo/ui/utils"
import type { LaunchItem } from "../../server/launch"

export function LaunchPage({ items }: { items: LaunchItem[] }) {
  const required = items.filter((i) => !i.optional)
  const done = required.filter((i) => i.ok).length
  const groups = [...new Set(items.map((i) => i.group))]
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{done === required.length ? "Ready to launch" : `${required.length - done} step${required.length - done > 1 ? "s" : ""} left`}</CardTitle>
          <CardDescription>
            {done} of {required.length} required checks pass · optional ones are nice to have.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={(done / required.length) * 100} />
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g} className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-sm">{g}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y">
                {items
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <li key={i.id}>
                      <Link href={`/admin/${i.fix}`} className="group flex items-center gap-3 px-6 py-3 hover:bg-muted/50">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full",
                            i.ok ? "text-emerald-600" : "border-2 border-dashed border-muted-foreground/40",
                          )}
                        >
                          {i.ok && <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {i.label}
                            {i.optional && <Badge variant="outline" className="text-[10px]">Optional</Badge>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{i.detail}</span>
                        </span>
                        {!i.ok && <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                      </Link>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
