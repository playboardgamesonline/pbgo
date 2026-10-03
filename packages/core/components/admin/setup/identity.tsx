"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@pbgo/ui/admin/field"
import { Input } from "@pbgo/ui/admin/input"
import { Textarea } from "@pbgo/ui/admin/textarea"
import { useState } from "react"
import { LOCALE_NAMES, type Locale } from "../../../lib/i18n"
import { baseSkin } from "../../../lib/skin"
import { siteTitle, type SiteSettings } from "../../../lib/settings"
import { LangTabs } from "./lang-tabs"
import { FileTile, IMAGE_ACCEPT, Img, LinkPreviewAside, ReadOnlyAlert, SaveBar, SetupLayout, useSection, type AdminData } from "./index"

type Draft = Pick<SiteSettings, "title" | "descriptions" | "creditsAuthors" | "credits">

const pick = (d: AdminData): Draft => ({ title: d.settings.title, descriptions: d.settings.descriptions, creditsAuthors: d.settings.creditsAuthors, credits: d.settings.credits })

export function IdentityPage({ initial, domain }: { initial: AdminData; domain: string }) {
  const s = useSection("identity", initial, pick)
  const { data, draft, set, disabled } = s
  const [lang, setLang] = useState<Locale>("fr")
  const settings = { ...data.settings, ...draft, description: draft.descriptions[lang] || draft.descriptions.fr, credits: { ...draft.credits, authors: draft.creditsAuthors[lang] || draft.creditsAuthors.fr || null } }
  const credits = (k: "publisher" | "publisherUrl", v: string) => set("credits", { ...draft.credits, [k]: v || null })
  const description = draft.descriptions[lang]
  const authors = draft.creditsAuthors[lang]
  const filled = (m: Record<Locale, string>) => Object.fromEntries((Object.keys(m) as Locale[]).map((l) => [l, !!m[l]])) as Partial<Record<Locale, boolean>>
  const skin = baseSkin(lang)
  const shareUrl = settings.shareImage ?? `/opengraph-image?v=${s.version}`

  return (
    <SetupLayout
      aside={<LinkPreviewAside draft={{ settings, skin: data.skin }} share={{ image: shareUrl, title: siteTitle(settings.title), description: settings.description, domain }} tab={{ title: settings.title, favicon: settings.favicon }} />}
    >
      <ReadOnlyAlert writable={data.writable} />

      <div className="flex flex-wrap items-center gap-3">
        <LangTabs value={lang} onChange={setLang} filled={filled(draft.descriptions)} />
        <p className="text-xs text-muted-foreground">Description and credits are written per language. The game name and the tab suffix are the same everywhere.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brand</CardTitle>
          <CardDescription>Click an image to replace it, or drop a file on it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-4">
            <FileTile
              label="Favicon"
              accept={`${IMAGE_ACCEPT},image/x-icon`}
              aspect="aspect-square"
              custom={!!data.settings.favicon?.startsWith("https://")}
              preview={<Img src={data.settings.favicon ?? `/icon?v=${s.version}`} className="size-20" />}
              busy={s.uploading === "favicon"}
              disabled={disabled}
              onFile={(f) => s.upload("favicon", f)}
              onRemove={() => s.remove("favicon")}
            />
            <FileTile
              label="Logo"
              accept={IMAGE_ACCEPT}
              aspect="h-32"
              custom={!!data.settings.logo && data.settings.logo.startsWith("https://")}
              preview={data.settings.logo ? <Img src={data.settings.logo} className="max-h-20 p-2" /> : undefined}
              busy={s.uploading === "logo"}
              disabled={disabled}
              onFile={(f) => s.upload("logo", f)}
              onRemove={() => s.remove("logo")}
            />
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Favicon: square PNG or SVG, turned into every icon size (tabs, iPhone home screen). Without one, it is made from the logo. Logo: PNG, WebP or SVG, converted to
            WebP.
          </p>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Game name</FieldLabel>
              <Input id="title" value={draft.title} maxLength={80} onChange={(e) => set("title", e.target.value)} disabled={disabled} className="h-11 text-lg font-semibold" />
              <FieldDescription>
                The game’s name only. PBGO writes it “{siteTitle("Name")}” (browser tab, search results, share card) and adds “· Table #CODE” during a game.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description · {LOCALE_NAMES[lang]}</FieldLabel>
              <Textarea
                id="description"
                rows={4}
                value={description}
                maxLength={400}
                placeholder={lang === "fr" ? undefined : draft.descriptions.fr}
                onChange={(e) => set("descriptions", { ...draft.descriptions, [lang]: e.target.value })}
                disabled={disabled}
              />
              <FieldDescription>
                Google result and share card · {description.length}/400 {description.length < 80 && lang === "fr" && "· aim for 120–160 characters"}
                {lang !== "fr" && !description && "· empty: the French text is shown"}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share image</CardTitle>
          <CardDescription>Shown when the link is shared (WhatsApp, iMessage, Discord, LinkedIn…). Without a custom image, it is generated from the Visual page.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileTile
            label="Image · 1200 × 630"
            accept={IMAGE_ACCEPT}
            aspect="aspect-[1200/630]"
            checker={false}
            custom={!!data.settings.shareImage?.startsWith("https://")}
            preview={<Img src={shareUrl} className="size-full object-cover" />}
            hint="Cropped to 1200 × 630 and served as JPG, the format every app reads."
            busy={s.uploading === "shareImage"}
            disabled={disabled}
            onFile={(f) => s.upload("shareImage", f)}
            onRemove={() => s.remove("shareImage")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credits</CardTitle>
          <CardDescription>Shown in the footer. Leave “A game by” empty for an original game.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="credits-authors">A game by · {LOCALE_NAMES[lang]}</FieldLabel>
              <Input
                id="credits-authors"
                placeholder={lang === "fr" ? "Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier" : draft.creditsAuthors.fr}
                value={authors}
                onChange={(e) => set("creditsAuthors", { ...draft.creditsAuthors, [lang]: e.target.value })}
                disabled={disabled}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="credits-publisher">Publisher</FieldLabel>
                <Input id="credits-publisher" placeholder="Catch Up Games" value={draft.credits.publisher ?? ""} onChange={(e) => credits("publisher", e.target.value)} disabled={disabled} />
              </Field>
              <Field>
                <FieldLabel htmlFor="credits-url">Publisher website</FieldLabel>
                <Input id="credits-url" type="url" placeholder="https://…" value={draft.credits.publisherUrl ?? ""} onChange={(e) => credits("publisherUrl", e.target.value)} disabled={disabled} />
              </Field>
            </div>
            <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              {settings.credits.authors
                ? `${skin.texts.creditsAdaptation} ${draft.title || "…"}, ${skin.texts.creditsBy} ${settings.credits.authors}${draft.credits.publisher ? ` ${skin.texts.creditsPublishedBy} ${draft.credits.publisher}` : ""}. ${draft.credits.publisher ? skin.texts.creditsRightsPublisher : skin.texts.creditsRights}`
                : `Original game: only the “${skin.texts.developedBy} oré” line is shown.`}
            </p>
          </FieldGroup>
        </CardContent>
      </Card>

      <SaveBar dirty={s.dirty} saving={s.saving} disabled={disabled} onSave={s.save} onReset={s.reset} />
    </SetupLayout>
  )
}
