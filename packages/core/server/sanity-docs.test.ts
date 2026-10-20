import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { DOCS, draftId, draftState, eachVersion, fetchDoc, isStale, RAW_PERSPECTIVE, readId, readVersions, type Version, writeTargets } from "./sanity-docs"
import { at, fakeSanity, T0 } from "./test-sanity"

const version = (published: string | null, draft: string | null): Version => ({ published, draft })

/** The states a singleton can be in, from the point of view of the gamemaster. */
const NONE = version(null, null)
const PUBLISHED_ONLY = version(T0, null)
const LONE_DRAFT = version(null, at(30))
const FRESH_DRAFT = version(T0, at(30))
const SAME_TIME = version(T0, T0)
const STALE_DRAFT = version(at(120), at(30))

/** A build for `eachVersion` that sets the title of every target it is given. */
const setTitle =
  (title: string): Parameters<typeof eachVersion>[2] =>
  (target, tx) => {
    tx.patch(target, (p) => p.set({ title }))
  }

describe("draftId", () => {
  it("is the id the Studio gives the draft of a document", () => {
    expect(draftId("settings")).toBe("drafts.settings")
  })
})

describe("isStale", () => {
  it("is true only for a draft written before the published document", () => {
    const cases: Array<[string, Version, boolean]> = [
      ["no version", NONE, false],
      ["published only", PUBLISHED_ONLY, false],
      ["lone draft", LONE_DRAFT, false],
      ["draft newer than the published document", FRESH_DRAFT, false],
      ["same time (a save writes both)", SAME_TIME, false],
      ["draft older than the published document", STALE_DRAFT, true],
      ["a date that cannot be read", version("not a date", at(30)), false],
    ]
    for (const [label, v, expected] of cases) expect(isStale(v), label).toBe(expected)
  })
})

describe("readId", () => {
  it("follows what the Studio shows: the draft, unless it is stale", () => {
    const cases: Array<[string, Version | undefined, string]> = [
      ["unknown", undefined, "settings"],
      ["no version", NONE, "settings"],
      ["published only", PUBLISHED_ONLY, "settings"],
      ["lone draft", LONE_DRAFT, "drafts.settings"],
      ["fresh draft", FRESH_DRAFT, "drafts.settings"],
      ["same time", SAME_TIME, "drafts.settings"],
      ["stale draft", STALE_DRAFT, "settings"],
    ]
    for (const [label, v, expected] of cases) expect(readId("settings", v), label).toBe(expected)
  })
})

describe("writeTargets", () => {
  it("creates the published document only when neither version exists", () => {
    expect(writeTargets("settings", undefined)).toEqual({ ids: ["settings"], create: true })
    expect(writeTargets("settings", NONE)).toEqual({ ids: ["settings"], create: true })
  })

  it("writes the draft alone when nothing is published, so only the owner publishes", () => {
    expect(writeTargets("settings", LONE_DRAFT)).toEqual({ ids: ["drafts.settings"], create: false })
  })

  it("writes the published document alone when there is no draft", () => {
    expect(writeTargets("settings", PUBLISHED_ONLY)).toEqual({ ids: ["settings"], create: false })
  })

  it("writes the published document and a fresh draft together", () => {
    expect(writeTargets("settings", FRESH_DRAFT)).toEqual({ ids: ["settings", "drafts.settings"], create: false })
    expect(writeTargets("settings", SAME_TIME)).toEqual({ ids: ["settings", "drafts.settings"], create: false })
  })

  it("never writes a stale draft", () => {
    expect(writeTargets("settings", STALE_DRAFT)).toEqual({ ids: ["settings"], create: false })
  })
})

describe("draftState", () => {
  it("names the drafts the owner has to know about, and only those", () => {
    const cases: Array<[string, Version | undefined, ReturnType<typeof draftState>]> = [
      ["unknown", undefined, null],
      ["no version", NONE, null],
      ["published only", PUBLISHED_ONLY, null],
      ["lone draft", LONE_DRAFT, "unpublished"],
      ["fresh draft", FRESH_DRAFT, null],
      ["stale draft", STALE_DRAFT, "stale"],
    ]
    for (const [label, v, expected] of cases) expect(draftState(v), label).toBe(expected)
  })
})

