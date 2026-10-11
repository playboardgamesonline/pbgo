import { isProjectId } from "./env"

/**
 * The URL when it is an asset (`/images/…` or `/files/…`) of one of the given Sanity projects on the Sanity CDN
 * (`https://cdn.sanity.io/<images|files>/<projectId>/<dataset>/<asset>`), else null.
 *
 * The URL is parsed and normalized before the check (`..` segments are resolved, host and scheme lowercased): fetch the
 * returned URL, never the original text. Encoded characters in the path are refused (an asset path is made of
 * letters, digits and `.-_`), so the CDN cannot read the path differently from the check.
 */
export function sanityAssetUrl(value: string | null | undefined, projectIds: readonly (string | null | undefined)[]): URL | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.hostname !== "cdn.sanity.io" || url.port || url.username || url.password) return null
  if (url.pathname.includes("%")) return null
  const [root, kind, projectId] = url.pathname.split("/")
  if (root !== "" || (kind !== "images" && kind !== "files") || !projectId) return null
  return projectIds.some((id) => isProjectId(id) && id === projectId) ? url : null
}
