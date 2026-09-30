import { cn } from "@pbgo/ui/utils"

type Point = { label: string; value: number; detail?: string }

const DAY_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })

export const dayLabel = (iso: string) => DAY_FMT.format(new Date(`${iso}T12:00:00`))

export function BarChart({ data, unit, className }: { data: Point[]; unit: string; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative flex h-40 items-end gap-0.5 border-b" role="img" aria-label={`${unit} per day`}>
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-chart-2 transition-colors group-hover:bg-primary"
              style={{ height: d.value ? `${Math.max(3, (d.value / max) * 100)}%` : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-border group-hover:block">
              <p className="font-medium">{d.label}</p>
              <p className="text-muted-foreground tabular-nums">
                {d.value} {unit}
                {d.detail ? ` · ${d.detail}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </div>
  )
}
