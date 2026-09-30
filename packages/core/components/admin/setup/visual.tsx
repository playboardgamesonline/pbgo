"use client"

import { useEffect } from "react"
import { Add01Icon, Cancel01Icon, RotateLeft01Icon, TextFontIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@pbgo/ui/admin/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Field, FieldDescription, FieldLabel } from "@pbgo/ui/admin/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@pbgo/ui/admin/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/admin/select"
import { DEFAULT_THEME, FONT_CHOICES, fontFaceCss, googleFontsHref, isHex, type SiteSettings, THEME_FIELDS, type ThemeColors, UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT, type VisualSlot } from "../../../lib/settings"
import { DEFAULT_PLAYER_COLORS } from "../../../lib/skin"
import { FileTile, IMAGE_ACCEPT, IMAGE_HINT, Img, PreviewCard, ReadOnlyAlert, SaveBar, SetupLayout, useSection, type AdminData } from "./index"

type Draft = Pick<SiteSettings, "theme" | "bodyFont" | "displayFont"> & { playerColors: string[] }

const pick = (d: AdminData): Draft => ({ theme: d.settings.theme, bodyFont: d.settings.bodyFont, displayFont: d.settings.displayFont, playerColors: d.skin.playerColors })

const DEFAULT_FONT = "__default__"

const IMAGES: Record<VisualSlot, { label: string; hint: string; aspect: string }> = {
  decorTop: { label: "Top", hint: "Full width, at the top of the home and lobby screens", aspect: "aspect-[5/1]" },
  decorBottom: { label: "Bottom", hint: "Full width, the main button sits on it", aspect: "aspect-[5/1]" },
  hero: { label: "Character", hint: "Standing on the bottom decoration", aspect: "aspect-[5/2]" },
  background: { label: "Background", hint: "Full-screen image behind everything", aspect: "aspect-[16/10]" },
  pattern: { label: "Texture", hint: "Tiled over the background (≈ 512 px)", aspect: "aspect-[16/10]" },
  hostIcon: { label: "Host pictogram", hint: "Next to the host in the lobby (SVG or PNG, used as a mask)", aspect: "aspect-[16/10]" },
}

