"use client"

import { Pdf02Icon, LinkSquare02Icon, RotateLeft01Icon, TextFontIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Dropzone } from "@/components/admin/dropzone"
import { Alert, AlertDescription, AlertTitle } from "@pgo/ui/admin/alert"
import { Badge } from "@pgo/ui/admin/badge"
import { Button } from "@pgo/ui/admin/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@pgo/ui/admin/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@pgo/ui/admin/field"
import { Input } from "@pgo/ui/admin/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@pgo/ui/admin/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pgo/ui/admin/select"
import { Spinner } from "@pgo/ui/admin/spinner"
import { Textarea } from "@pgo/ui/admin/textarea"
import { adminRequest } from "@/lib/admin-api"
import { DEFAULT_THEME, FONT_CHOICES, fontFaceCss, googleFontsHref, isHex, type SiteSettings, THEME_FIELDS, type ThemeColors, UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT, type UploadSlot } from "@/lib/settings"

type Meta = { writable: boolean; sanityConfigured: boolean; bounds: { min: number; max: number } }

const DEFAULT_FONT = "__default__"

function useFontPreview(settings: SiteSettings) {
  const href = googleFontsHref([settings.bodyFont, settings.displayFont])
  const faces = fontFaceCss(settings.files)
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

const SERVER_MANAGED = (s: SiteSettings) => ({ ...s, logo: null, files: null, rulesPdf: null })

export function SettingsForm({ initial, meta }: { initial: SiteSettings; meta: Meta }) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<UploadSlot | null>(null)
  const dirty = useMemo(() => JSON.stringify(SERVER_MANAGED(draft)) !== JSON.stringify(SERVER_MANAGED(saved)), [draft, saved])
  const disabled = !meta.writable
  useFontPreview(draft)

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setColor = (key: keyof ThemeColors, value: string) => setDraft((d) => ({ ...d, theme: { ...d.theme, [key]: value } }))

  function applySaved(s: SiteSettings, keepDraft = false) {
    setSaved(s)
    setDraft((d) => (keepDraft ? { ...d, logo: s.logo, files: s.files, rulesPdf: s.rulesPdf } : s))
    router.refresh()
  }

  async function save() {
    if (!dirty || saving || disabled) return
    const invalid = THEME_FIELDS.find((f) => !isHex(draft.theme[f.key]))
    if (invalid) return toast.error(`Couleur « ${invalid.label} » invalide (format #rrggbb).`)
    setSaving(true)
    try {
      applySaved(await adminRequest<SiteSettings>("/api/admin/settings", { method: "PUT", body: JSON.stringify(draft) }))
      toast.success("Paramètres enregistrés")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function upload(slot: UploadSlot, file: File) {
    const form = new FormData()
    form.append("file", file)
    setUploading(slot)
    try {
      applySaved(await adminRequest<SiteSettings>(`/api/admin/upload/${slot}`, { method: "POST", body: form }), true)
      toast.success(`${file.name} envoyé dans Sanity`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  async function remove(slot: UploadSlot) {
    setUploading(slot)
    try {
      applySaved(await adminRequest<SiteSettings>(`/api/admin/upload/${slot}`, { method: "DELETE" }), true)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault()
      void saveRef.current()
    }
  }, [])
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onKey])

  // Coller une image n'importe où (hors champ texte) = nouveau logo
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null
      if (disabled || target?.closest("input, textarea, [contenteditable=true], [role=button]")) return
      const image = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"))
      if (!image) return
      e.preventDefault()
      void upload("logo", image)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {!meta.writable && (
          <Alert>
            <AlertTitle>{meta.sanityConfigured ? "Lecture seule" : "Sanity non configuré"}</AlertTitle>
            <AlertDescription>
              {meta.sanityConfigured
                ? "Ajoutez un token Sanity avec les droits Editor dans SANITY_API_WRITE_TOKEN pour enregistrer depuis cette page."
                : "Renseignez NEXT_PUBLIC_SANITY_PROJECT_ID puis SANITY_API_WRITE_TOKEN. Les valeurs affichées sont celles par défaut du code."}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
            <CardDescription>Nom du jeu, description pour le référencement et logo.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Titre</FieldLabel>
                <Input id="title" value={draft.title} maxLength={80} onChange={(e) => set("title", e.target.value)} disabled={disabled} />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" rows={3} value={draft.description} maxLength={400} onChange={(e) => set("description", e.target.value)} disabled={disabled} />
                <FieldDescription>
                  Utilisée pour Google et les aperçus de partage · {draft.description.length}/400
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Logo</FieldLabel>
                <Dropzone
                  size="lg"
                  accept="image/*"
                  title={draft.logo ? "Remplacer le logo" : "Déposer le logo"}
                  hint="Glisser-déposer, cliquer, ou coller une image (⌘V) · PNG, SVG, WebP · 4 Mo max"
                  busy={uploading === "logo"}
                  disabled={disabled}
                  current={
                    draft.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.logo} alt="Logo" className="max-h-28 max-w-[70%] object-contain" />
                    ) : undefined
                  }
                  onFile={(f) => upload("logo", f)}
                  onRemove={draft.logo ? () => remove("logo") : undefined}
                  removeLabel="Retirer le logo"
                />
                <FieldDescription>Stocké dans Sanity. Sans logo, le titre est affiché.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Joueurs</CardTitle>
            <CardDescription>
              Le moteur du jeu autorise de {meta.bounds.min} à {meta.bounds.max} joueurs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="minPlayers">Minimum pour lancer</FieldLabel>
                <Input
                  id="minPlayers"
                  type="number"
                  min={meta.bounds.min}
                  max={draft.maxPlayers}
                  value={draft.minPlayers}
                  onChange={(e) => set("minPlayers", Number(e.target.value))}
                  disabled={disabled}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="maxPlayers">Maximum par partie</FieldLabel>
                <Input
                  id="maxPlayers"
                  type="number"
                  min={draft.minPlayers}
                  max={meta.bounds.max}
                  value={draft.maxPlayers}
                  onChange={(e) => set("maxPlayers", Number(e.target.value))}
                  disabled={disabled}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thème</CardTitle>
            <CardDescription>Couleurs de l&apos;accueil, du lobby et de l&apos;interface de jeu.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" disabled={disabled} onClick={() => set("theme", DEFAULT_THEME)}>
                <HugeiconsIcon icon={RotateLeft01Icon} strokeWidth={2} data-icon="inline-start" />
                Défaut
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {THEME_FIELDS.map((f) => (
                <Field key={f.key}>
                  <FieldLabel htmlFor={`color-${f.key}`}>{f.label}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <label className="relative block size-5 cursor-pointer overflow-hidden rounded-full border shadow-xs" style={{ background: isHex(draft.theme[f.key]) ? draft.theme[f.key] : "transparent" }}>
                        <input
                          type="color"
                          aria-label={f.label}
                          value={isHex(draft.theme[f.key]) ? draft.theme[f.key] : "#000000"}
                          onChange={(e) => setColor(f.key, e.target.value)}
                          disabled={disabled}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                      </label>
                    </InputGroupAddon>
                    <InputGroupInput
                      id={`color-${f.key}`}
                      value={draft.theme[f.key]}
                      onChange={(e) => setColor(f.key, e.target.value.trim())}
                      aria-invalid={!isHex(draft.theme[f.key])}
                      className="font-mono uppercase"
                      maxLength={7}
                      disabled={disabled}
                    />
                  </InputGroup>
                  <FieldDescription>{f.hint}</FieldDescription>
                </Field>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Typographie</CardTitle>
            <CardDescription>Une police Google Fonts, ou votre propre fichier (.woff2, .woff, .ttf, .otf) envoyé dans Sanity.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              {(
                [
                  { key: "displayFont", slot: "fontDisplay", label: "Titres", hint: "Titres, boutons, annonces", family: UPLOADED_TITLE_FONT },
                  { key: "bodyFont", slot: "fontBody", label: "Texte", hint: "Paragraphes et interface", family: UPLOADED_BODY_FONT },
                ] as const
              ).map((f) => {
                const file = draft.files[f.slot]
                return (
                  <Field key={f.key}>
                    <FieldLabel>{f.label}</FieldLabel>
                    <Select value={draft[f.key] ?? DEFAULT_FONT} onValueChange={(v) => set(f.key, v === DEFAULT_FONT ? null : v)} disabled={disabled || !!file}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DEFAULT_FONT}>{f.key === "displayFont" ? "Comme le texte" : "Police système arrondie"}</SelectItem>
                        {FONT_CHOICES.map((font) => (
                          <SelectItem key={font} value={font}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dropzone
                      accept=".woff2,.woff,.ttf,.otf"
                      title={file ? file.name : "Importer une police"}
                      hint={file ? "Remplace la police Google ci-dessus" : "Glisser-déposer ou cliquer · 4 Mo max"}
                      busy={uploading === f.slot}
                      disabled={disabled}
                      current={
                        file ? (
                          <span className="text-3xl leading-none" style={{ fontFamily: `"${f.family}", sans-serif` }}>
                            Aa
                          </span>
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border">
                            <HugeiconsIcon icon={TextFontIcon} strokeWidth={2} className="size-4" />
                          </span>
                        )
                      }
                      onFile={(file) => upload(f.slot, file)}
                      onRemove={file ? () => remove(f.slot) : undefined}
                      removeLabel="Retirer la police"
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
            <CardTitle>Règles PDF</CardTitle>
            <CardDescription>Affichées dans la fenêtre des règles. Envoyez le PDF, ou collez un lien s&apos;il est trop lourd (plus de 4 Mo).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              {(
                [
                  { lang: "fr", slot: "rulesFr", label: "Français" },
                  { lang: "en", slot: "rulesEn", label: "English" },
                ] as const
              ).map(({ lang, slot, label }) => {
                const file = draft.files[slot]
                return (
                  <Field key={lang}>
                    <FieldLabel>Règles PDF · {label}</FieldLabel>
                    <Dropzone
                      accept="application/pdf,.pdf"
                      title={file ? file.name : "Déposer le PDF"}
                      hint={file ? "Cliquer pour remplacer" : "Glisser-déposer ou cliquer · 4 Mo max"}
                      busy={uploading === slot}
                      disabled={disabled}
                      current={
                        <span className="flex size-10 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border">
                          <HugeiconsIcon icon={Pdf02Icon} strokeWidth={2} className="size-4" />
                        </span>
                      }
                      onFile={(f) => upload(slot, f)}
                      onRemove={file ? () => remove(slot) : undefined}
                      removeLabel="Retirer le PDF"
                    />
                    {!file && (
                      <InputGroup>
                        <InputGroupInput
                          type="url"
                          aria-label={`Lien vers les règles (${label})`}
                          placeholder="ou coller un lien https://…"
                          value={draft.rulesPdfLinks[lang] ?? ""}
                          onChange={(e) => set("rulesPdfLinks", { ...draft.rulesPdfLinks, [lang]: e.target.value || null })}
                          disabled={disabled}
                        />
                        {draft.rulesPdfLinks[lang] && (
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton asChild size="icon-xs" aria-label="Ouvrir">
                              <a href={draft.rulesPdfLinks[lang]!} target="_blank" rel="noopener noreferrer">
                                <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} />
                              </a>
                            </InputGroupButton>
                          </InputGroupAddon>
                        )}
                      </InputGroup>
                    )}
                    {file && (
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                        Ouvrir le PDF
                      </a>
                    )}
                  </Field>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crédits du jeu</CardTitle>
            <CardDescription>Affichés dans le pied de page. Laisser « Un jeu de » vide pour un jeu original.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="credits-authors">Un jeu de</FieldLabel>
                <Input
                  id="credits-authors"
                  placeholder="Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier"
                  value={draft.credits.authors ?? ""}
                  onChange={(e) => set("credits", { ...draft.credits, authors: e.target.value || null })}
                  disabled={disabled}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="credits-publisher">Éditeur</FieldLabel>
                  <Input
                    id="credits-publisher"
                    placeholder="Catch Up Games"
                    value={draft.credits.publisher ?? ""}
                    onChange={(e) => set("credits", { ...draft.credits, publisher: e.target.value || null })}
                    disabled={disabled}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="credits-url">Site de l&apos;éditeur</FieldLabel>
                  <Input
                    id="credits-url"
                    type="url"
                    placeholder="https://catchupgames.com/nos-jeux/courtisans/"
                    value={draft.credits.publisherUrl ?? ""}
                    onChange={(e) => set("credits", { ...draft.credits, publisherUrl: e.target.value || null })}
                    disabled={disabled}
                  />
                </Field>
              </div>
              <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                {draft.credits.authors
                  ? `Adaptation en ligne non officielle et gratuite de ${draft.title || "…"}, un jeu de ${draft.credits.authors}${draft.credits.publisher ? ` et édité par ${draft.credits.publisher}` : ""}. Tous droits réservés à leurs auteurs${draft.credits.publisher ? " et à l’éditeur" : ""}.`
                  : "Jeu original : seule la ligne « Développé par oré » est affichée."}
              </p>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Aperçu</CardTitle>
            <CardDescription>Écran d&apos;accueil</CardDescription>
          </CardHeader>
          <CardContent>
            <Preview settings={draft} />
          </CardContent>
        </Card>
      </aside>

      <AnimatePresence>
        {dirty && (
          <motion.div
            role="region"
            aria-label="Modifications non enregistrées"
            initial={{ opacity: 0, y: 24, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 24, x: "-50%" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="fixed bottom-6 left-1/2 z-40 flex items-center gap-3 rounded-full border bg-background/90 py-2 pr-2 pl-4 shadow-lg ring-1 ring-black/5 backdrop-blur"
          >
            <Badge variant="secondary">Non enregistré</Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">⌘S pour enregistrer</span>
            <Button variant="ghost" onClick={() => setDraft(saved)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={save} disabled={disabled || saving}>
              {saving && <Spinner data-icon="inline-start" />}
              Enregistrer
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Preview({ settings }: { settings: SiteSettings }) {
  const { theme } = settings
  const fallback = "ui-rounded, system-ui, sans-serif"
  const bodyName = settings.files.fontBody ? UPLOADED_BODY_FONT : settings.bodyFont
  const titleName = (settings.files.fontDisplay ? UPLOADED_TITLE_FONT : settings.displayFont) ?? bodyName
  const title = titleName ? `"${titleName}", ${fallback}` : fallback
  const body = bodyName ? `"${bodyName}", ${fallback}` : fallback
  return (
    <div
      className="flex aspect-[4/5] flex-col items-center overflow-hidden rounded-xl p-5 text-center"
      style={{ background: `radial-gradient(120% 80% at 50% 40%, color-mix(in oklab, ${theme.background}, white 14%) 0%, ${theme.background} 70%)`, color: theme.foreground, fontFamily: body }}
    >
      <div className="mt-4 flex h-16 w-full items-center justify-center">
        {settings.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logo} alt="" className="max-h-full max-w-[80%] object-contain" />
        ) : (
          <p className="text-2xl leading-tight font-black" style={{ fontFamily: title }}>
            {settings.title || "Titre"}
          </p>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-[11px] opacity-70">{settings.description}</p>
      <div className="mt-5 w-full space-y-2 rounded-lg p-3 text-left text-xs" style={{ background: theme.surface }}>
        <p className="font-bold tracking-wider uppercase opacity-60" style={{ fontFamily: title, fontSize: 9 }}>
          Options de la partie
        </p>
        <div className="flex items-center justify-between">
          <span>Joueurs</span>
          <span className="font-bold tabular-nums">
            {settings.minPlayers}–{settings.maxPlayers}
          </span>
        </div>
        <div className="h-6 rounded-md" style={{ background: theme.surfaceDark }} />
      </div>
      <div className="mt-auto w-full rounded-lg py-2.5 text-sm font-bold uppercase" style={{ background: theme.foreground, color: theme.background, fontFamily: title }}>
        Créer une partie
      </div>
      <div className="mt-2 w-full rounded-lg py-2 text-xs font-bold uppercase" style={{ background: theme.accent, color: theme.background, fontFamily: title }}>
        Accent
      </div>
    </div>
  )
}
