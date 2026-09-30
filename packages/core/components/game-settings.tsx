"use client"

import { GAME, optionGroup, type OptionDefinition, type OptionValues } from "@pbgo/binding"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@pbgo/ui/game/dialog"
import { cn } from "@pbgo/ui/utils"
import { useSiteSettings } from "./settings-provider"
import { useText } from "./skin-provider"

function display(def: OptionDefinition, value: unknown, t: ReturnType<typeof useText>) {
  if (def.type === "boolean") return value ? t("gameSettingsOn") : t("gameSettingsOff")
  if (def.type === "choice") return def.choices.find((c) => c.value === value)?.label ?? String(value)
  return String(value)
}

/** Fenêtre en lecture seule : paramètres et extensions de la partie en cours (les options masquées par l'admin ne sont pas listées). */
export function GameSettingsDialog({ open, onOpenChange, options }: { open: boolean; onOpenChange: (o: boolean) => void; options: OptionValues }) {
  const t = useText()
  const { options: settings } = useSiteSettings()
  const entries = Object.entries(GAME.options).filter(([key]) => !settings.hidden.includes(key))
  const parameters = entries.filter(([, def]) => optionGroup(def) === "parameter")
  const extensions = entries.filter(([, def]) => optionGroup(def) === "extension")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(92vw,28rem)] overflow-y-auto rounded-2xl border-0 bg-surface p-6 text-foreground">
        <DialogTitle className="font-display text-2xl">{t("gameSettingsMenu")}</DialogTitle>
        <DialogDescription className="sr-only">{t("gameSettingsMenu")}</DialogDescription>
        {entries.length === 0 && <p className="text-sm text-foreground/60">{t("gameSettingsNone")}</p>}
        {parameters.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-foreground/50 uppercase">{t("gameParameters")}</h3>
            <ul className="divide-y divide-foreground/10">
              {parameters.map(([key, def]) => (
                <li key={key} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span>{def.label}</span>
                  <span className="font-semibold tabular-nums">{display(def, options[key] ?? def.defaultValue, t)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {extensions.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-foreground/50 uppercase">{t("gameExtensions")}</h3>
            <ul className="space-y-2">
              {extensions.map(([key, def]) => {
                const active = options[key] === true
                return (
                  <li key={key} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm", active ? "border-accent-game/60 bg-accent-game/10" : "border-foreground/10 opacity-50")}>
                    {def.icon && <span className="text-xl" aria-hidden>{def.icon}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{def.label}</p>
                      {def.help && <p className="text-xs text-foreground/60">{def.help}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-semibold">{active ? t("gameSettingsOn") : t("gameSettingsOff")}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
