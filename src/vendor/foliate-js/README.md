# Vendored foliate-js

Source: https://github.com/johnfactotum/foliate-js (MIT, see `LICENSE`)
Commit: 78914aef4466eb960965702401634c2cb348e9b1 (2026-05-01)

Copied unmodified, except:

- `pdf.js`, `mobi.js`, `comic-book.js`, `fixed-layout.js` and `tts.js` are replaced by stubs: those formats and
  features are out of scope (`vendor/pdfjs` is not vendored).
- `reader.js`, `reader.html`, `opds.js`, `dict.js`, `ui/menu.js`, tests and build files are not vendored.

To update, copy the same files from a newer upstream commit and update the commit above.
