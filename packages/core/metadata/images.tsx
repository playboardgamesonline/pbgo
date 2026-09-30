import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { SITE_URL } from "@pgo/binding"
import { ImageResponse } from "next/og"
import sharp from "sharp"
import { loadSettings } from "../lib/settings-server"
import { loadSkin } from "../lib/skin-server"

/**
 * Favicon et image de partage générés depuis l'admin : le fichier envoyé (Identity) s'il existe,
 * sinon une composition faite avec l'habillage (Visual) : fond, motif, décors, personnage, logo et couleurs.
 */

/** Image de l'habillage : URL Sanity, /api/media, ou fichier de /public (lu sur le disque au build, sinon via le site). */
async function loadImage(src: string | null | undefined): Promise<Buffer | null> {
  if (!src) return null
  try {
    if (src.startsWith("/api/media?url=")) src = decodeURIComponent(src.slice("/api/media?url=".length))
    if (src.startsWith("/")) {
      try {
        return await readFile(path.join(process.cwd(), "public", src.split("?")[0]!))
      } catch {
        src = new URL(src, SITE_URL).toString()
      }
    }
    const res = await fetch(src, { next: { revalidate: 3600 } })
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null
  } catch {
    return null
  }
}

const dataUri = (buffer: Buffer, mime = "image/png") => `data:${mime};base64,${buffer.toString("base64")}`

async function png(buffer: Buffer | null, width: number, height?: number, fit: "cover" | "inside" = "inside") {
  if (!buffer) return null
  try {
    const out = await sharp(buffer).resize(width, height ?? null, { fit, withoutEnlargement: fit === "inside" }).png().toBuffer({ resolveWithObject: true })
    return { src: dataUri(out.data), width: out.info.width, height: out.info.height }
  } catch {
    return null
  }
}

const imageResponse = (buffer: Buffer, contentType: string) =>
  new Response(new Uint8Array(buffer), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } })

/* ------------------------------------------------------------------ favicon */

export async function renderIcon(size: number) {
  const settings = await loadSettings()
  const favicon = await loadImage(settings.favicon)
  if (favicon) {
    const out = await sharp(favicon).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    return imageResponse(out, "image/png")
  }
  // sans favicon : le logo sur un carré arrondi aux couleurs du thème, sinon l'initiale du titre
  const logo = await png(await loadImage(settings.logo), Math.round(size * 0.84), Math.round(size * 0.84))
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: settings.theme.background,
          borderRadius: size * 0.22,
          color: settings.theme.foreground,
          fontSize: size * 0.62,
          fontWeight: 800,
        }}
      >
        {logo ? <img src={logo.src} width={logo.width} height={logo.height} alt="" /> : settings.title.slice(0, 1).toUpperCase()}
      </div>
    ),
    { width: size, height: size },
  )
}

/* ------------------------------------------------------------------ image de partage */

export const SHARE_SIZE = { width: 1200, height: 630 }

export async function renderShareImage() {
  const [settings, skin] = await Promise.all([loadSettings(), loadSkin()])
  const custom = await loadImage(settings.shareImage)
  if (custom) return imageResponse(await sharp(custom).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer(), "image/jpeg")

  const { width: W, height: H } = SHARE_SIZE
  const wide = Math.round(W * 1.14)
  const [background, top, bottom, hero, logo, patternTile] = await Promise.all([
    png(await loadImage(skin.decor.background), W, H, "cover"),
    png(await loadImage(skin.decor.top?.url), wide),
    png(await loadImage(skin.decor.bottom?.url), wide),
    png(await loadImage(skin.decor.hero), 420, 260),
    png(await loadImage(settings.logo), 560, 230),
    loadImage(skin.decor.pattern),
  ])
  let pattern: string | null = null
  if (patternTile) {
    try {
      const tile = await sharp(patternTile).resize(128, 128).png().toBuffer()
      pattern = dataUri(await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: tile, tile: true }]).png().toBuffer())
    } catch {}
  }
  const { theme } = settings
  const bottomTop = bottom ? H - bottom.height + 8 : H
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", background: theme.background, color: theme.foreground }}>
        {background && <img src={background.src} width={W} height={H} alt="" style={{ position: "absolute", left: 0, top: 0 }} />}
        {pattern && <img src={pattern} width={W} height={H} alt="" style={{ position: "absolute", left: 0, top: 0, opacity: 0.07 }} />}
        <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: `radial-gradient(ellipse at 50% 45%, ${theme.surface} 0%, transparent 65%)`, opacity: 0.7 }} />
        {top && <img src={top.src} width={top.width} height={top.height} alt="" style={{ position: "absolute", top: 0, left: (W - top.width) / 2 }} />}
        {hero && (
          <img
            src={hero.src}
            width={hero.width}
            height={hero.height}
            alt=""
            style={{ position: "absolute", left: (W - hero.width) / 2, top: H - (bottom ? bottom.height * 0.18 : 30) - hero.height }}
          />
        )}
        {bottom && <img src={bottom.src} width={bottom.width} height={bottom.height} alt="" style={{ position: "absolute", top: bottomTop, left: (W - bottom.width) / 2 }} />}
        <div style={{ position: "absolute", left: 0, right: 0, top: top ? 70 : 90, display: "flex", justifyContent: "center" }}>
          {logo ? (
            <img src={logo.src} width={logo.width} height={logo.height} alt="" />
          ) : (
            <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -2, textAlign: "center", maxWidth: 1000 }}>{settings.title}</div>
          )}
        </div>
      </div>
    ),
    SHARE_SIZE,
  )
}
