import { createClient } from "@sanity/client"
import type { SanityClient } from "@sanity/client"
import { assertDraftId } from "./plan.ts"
import type { SeedStore, StoredDoc } from "./types.ts"

/** Ids per request: they travel in the URL. */
const CHUNK = 40

const chunks = <T>(items: T[], size: number): T[][] => {
  const parts: T[][] = []
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size))
  return parts
}

/** `drafts.x` and `versions.<release>.x` are both `x` once published. */
const publishedIdOf = (id: string) => id.replace(/^drafts\./, "").replace(/^versions\.[^.]+\./, "")

/** The seed's view of a dataset. Every write is a draft write: ids are checked before anything is sent. */
export function createSanityStore(client: SanityClient): SeedStore {
  const findAssets = async (type: "sanity.imageAsset" | "sanity.fileAsset", sha1s: string[]) => {
    const found = new Map<string, string>()
    if (!sha1s.length) return found
    const assets = await client.fetch<{ _id: string; sha1hash: string }[]>(`*[_type == "${type}" && sha1hash in $sha1s]{ _id, sha1hash }`, { sha1s })
    for (const asset of assets) found.set(asset.sha1hash, asset._id)
    return found
  }

  return {
    async getDocuments(ids) {
      const found = new Map<string, StoredDoc>()
      for (const part of chunks(ids, CHUNK)) {
        for (const doc of await client.getDocuments(part)) if (doc) found.set(doc._id, doc)
      }
      return found
    },

    async listDocumentIds(types) {
      const ids = await client.fetch<string[]>(`*[_type in $types]._id`, { types })
      return [...new Set(ids.map(publishedIdOf))]
    },

    findImageAssets: (sha1s) => findAssets("sanity.imageAsset", sha1s),

    async uploadImage(file) {
      const asset = await client.assets.upload("image", file.data, { filename: file.filename, contentType: file.contentType })
      return { _id: asset._id }
    },

    findFileAssets: (sha1s) => findAssets("sanity.fileAsset", sha1s),

    async uploadFile(file) {
      const asset = await client.assets.upload("file", file.data, { filename: file.filename, contentType: file.contentType })
      return { _id: asset._id }
    },

    async writeDrafts(ops) {
      if (!ops.length) return
      for (const op of ops) assertDraftId(op.type === "createIfNotExists" ? op.doc._id : op.id)
      // One transaction: every draft is written or none is
      const transaction = client.transaction()
      for (const op of ops) {
        if (op.type === "createIfNotExists") transaction.createIfNotExists(op.doc)
        else transaction.patch(op.id, { ifRevisionID: op.ifRevisionID, set: op.set })
      }
      await transaction.commit()
    },
  }
}

/** A client that reads every document, drafts and versions included (`raw` has to be asked for) and bypasses the CDN. */
export function connect({ projectId, dataset, apiVersion, token }: { projectId: string; dataset: string; apiVersion: string; token: string }): SeedStore {
  return createSanityStore(createClient({ projectId, dataset, apiVersion, token, useCdn: false, perspective: "raw" }))
}
