import { describe, expect, it } from "vitest"
import { BLENDS, compositeOf, MAT_SIZE, type MatLayer, matKey } from "./mat"

describe("how a canvas names a blend", () => {
  it("calls the covering one source-over and keeps the name of every other", () => {
    expect(compositeOf("normal")).toBe("source-over")
    for (const blend of BLENDS.filter((blend) => blend !== "normal")) expect(compositeOf(blend)).toBe(blend)
  })

  it("has the blends of CSS that Courtisans' cloth asks for: multiply, screen, overlay and soft light", () => {
    for (const blend of ["multiply", "screen", "overlay", "soft-light"]) expect(BLENDS).toContain(blend)
  })
})

describe("the key of a mat", () => {
  const layers = (): MatLayer[] => [
    { kind: "lattice", line: "#17171b", diamonds: 3, width: 2.5 },
    { kind: "grain", strength: 0.3 },
  ]

  it("is the same for the same mat, whether or not the layers are the same objects", () => {
    expect(matKey("#0c0c0e", layers())).toBe(matKey("#0c0c0e", layers()))
  })

  it("is another for another colour, another layer, another parameter or another size", () => {
    const base = matKey("#0c0c0e", layers())
    expect(matKey("#0d0d0f", layers())).not.toBe(base)
    expect(matKey("#0c0c0e", layers().slice(0, 1))).not.toBe(base)
    expect(matKey("#0c0c0e", [{ kind: "lattice", line: "#17171b", diamonds: 4, width: 2.5 }, { kind: "grain", strength: 0.3 }])).not.toBe(base)
    expect(matKey("#0c0c0e", layers(), 1024)).not.toBe(base)
    expect(matKey("#0c0c0e", layers(), MAT_SIZE)).toBe(base)
  })

  it("is another for another order of the same layers: the order is what the mat looks like", () => {
    expect(matKey("#0c0c0e", layers().reverse())).not.toBe(matKey("#0c0c0e", layers()))
  })

  it("tells pictures apart by the object, the same one being the same picture and any other another", () => {
    const wood = { width: 8, height: 8 } as unknown as CanvasImageSource
    const stone = { width: 8, height: 8 } as unknown as CanvasImageSource
    const laid = (picture: CanvasImageSource): MatLayer[] => [{ kind: "picture", picture, blend: "multiply" }]
    expect(matKey("#222222", laid(wood))).toBe(matKey("#222222", laid(wood)))
    expect(matKey("#222222", laid(wood))).not.toBe(matKey("#222222", laid(stone)))
  })

  it("tells a texture by its id, so a game that loads it again gets the picture made again", () => {
    const texture = (uuid: string) => ({ isTexture: true, uuid, image: {} }) as unknown as MatLayer & { kind: "picture" }
    const one = [{ kind: "picture", picture: texture("a") as never }] as MatLayer[]
    expect(matKey("#222222", one)).toContain("a")
  })
})