describe("readVersions", () => {
  it("asks for each document and its draft in one query, in the raw perspective", async () => {
    const fake = fakeSanity()
    await readVersions(fake.client, DOCS)
    expect(fake.fetches).toHaveLength(1)
    expect(fake.fetches[0]!.params).toEqual({ ids: ["settings", "drafts.settings", "interface", "drafts.interface", "audio", "drafts.audio", "texts", "drafts.texts"] })
    expect(fake.fetches[0]!.options).toEqual(RAW_PERSPECTIVE)
  })

  it("tells when each version was written, null for a version that does not exist", async () => {
    const fake = fakeSanity([
      { _id: "settings", _type: "settings" },
      { _id: "drafts.settings", _type: "settings", _updatedAt: at(60) },
      { _id: "drafts.interface", _type: "interface", _updatedAt: at(5) },
      { _id: "texts", _type: "texts", _updatedAt: at(90) },
    ])
    expect(await readVersions(fake.client, DOCS)).toEqual({
      settings: { published: T0, draft: at(60) },
      interface: { published: null, draft: at(5) },
      audio: { published: null, draft: null },
      texts: { published: at(90), draft: null },
    })
  })
})

describe("fetchDoc", () => {
  it("reads one version by its own id, in the raw perspective", async () => {
    const fake = fakeSanity([{ _id: "drafts.audio", _type: "audio", volumes: { master: 1 } }])
    expect(await fetchDoc(fake.client, "drafts.audio", "{ volumes }")).toMatchObject({ _id: "drafts.audio", volumes: { master: 1 } })
    expect(fake.fetches[0]).toEqual({ query: "*[_id == $id][0]{ volumes }", params: { id: "drafts.audio" }, options: RAW_PERSPECTIVE })
  })

  it("is null for a version that does not exist", async () => {
    const fake = fakeSanity([{ _id: "drafts.audio", _type: "audio" }])
    expect(await fetchDoc(fake.client, "audio", "{ volumes }")).toBeNull()
  })
})

