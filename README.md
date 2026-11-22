# reader-core

The reading part shared by [Simple Reader](https://github.com/OlegG90/simple-reader) and Book Reader:

- **`BookView`** (`src/book-view.ts`, laid out by `src/book-view.css`): shows a book with [foliate-js](https://github.com/johnfactotum/foliate-js) — an EPUB or FB2 file, or a book object an app builds itself (Simple Reader's Markdown). Paginated or scrolled, page numbers under the columns, footnotes in a pop-up, mouse wheel, clicks on the page edges and touch (taps on the sides turn pages, the middle shows the app's menu).
- **Appearance** (`appearance.ts`): themes, fonts, sizes, line spacing and length, and the CSS that applies them to the book.
- **Layout** (`layout.ts`, `pages.ts`): columns and page labels; **touch** (`touch.ts`): taps and tap zones; **dom** (`dom.ts`): small DOM helpers.
- **foliate-js**, vendored and slimmed (see `src/vendor/foliate-js/README.md`), importable as `reader-core/foliate-js/<file>.js`.

What differs per app stays in the app: key bindings, settings panels, the library, Markdown, the Tauri backend.

## Use

The package is TypeScript source, compiled by the app's own Vite / tsc (`moduleResolution: "bundler"`). Apps depend on a tag:

```json
"dependencies": { "reader-core": "git+https://github.com/OlegG90/reader-core.git#v0.2.0" }
```

An app also needs:

- `.npmrc` with `allow-git=root`: npm 12 refuses git dependencies unless allowed;
- `"allowJs": true, "maxNodeModuleJsDepth": 3` in `tsconfig.json`, so the foliate-js imports get the types tsc infers from its JavaScript;
- the stylesheet, and the colours it uses (`--muted`, `--panel`, `--line`, `--shadow`; see `book-view.css`).

```ts
import { BookView, bookCss, type Relocation } from 'reader-core'
import 'reader-core/book-view.css'
import { createTOCView } from 'reader-core/foliate-js/ui/tree.js'
```

A change here is a new tag, then a bump in each app.

## Develop

```
npm install
npm test        # vitest (jsdom), including FB2 parsing on the samples
npm run check   # tsc
```

To try a change in an app before tagging: `npm install ../reader-core` in the app (then put the tag back).

## License

MIT. foliate-js is MIT too (`src/vendor/foliate-js/LICENSE`).
