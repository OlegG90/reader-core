// @vitest-environment jsdom
/// <reference types="node" />
import { File } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// Guards the FB2 requirements that rely on the vendored foliate-js parser.
// jsdom lacks Document.xmlEncoding, so these exercise fb2.js's fallback that
// reads the encoding from the XML declaration; WebView2 has both paths.

let fb2: typeof import('./vendor/foliate-js/fb2.js')
let CFI: typeof import('./vendor/foliate-js/epubcfi.js')

beforeAll(async () => {
  // jsdom has no object URLs; fb2.js creates one for its stylesheet on import.
  URL.createObjectURL = () => 'blob:stub'
  fb2 = await import('./vendor/foliate-js/fb2.js')
  CFI = await import('./vendor/foliate-js/epubcfi.js')
})

const sample = (name: string) => new File([readFileSync(resolve(import.meta.dirname, '../samples', name))], name)

/** An FB2 file with the given title and bodies (by default one short section). */
const fb2File = (title: string, bodies = '<body><section><p>Text</p></section></body>') =>
  new File(
    [
      `<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">` +
        `<description><title-info><book-title>${title}</book-title></title-info></description>` +
        `${bodies}</FictionBook>`,
    ],
    `${title}.fb2`,
  )

describe('FB2', () => {
  it('decodes windows-1251 using the XML declaration', async () => {
    const book = await fb2.makeFB2(sample('sample-windows-1251.fb2'))
    expect(book.metadata.title).toBe('Зразок: Містечко над річкою')
    expect(book.metadata.language).toBe('uk')
    expect(book.toc.map((item: { label: string }) => item.label)).toContain('Розділ 1. Ранок')
  })

  it('reads UTF-8 when there is no XML declaration', async () => {
    const book = await fb2.makeFB2(fb2File('Без декларації'))
    expect(book.metadata.title).toBe('Без декларації')
  })

  describe('a giant section', () => {
    const paragraph = (i: number) => `<p>${'The harbour bell counted the hours. '.repeat(10)}${i}.</p>`
    const paragraphs = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, i) => paragraph(from + i)).join('\n')
    // one chapter of three ~120k-character subsections, with a footnote
    const giant = fb2File(
      'Giant',
      `<body><section><p>Short opening</p></section>` +
        `<section><title><p>Giant</p></title>` +
        `<section><title><p>Part A</p></title>\n${paragraphs(0, 330)}\n</section>\n` +
        `<section><title><p>Part B</p></title>${paragraphs(330, 660)}<p>See <a l:href="#n1" type="note">1</a></p></section>` +
        `<section><title><p>Part C</p></title>${paragraphs(660, 990)}</section>` +
        `</section></body>` +
        `<body name="notes"><section id="n1"><p>The note</p></section></body>`,
    )
    // a chapter whose giant part is three levels down, between short blocks
    const deep = fb2File(
      'Deep',
      `<body><section><title><p>Deep</p></title><epigraph><p>Before</p></epigraph>` +
        `<section><title><p>Level 2</p></title><p>Lead</p>` +
        `<section><title><p>Level 3</p></title>${paragraphs(0, 700)}</section>` +
        `<p>Tail</p></section><p>Coda</p></section></body>`,
    )
    type Section = { createDocument: () => Document; linear?: string }
    const text = (sections: Section[]) => sections.map(s => s.createDocument().body.textContent).join('')

    it('is cut into parts no longer than the limit, losing no text', async () => {
      const book = await fb2.makeFB2(giant)
      const parts: Section[] = book.sections.slice(1, -1)
      expect(parts.length).toBeGreaterThan(3)
      for (const part of parts) expect(part.createDocument().body.textContent!.length).toBeLessThanOrEqual(fb2.SECTION_LIMIT)
      const all = text(parts)
      let at = -1
      for (let i = 0; i < 990; i++) {
        const next = all.indexOf(`hours. ${i}.`)
        expect(next).toBeGreaterThan(at)
        at = next
      }
    })

    it('keeps the contents pointing at the part that holds each title', async () => {
      const book = await fb2.makeFB2(giant)
      const chapter = book.toc[1]
      expect(chapter.label).toBe('Giant')
      expect(chapter.href).toBe('1')
      expect(chapter.subitems!.map((item: { label: string }) => item.label)).toEqual(['Part A', 'Part B', 'Part C'])
      for (const item of chapter.subitems!) {
        const { index, anchor } = book.resolveHref(item.href)
        expect(anchor(book.sections[index].createDocument())?.textContent).toBe(item.label)
      }
    })

    it('resolves a footnote link and marks the later parts as continued', async () => {
      const book = await fb2.makeFB2(giant)
      expect(book.sections[book.resolveHref('#n1').index].linear).toBe('no')
      const outer = (i: number) => book.sections[i].createDocument().querySelector('body > section')
      expect(outer(1)?.hasAttribute('data-foliate-continued')).toBe(false)
      expect(outer(2)?.hasAttribute('data-foliate-continued')).toBe(true)
    })

    it('cuts a long notes body and still finds each note', async () => {
      const notes = Array.from({ length: 400 }, (_, i) => `<section id="n${i}">${paragraph(i)}</section>`).join('')
      const book = await fb2.makeFB2(
        fb2File('Notes', `<body><section><p>Text</p></section></body><body name="notes">${notes}</body>`),
      )
      expect(book.sections.length).toBeGreaterThan(2)
      for (const i of [0, 199, 399]) {
        const { index, anchor } = book.resolveHref(`#n${i}`)
        expect(book.sections[index].linear).toBe('no')
        expect(anchor(book.sections[index].createDocument())?.textContent).toContain(`hours. ${i}.`)
      }
    })

    it('leaves a short chapter whole, with its CFIs as they were', async () => {
      const book = await fb2.makeFB2(fb2File('Short'))
      expect(book.sections).toHaveLength(1)
      expect(book.sections[0].cfi).toBeUndefined()
      expect(book.resolveCFI).toBeUndefined()
      expect(book.upgradeCFI('epubcfi(/6/2!/4/2/2/1:3)')).toBe('epubcfi(/6/2!/4/2/2/1:3)')
    })

    describe('CFIs', () => {
      type Book = Awaited<ReturnType<typeof fb2.makeFB2>>
      const textNodes = (doc: Document) => {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        while (walker.nextNode()) nodes.push(walker.currentNode as Text)
        return nodes
      }
      const point = (doc: Document, node: Node, offset: number) => {
        const range = doc.createRange()
        range.setStart(node, offset)
        return range
      }
      // resolves a CFI in the book the way foliate-js's view does
      const resolve = (book: Book, docs: Map<number, Document>, cfi: string) => {
        const { index, anchor } = book.resolveCFI(cfi)
        if (!docs.has(index)) docs.set(index, book.sections[index].createDocument())
        return anchor(docs.get(index)) as Range
      }

      it.each([
        ['giant', giant],
        ['deep', deep],
      ])('moves every CFI saved before the cut to the same text (%s)', async (_, file) => {
        const old = await fb2.makeFB2(file, { sectionLimit: Infinity })
        const book = await fb2.makeFB2(file)
        expect(book.sections.length).toBeGreaterThan(old.sections.length + 2)
        const docs = new Map<number, Document>()
        for (const [i, section] of old.sections.entries()) {
          const doc = section.createDocument()
          for (const node of textNodes(doc)) {
            const offset = Math.min(7, node.length)
            const cfi = CFI.joinIndir(CFI.fake.fromIndex(i), CFI.fromRange(point(doc, node, offset)))
            const range = resolve(book, docs, cfi)
            expect(range.startContainer.textContent).toBe(node.textContent)
            expect(range.startOffset).toBe(offset)
          }
        }
        expect(docs.size).toBe(book.sections.length)
      })

      it('moves the start of an old page range and leaves new CFIs alone', async () => {
        const old = await fb2.makeFB2(giant, { sectionLimit: Infinity })
        const book = await fb2.makeFB2(giant)
        const doc = old.sections[1].createDocument()
        const nodes = textNodes(doc).filter(node => node.textContent!.includes('hours. 500.'))
        const range = doc.createRange()
        range.setStart(nodes[0], 3)
        range.setEnd(textNodes(doc).find(node => node.textContent!.includes('hours. 510.'))!, 2)
        const cfi = CFI.joinIndir(CFI.fake.fromIndex(1), CFI.fromRange(range))
        const upgraded = book.upgradeCFI(cfi)
        expect(upgraded).toContain(`[fb2-parts-${fb2.SECTION_LIMIT}]`)
        expect(book.upgradeCFI(upgraded)).toBe(upgraded)

        const docs = new Map<number, Document>()
        const moved = resolve(book, docs, cfi)
        expect(moved.startContainer.textContent).toContain('hours. 500.')
        expect(moved.startOffset).toBe(3)

        // a CFI made in the cut book, as the view makes it, comes back to its place
        const index = [...docs.keys()][0]
        const fresh = CFI.joinIndir(book.sections[index].cfi, CFI.fromRange(moved))
        const back = resolve(book, docs, fresh)
        expect(back.startContainer).toBe(moved.startContainer)
        expect(back.startOffset).toBe(3)
      })
    })
  })

  it('opens a zipped UTF-8 book (.fb2.zip)', async () => {
    const { makeBook } = await import('./vendor/foliate-js/view.js')
    const book = await makeBook(sample('sample-utf8.fb2.zip'))
    expect(book.metadata?.title).toBe('Sample: The Lighthouse')
  })
})
