import Foundation
import PDFKit
import AppKit

// pdf-pages.swift <file.pdf> <outDir> [scale]
// Renders every page to <outDir>/page-NN.png: the page's media box times the scale (1.5 by default; a small booklet page needs 4 to be readable).
// A reading aid for a machine that has no poppler (`pdftoppm`): it runs with the Swift, PDFKit and AppKit that macOS has, so there is nothing to install.
// The pictures are temporary: put <outDir> outside the repo, and never use one as an asset (pictures are handed over, never made).
//   swift scripts/pdf/pdf-pages.swift ~/rules.pdf /tmp/rules-pages 4
let args = CommandLine.arguments
guard args.count >= 3, args.count <= 4 else {
  print("usage: pdf-pages.swift file.pdf outDir [scale]")
  exit(2)
}
guard let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  print("cannot open the PDF")
  exit(1)
}
let out = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let scale = args.count > 3 ? (Double(args[3]) ?? 1.5) : 1.5
for index in 0..<doc.pageCount {
  guard let page = doc.page(at: index) else { continue }
  let box = page.bounds(for: .mediaBox)
  let size = CGSize(width: box.width * scale, height: box.height * scale)
  let image = page.thumbnail(of: size, for: .mediaBox)
  guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else { continue }
  try png.write(to: out.appendingPathComponent(String(format: "page-%02d.png", index + 1)))
}
print("rendered \(doc.pageCount) pages to \(out.path)")