describe("eachVersion", () => {
  it("creates the published document, in the same transaction as the patch, when neither version exists", async () => {
    const fake = fakeSanity()
    await eachVersion(fake.client, "settings", setTitle("New"))
    expect(fake.touched()).toEqual([["+settings", "settings"]])
    expect(fake.doc("settings")).toMatchObject({ _id: "settings", _type: "settings", title: "New" })
    expect(fake.ids()).toEqual(["settings"])
  })

  it("patches the published document alone when there is no draft, and creates none", async () => {
    const fake = fakeSanity([{ _id: "settings", _type: "settings", title: "Old" }])
    await eachVersion(fake.client, "settings", setTitle("New"))
    expect(fake.touched()).toEqual([["settings"]])
    expect(fake.doc("settings")!.title).toBe("New")
    expect(fake.ids()).toEqual(["settings"])
  })

  it("patches the published document and a fresh draft together, in one commit", async () => {
    const fake = fakeSanity([
      { _id: "settings", _type: "settings", title: "Old" },
      { _id: "drafts.settings", _type: "settings", title: "Old draft", _updatedAt: at(30) },
    ])
    await eachVersion(fake.client, "settings", setTitle("New"))
    expect(fake.touched()).toEqual([["settings", "drafts.settings"]])
    expect(fake.doc("settings")!.title).toBe("New")
    expect(fake.doc("drafts.settings")!.title).toBe("New")
    expect(fake.doc("drafts.settings")!._updatedAt).toBe(fake.doc("settings")!._updatedAt)
  })

  it("patches the draft alone when nothing is published, and publishes nothing", async () => {
    const fake = fakeSanity([{ _id: "drafts.settings", _type: "settings", title: "Old draft" }])
    await eachVersion(fake.client, "settings", setTitle("New"))
    expect(fake.touched()).toEqual([["drafts.settings"]])
    expect(fake.doc("drafts.settings")!.title).toBe("New")
    expect(fake.ids()).toEqual(["drafts.settings"])
  })

  it("never touches a stale draft", async () => {
    const fake = fakeSanity([
      { _id: "settings", _type: "settings", title: "Live", _updatedAt: at(120) },
      { _id: "drafts.settings", _type: "settings", title: "Old draft", matTexture: "texture", _updatedAt: at(30) },
    ])
    const draft = structuredClone(fake.doc("drafts.settings"))
    await eachVersion(fake.client, "settings", setTitle("New"))
    expect(fake.touched()).toEqual([["settings"]])
    expect(fake.doc("settings")!.title).toBe("New")
    expect(fake.doc("drafts.settings")).toEqual(draft)
  })

  it("does nothing for a removal when no version exists (create: false), instead of creating an empty document", async () => {
    const fake = fakeSanity()
    const build = vi.fn()
    await eachVersion(fake.client, "settings", build, { create: false })
    expect(build).not.toHaveBeenCalled()
    expect(fake.commits).toEqual([])
    expect(fake.ids()).toEqual([])
  })

  it("still reaches the versions that exist when create is false", async () => {
    const fake = fakeSanity([{ _id: "settings", _type: "settings", logo: "file" }])
    await eachVersion(fake.client, "settings", (target, tx) => void tx.patch(target, (p) => p.unset(["logo"])), { create: false })
    expect(fake.touched()).toEqual([["settings"]])
    expect(fake.doc("settings")).not.toHaveProperty("logo")
  })

  it("commits nothing when build adds no patch, and leaves no empty document behind", async () => {
    const empty = fakeSanity()
    await eachVersion(empty.client, "settings", () => {})
    expect(empty.commits).toEqual([])
    expect(empty.ids()).toEqual([])

    const existing = fakeSanity([{ _id: "settings", _type: "settings" }])
    await eachVersion(existing.client, "settings", () => {})
    expect(existing.commits).toEqual([])
  })

  it("reads the versions once, however many targets there are", async () => {
    const fake = fakeSanity([
      { _id: "settings", _type: "settings" },
      { _id: "drafts.settings", _type: "settings", _updatedAt: at(30) },
    ])
    await eachVersion(fake.client, "settings", setTitle("New"))
    expect(fake.fetches.map((f) => f.query)).toEqual(["*[_id in $ids]{ _id, _updatedAt }"])
    expect(fake.fetches[0]!.params).toEqual({ ids: ["settings", "drafts.settings"] })
  })

  it("lets build read each version before it patches it, one target after the other, published first", async () => {
    const fake = fakeSanity([
      { _id: "settings", _type: "settings", count: 1 },
      { _id: "drafts.settings", _type: "settings", count: 10, _updatedAt: at(30) },
    ])
    const seen: string[] = []
    await eachVersion(fake.client, "settings", async (target, tx) => {
      const current = await fetchDoc<{ count: number }>(fake.client, target, "{ count }")
      seen.push(target)
      tx.patch(target, (p) => p.set({ count: current!.count + 1 }))
    })
    expect(seen).toEqual(["settings", "drafts.settings"])
    expect(fake.doc("settings")!.count).toBe(2)
    expect(fake.doc("drafts.settings")!.count).toBe(11)
    expect(fake.commits).toHaveLength(1)
  })

  it("keeps the patches of one target in order, so a parent can be created before its child path is set", async () => {
    const fake = fakeSanity([{ _id: "audio", _type: "audio" }])
    await eachVersion(fake.client, "audio", (target, tx) => {
      tx.patch(target, (p) => p.setIfMissing({ ambience: { _type: "audioLoop" } }))
      tx.patch(target, (p) => p.set({ "ambience.loopEnd": 12 }))
    })
    expect(fake.doc("audio")!.ambience).toEqual({ _type: "audioLoop", loopEnd: 12 })
  })

  it("writes nothing when build throws, even after it patched an earlier target", async () => {
    const fake = fakeSanity([
      { _id: "settings", _type: "settings", title: "Old" },
      { _id: "drafts.settings", _type: "settings", title: "Old draft", _updatedAt: at(30) },
    ])
    await expect(
      eachVersion(fake.client, "settings", (target, tx) => {
        tx.patch(target, (p) => p.set({ title: "New" }))
        if (target.startsWith("drafts.")) throw new Error("boom")
      }),
    ).rejects.toThrow("boom")
    expect(fake.commits).toEqual([])
    expect(fake.doc("settings")!.title).toBe("Old")
    expect(fake.doc("drafts.settings")!.title).toBe("Old draft")
  })

  it("is atomic: when the dataset refuses one patch, no document of the save changes", async () => {
    const fake = fakeSanity([
      { _id: "settings", _type: "settings", title: "Old" },
      { _id: "drafts.settings", _type: "settings", title: "Old draft", _updatedAt: at(30) },
    ])
    await expect(
      eachVersion(fake.client, "settings", (target, tx) => {
        tx.patch(target, (p) => p.set({ title: "New" }))
        if (target.startsWith("drafts.")) tx.patch("drafts.nothing", (p) => p.set({ title: "New" }))
      }),
    ).rejects.toThrow('"drafts.nothing" not found')
    expect(fake.commits).toEqual([])
    expect(fake.doc("settings")!.title).toBe("Old")
    expect(fake.doc("drafts.settings")!.title).toBe("Old draft")
  })
})
