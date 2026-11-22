/**
 * reader-core: the reading part shared by Simple Reader and Book Reader.
 * BookView shows a book (EPUB, FB2, or a book object an app builds) with
 * foliate-js; the rest is what it needs and what apps style it with.
 */
export { BookView, type Book, type BookSource, type BookStyle, type Relocation, type TocItem } from './book-view'
export * from './appearance'
export type { Flow } from './layout'
export { el, suppressContextMenu } from './dom'
