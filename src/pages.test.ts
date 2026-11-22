import { describe, expect, it } from 'vitest'
import { chapterPage, pageLabels } from './pages'

// `pages` counts the paginator's blank screen on each side of the text.
describe('pageLabels', () => {
  it('numbers single-column pages within the chapter', () => {
    expect(pageLabels({ page: 1, pages: 14, columns: 1 })).toEqual(['1 / 12'])
    expect(pageLabels({ page: 12, pages: 14, columns: 1 })).toEqual(['12 / 12'])
  })

  it('numbers both pages of a two-column spread', () => {
    expect(pageLabels({ page: 3, pages: 11, columns: 2 })).toEqual(['5 / 18', '6 / 18'])
  })

  it('uses the measured page count when the last spread is half empty', () => {
    expect(pageLabels({ page: 9, pages: 11, columns: 2, textColumns: 17 })).toEqual(['17 / 17', ''])
  })

  it('shows nothing on the blank screens around a chapter or without text', () => {
    expect(pageLabels({ page: 0, pages: 7, columns: 2 })).toEqual(['', ''])
    expect(pageLabels({ page: 6, pages: 7, columns: 1 })).toEqual([''])
    expect(pageLabels({ page: 1, pages: 2, columns: 1 })).toEqual([''])
  })
})

describe('chapterPage', () => {
  it('is the first column on screen, of the pages that hold text', () => {
    expect(chapterPage({ page: 3, pages: 12, columns: 2, textColumns: 19 })).toEqual({ page: 5, of: 19 })
    expect(chapterPage({ page: 1, pages: 6, columns: 1 })).toEqual({ page: 1, of: 4 })
  })

  it('is null on the blank screens at either edge', () => {
    expect(chapterPage({ page: 0, pages: 6, columns: 1 })).toBeNull()
    expect(chapterPage({ page: 5, pages: 6, columns: 1 })).toBeNull()
  })
})
