"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@pbgo/ui/admin/field"
import { Input } from "@pbgo/ui/admin/input"
import { Textarea } from "@pbgo/ui/admin/textarea"
import { siteTitle, TITLE_SUFFIX, type SiteSettings } from "../../../lib/settings"
import { FileTile, IMAGE_ACCEPT, Img, LinkPreviewAside, ReadOnlyAlert, SaveBar, SetupLayout, useSection, type AdminData } from "./index"

type Draft = Pick<SiteSettings, "title" | "description" | "credits">

const pick = (d: AdminData): Draft => ({ title: d.settings.title, description: d.settings.description, credits: d.settings.credits })

export function IdentityPage({ initial, domain }: { initial: AdminData; domain: string }) {
  const s = useSection("identity", initial, pick)
  const { data, draft, set, disabled } = s
  const settings = { ...data.settings, ...draft }
  const credits = (k: keyof Draft["credits"], v: string) => set("credits", { ...draft.credits, [k]: v || null })
  const shareUrl = settings.shareImage ?? `/opengraph-image?v=${s.version}`

  return (
    <SetupLayout
      aside={<LinkPreviewAside draft={{ settings, skin: data.skin }} share={{ image: shareUrl, title: siteTitle(settings.title), description: settings.description, domain }} tab={{ title: settings.title, favicon: settings.favicon }} />}
    >
      <ReadOnlyAlert writable={data.writable} />

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
                The game’s name only, without “Online”. The site adds “{TITLE_SUFFIX}” (browser tab, search results, share card) and “· Table #CODE” during a game.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={4} value={draft.description} maxLength={400} onChange={(e) => set("description", e.target.value)} disabled={disabled} />
              <FieldDescription>
                Google result and share card · {draft.description.length}/400 {draft.description.length < 80 && "· aim for 120–160 characters"}
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
              <FieldLabel htmlFor="credits-authors">A game by</FieldLabel>
              <Input
                id="credits-authors"
                placeholder="Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier"
                value={draft.credits.authors ?? ""}
                onChange={(e) => credits("authors", e.target.value)}
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
              {draft.credits.authors
                ? `Adaptation en ligne non officielle et gratuite de ${draft.title || "…"}, un jeu de ${draft.credits.authors}${draft.credits.publisher ? ` et édité par ${draft.credits.publisher}` : ""}. Tous droits réservés à leurs auteurs${draft.credits.publisher ? " et à l’éditeur" : ""}.`
                : "Original game: only the “Développé par oré” line is shown."}
            </p>
          </FieldGroup>
        </CardContent>
      </Card>

      <SaveBar dirty={s.dirty} saving={s.saving} disabled={disabled} onSave={s.save} onReset={s.reset} />
    </SetupLayout>
  )
}
