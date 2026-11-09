import type { SecondStepSetup } from "@pbgo/accounts/client"

// What the demo account of development is shown when it sets the second step up (docs/accounts.md, "The demo account"): it holds no session, so nothing can be asked of Supabase Auth, and the window of the settings is drawn all the same, with a
// made-up key and a picture that looks like a QR code and is not one (nothing can be scanned from it). Only the demo account ever reads it, and it exists in development alone.

const SIZE = 25

/** A square of the picture is dark: the three finder patterns of a QR code at its corners, and a fixed pseudo-random fill between them (the same picture every time, which is all a demo needs). */
function dark(x: number, y: number, seed: number): boolean {
  for (const [cx, cy] of [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ]) {
    const dx = x - cx
    const dy = y - cy
    if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) {
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false
      return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
    }
  }
  return ((x * 73856093) ^ (y * 19349663) ^ seed) % 5 < 2
}

/** The picture, as an SVG data URI that an `<img>` takes (`qrImageOf` of `@pbgo/accounts` takes the same). */
function demoQr(): string {
  let path = ""
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (dark(x, y, 2026)) path += `M${x} ${y}h1v1h-1z`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${SIZE + 2} ${SIZE + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${SIZE + 2}" height="${SIZE + 2}" fill="white"/><path fill="black" d="${path}"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** The set-up the demo account's window shows. */
export const DEMO_SETUP: SecondStepSetup = { factorId: "demo-factor", qr: demoQr(), secret: "DEMOKEYDEMOKEYDEMOKEYDEMOKEYAB23" }
