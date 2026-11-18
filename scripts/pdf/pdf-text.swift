import Foundation
import PDFKit

// pdf-text.swift <file.pdf> [first] [last]
// Prints the page count and the text of the pages (numbered from 1, both ends included; every page when none is given).
// A reading aid for a machine that has no poppler (`pdftotext`, `pdftoppm`): it runs with the Swift and PDFKit that macOS has, so there is nothing to install.
// The text is jumbled where it sits on a picture (a table, a card): look at the page itself then (`pdf-pages.swift`). What it prints is never copied into the repo.
//   swift scripts/pdf/pdf-text.swift ~/rules.pdf 3 6
let args = CommandLine.arguments
guard args.count >= 2, args.count <= 4 else {
  print("usage: pdf-text.swift file.pdf [first] [last]")
  exit(2)
}
guard let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  print("cannot open the PDF")
  exit(1)
}
let first = max(1, args.count > 2 ? (Int(args[2]) ?? 1) : 1)
let last = min(doc.pageCount, args.count > 3 ? (Int(args[3]) ?? doc.pageCount) : doc.pageCount)
print("pages: \(doc.pageCount)")
if first <= last {
  for index in (first - 1)..<last {
    print("=== page \(index + 1)")
    print(doc.page(at: index)?.string ?? "")
  }
}
