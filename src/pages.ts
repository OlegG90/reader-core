/** Where the reader is within the current chapter, as foliate-js's paginator reports it. */
export interface ChapterLayout {
  /** The paginator's current screen (`renderer.page`). */
  page: number
  /** The paginator's screen count (`renderer.pages`), which includes a blank screen before and after the text. */
  pages: number
  /** Columns side by side on one screen. */
  columns: number
  /** Columns that actually hold text, if measured (the last screen may be half empty). */
  textColumns?: number
}

/** A page within the chapter: the first column on screen, of the chapter's pages. */
export interface ChapterPage {
  page: number
  of: number
}

/** The first page on screen and the chapter's page count; null on a blank edge screen. */
export function chapterPage({ page, pages, columns, textColumns }: ChapterLayout): ChapterPage | null {
  // Screens 1..pages-2 hold text; 0 and pages-1 are the paginator's blank edges.
  const screens = pages - 2
  if (page < 1 || page > screens) return null
  return { page: (page - 1) * columns + 1, of: Math.min(textColumns ?? Infinity, screens * columns) }
}

/**
 * The page label under each column on screen, e.g. `['5 / 18', '6 / 18']`
 * for a two-column spread. A column past the end of the chapter gets ''.
 */
export function pageLabels(layout: ChapterLayout): string[] {
  const at = chapterPage(layout)
  return Array.from({ length: layout.columns }, (_, i) => (at && at.page + i <= at.of ? `${at.page + i} / ${at.of}` : ''))
}