export function VisualPage({ initial }: { initial: AdminData }) {
  const s = useSection("visual", initial, pick)
  const { data, draft, set, disabled } = s
  useFontPreview(draft.bodyFont, draft.displayFont, data.settings.files)
  const setColor = (key: keyof ThemeColors, value: string) => set("theme", { ...draft.theme, [key]: value })
  const setPlayer = (i: number, value: string) => set("playerColors", draft.playerColors.map((c, j) => (j === i ? value : c)))
  const settings = { ...data.settings, theme: draft.theme, bodyFont: draft.bodyFont, displayFont: draft.displayFont }
  const skin = { ...data.skin, playerColors: draft.playerColors.filter(isHex).length ? draft.playerColors.filter(isHex) : data.skin.playerColors }

  const image = (slot: VisualSlot) => {
    const info = data.visual.images[slot]
    const conf = IMAGES[slot]
    return (
      <FileTile
        key={slot}
        label={conf.label}
        hint={conf.hint}
        aspect={conf.aspect}
        accept={IMAGE_ACCEPT}
        custom={info.custom}
        preview={info.url ? <Img src={info.url} className={slot === "pattern" ? "size-full object-cover" : "p-2"} /> : undefined}
        busy={s.uploading === slot}
        disabled={disabled}
        onFile={(f) => s.upload(slot, f)}
        onRemove={() => s.remove(slot)}
      />
    )
  }

  return (
    <SetupLayout aside={<PreviewCard draft={{ settings, skin }} kinds={["home", "game"]} />}>
      <ReadOnlyAlert writable={data.writable} />

      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>Home, lobby and game interface.</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => set("theme", DEFAULT_THEME)}>
              <HugeiconsIcon icon={RotateLeft01Icon} strokeWidth={2} data-icon="inline-start" />
              Default
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_FIELDS.map((f) => (
              <Field key={f.key}>
                <FieldLabel htmlFor={`color-${f.key}`}>{f.label}</FieldLabel>
                <ColorInput id={`color-${f.key}`} label={f.label} value={draft.theme[f.key]} onChange={(v) => setColor(f.key, v)} disabled={disabled} />
                <FieldDescription>{f.hint}</FieldDescription>
              </Field>
            ))}
          </div>
          <Field>
            <FieldLabel>Player colors</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {draft.playerColors.map((c, i) => (
                <div key={i} className="group relative">
                  <ColorInput label={`Player ${i + 1}`} value={c} onChange={(v) => setPlayer(i, v)} disabled={disabled} className="w-32" />
                  {draft.playerColors.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove player ${i + 1} color`}
                      disabled={disabled}
                      onClick={() => set("playerColors", draft.playerColors.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 hidden size-5 cursor-pointer items-center justify-center rounded-full bg-background shadow ring-1 ring-border group-hover:flex"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                    </button>
                  )}
                </div>
              ))}
              {draft.playerColors.length < 12 && (
                <Button variant="outline" size="sm" disabled={disabled} onClick={() => set("playerColors", [...draft.playerColors, DEFAULT_PLAYER_COLORS[draft.playerColors.length % DEFAULT_PLAYER_COLORS.length]!])}>
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                  Add
                </Button>
              )}
            </div>
            <FieldDescription>Given to seats in join order.</FieldDescription>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fonts</CardTitle>
          <CardDescription>A Google font, or your own file. TTF and OTF are converted to WOFF2; WOFF2 and WOFF are kept as they are.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {(
              [
                { key: "displayFont", slot: "fontDisplay", label: "Titles", hint: "Titles, buttons, announcements", family: UPLOADED_TITLE_FONT },
                { key: "bodyFont", slot: "fontBody", label: "Text", hint: "Paragraphs and interface", family: UPLOADED_BODY_FONT },
              ] as const
            ).map((f) => {
              const file = data.settings.files[f.slot]
              return (
                <Field key={f.key}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <Select value={draft[f.key] ?? DEFAULT_FONT} onValueChange={(v) => set(f.key, v === DEFAULT_FONT ? null : v)} disabled={disabled || !!file}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_FONT}>{f.key === "displayFont" ? "Same as text" : "Game default"}</SelectItem>
                      {FONT_CHOICES.map((font) => (
                        <SelectItem key={font} value={font}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FileTile
                    label={file ? file.name : "Font file"}
                    accept=".woff2,.woff,.ttf,.otf"
                    aspect="h-20"
                    checker={false}
                    custom={!!file}
                    showDefault={false}
                    preview={
                      file ? (
                        <span className="text-3xl leading-none" style={{ fontFamily: `"${f.family}", sans-serif` }}>
                          Aa Bb 123
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <HugeiconsIcon icon={TextFontIcon} strokeWidth={2} className="size-4" />
                          WOFF2, WOFF, TTF or OTF · replaces the Google font
                        </span>
                      )
                    }
                    busy={s.uploading === f.slot}
                    disabled={disabled}
                    onFile={(file) => s.upload(f.slot, file)}
                    onRemove={() => s.remove(f.slot)}
                  />
                  <FieldDescription>{f.hint}</FieldDescription>
                </Field>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decorations</CardTitle>
          <CardDescription>Around the home and lobby screens. {IMAGE_HINT}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {image("decorTop")}
          {image("decorBottom")}
          {image("hero")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
          <CardDescription>Background, texture and pictograms. {IMAGE_HINT}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          {image("background")}
          {image("pattern")}
          {image("hostIcon")}
        </CardContent>
      </Card>

      <SaveBar dirty={s.dirty} saving={s.saving} disabled={disabled} onSave={s.save} onReset={s.reset} />
    </SetupLayout>
  )
}

function ColorInput({ id, label, value, onChange, disabled, className }: { id?: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean; className?: string }) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <label className="relative block size-5 cursor-pointer overflow-hidden rounded-full border shadow-xs" style={{ background: isHex(value) ? value : "transparent" }}>
          <input type="color" aria-label={label} value={isHex(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </InputGroupAddon>
      <InputGroupInput id={id} value={value} onChange={(e) => onChange(e.target.value.trim())} aria-invalid={!isHex(value)} className="font-mono uppercase" maxLength={7} disabled={disabled} />
    </InputGroup>
  )
}

/** Charge dans l'admin les polices choisies ou envoyées, pour les aperçus « Aa ». */
function useFontPreview(body: string | null, display: string | null, files: SiteSettings["files"]) {
  const href = googleFontsHref([body, display])
  const faces = fontFaceCss(files)
  useEffect(() => {
    const nodes: HTMLElement[] = []
    if (href) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = href
      nodes.push(link)
    }
    if (faces) {
      const style = document.createElement("style")
      style.textContent = faces
      nodes.push(style)
    }
    nodes.forEach((n) => document.head.appendChild(n))
    return () => nodes.forEach((n) => n.remove())
  }, [href, faces])
}
