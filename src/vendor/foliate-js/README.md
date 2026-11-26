# Vendored foliate-js

Source: https://github.com/johnfactotum/foliate-js (MIT, see `LICENSE`)
Commit: 78914aef4466eb960965702401634c2cb348e9b1 (2026-05-01)

Copied unmodified, except:

- `pdf.js`, `mobi.js`, `comic-book.js`, `fixed-layout.js` and `tts.js` are replaced by stubs: those formats and
  features are out of scope (`vendor/pdfjs` is not vendored).
- `reader.js`, `reader.html`, `opds.js`, `dict.js`, `ui/menu.js`, tests and build files are not vendored.
- `paginator.js`: `expand()` skips a measurement of zero pages, which stalled giant sections (reader-core 0.3.1).
- `fb2.js`: a section longer than `SECTION_LIMIT` is cut into parts, so the paginator lays out less at a time.
  A book with a cut section tags its CFIs (`[fb2-parts-<limit>]` on the spine step), and `book.resolveCFI` /
  `book.upgradeCFI` move an untagged CFI, saved before the cut, onto the part that holds its place.
  `makeFB2` takes `{ sectionLimit }` for tests.
- `epubcfi.js`: `toString` is exported (`fb2.js` builds CFIs with it).

To update, copy the same files from a newer upstream commit, carry the changes above over, and update the commit above, and the `foliate-js`
field in reader-core's `package.json` (apps show it in `--version`).
