import { TIME_FORMATS, hourCycleOf, type TimeFormat } from "@pbgo/accounts"

/**
 * One `Intl.DateTimeFormat` for each way a member can have the time written (`TimeFormat`), made once. `make` is given the hour cycle the choice sets (none for Automatic, which leaves it to the language the formatter writes in, so a page
 * that says nothing looks as it always did) and the hour that goes with it, "9" on the clock of 12 hours and "09" on the clock of 24, for a formatter that spells its fields out.
 */
export function perTimeFormat(make: (clock: { hourCycle: "h12" | "h23" | undefined; hour: "numeric" | "2-digit" }) => Intl.DateTimeFormat): Record<TimeFormat, Intl.DateTimeFormat> {
  const formats = {} as Record<TimeFormat, Intl.DateTimeFormat>
  for (const format of TIME_FORMATS) {
    const hourCycle = hourCycleOf(format)
    formats[format] = make({ hourCycle, hour: hourCycle === "h12" ? "numeric" : "2-digit" })
  }
  return formats
}
