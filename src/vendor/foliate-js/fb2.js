import * as CFI from './epubcfi.js'

const normalizeWhitespace = str => str ? str
    .replace(/[\t\n\f\r ]+/g, ' ')
    .replace(/^[\t\n\f\r ]+/, '')
    .replace(/[\t\n\f\r ]+$/, '') : ''
const getElementText = el => normalizeWhitespace(el?.textContent)

const NS = {
    XLINK: 'http://www.w3.org/1999/xlink',
    EPUB: 'http://www.idpf.org/2007/ops',
}

const MIME = {
    XML: 'application/xml',
    XHTML: 'application/xhtml+xml',
}

const STYLE = {
    'strong': ['strong', 'self'],
    'emphasis': ['em', 'self'],
    'style': ['span', 'self'],
    'a': 'anchor',
    'strikethrough': ['s', 'self'],
    'sub': ['sub', 'self'],
    'sup': ['sup', 'self'],
    'code': ['code', 'self'],
    'image': 'image',
}

const TABLE = {
    'tr': ['tr', {
        'th': ['th', STYLE, ['colspan', 'rowspan', 'align', 'valign']],
        'td': ['td', STYLE, ['colspan', 'rowspan', 'align', 'valign']],
    }, ['align']],
}

const POEM = {
    'epigraph': ['blockquote'],
    'subtitle': ['h2', STYLE],
    'text-author': ['p', STYLE],
    'date': ['p', STYLE],
    'stanza': 'stanza',
}

const SECTION = {
    'title': ['header', {
        'p': ['h1', STYLE],
        'empty-line': ['br'],
    }],
    'epigraph': ['blockquote', 'self'],
    'image': 'image',
    'annotation': ['aside'],
    'section': ['section', 'self'],
    'p': ['p', STYLE],
    'poem': ['blockquote', POEM],
    'subtitle': ['h2', STYLE],
    'cite': ['blockquote', 'self'],
    'empty-line': ['br'],
    'table': ['table', TABLE],
    'text-author': ['p', STYLE],
}
POEM['epigraph'].push(SECTION)

const BODY = {
    'image': 'image',
    'title': ['section', {
        'p': ['h1', STYLE],
        'empty-line': ['br'],
    }],
    'epigraph': ['section', SECTION],
    'section': ['section', SECTION],
}

class FB2Converter {
    constructor(fb2) {
        this.fb2 = fb2
        this.doc = document.implementation.createDocument(NS.XHTML, 'html')
        // use this instead of `getElementById` to allow images like
        // `<image l:href="#img1.jpg" id="img1.jpg" />`
        this.bins = new Map(Array.from(this.fb2.getElementsByTagName('binary'),
            el => [el.id, el]))
    }
    getImageSrc(el) {
        const href = el.getAttributeNS(NS.XLINK, 'href')
        if (!href) return 'data:,'
        const [, id] = href.split('#')
        if (!id) return href
        const bin = this.bins.get(id)
        return bin
            ? `data:${bin.getAttribute('content-type')};base64,${bin.textContent}`
            : href
    }
    image(node) {
        const el = this.doc.createElement('img')
        el.alt = node.getAttribute('alt')
        el.title = node.getAttribute('title')
        el.setAttribute('src', this.getImageSrc(node))
        return el
    }
    anchor(node) {
        const el = this.convert(node, { 'a': ['a', STYLE] })
        el.setAttribute('href', node.getAttributeNS(NS.XLINK, 'href'))
        if (node.getAttribute('type') === 'note')
            el.setAttributeNS(NS.EPUB, 'epub:type', 'noteref')
        return el
    }
    stanza(node) {
        const el = this.convert(node, {
            'stanza': ['p', {
                'title': ['header', {
                    'p': ['strong', STYLE],
                    'empty-line': ['br'],
                }],
                'subtitle': ['p', STYLE],
            }],
        })
        for (const child of node.children) if (child.nodeName === 'v') {
            el.append(this.doc.createTextNode(child.textContent))
            el.append(this.doc.createElement('br'))
        }
        return el
    }
    convert(node, def) {
        // not an element; return text content
        if (node.nodeType === 3) return this.doc.createTextNode(node.textContent)
        if (node.nodeType === 4) return this.doc.createCDATASection(node.textContent)
        if (node.nodeType === 8) return this.doc.createComment(node.textContent)

        const d = def?.[node.nodeName]
        if (!d) return null
        if (typeof d === 'string') return this[d](node)

        const [name, opts, attrs] = d
        const el = this.doc.createElement(name)

        // copy the ID, and set class name from original element name
        if (node.id) el.id = node.id
        el.classList.add(node.nodeName)

        // copy attributes
        if (Array.isArray(attrs)) for (const attr of attrs) {
            const value = node.getAttribute(attr)
            if (value) el.setAttribute(attr, value)
        }

        // process child elements recursively
        const childDef = opts === 'self' ? def : opts
        let child = node.firstChild
        while (child) {
            const childEl = this.convert(child, childDef)
            if (childEl) el.append(childEl)
            child = child.nextSibling
        }
        return el
    }
}

const parseXML = async blob => {
    const buffer = await blob.arrayBuffer()
    const str = new TextDecoder('utf-8').decode(buffer)
    const parser = new DOMParser()
    const doc = parser.parseFromString(str, MIME.XML)
    const encoding = doc.xmlEncoding
        // `Document.xmlEncoding` is deprecated, and already removed in Firefox
        // so parse the XML declaration manually
        || str.match(/^<\?xml\s+version\s*=\s*["']1.\d+"\s+encoding\s*=\s*["']([A-Za-z0-9._-]*)["']/)?.[1]
    if (encoding && encoding.toLowerCase() !== 'utf-8') {
        const str = new TextDecoder(encoding).decode(buffer)
        return parser.parseFromString(str, MIME.XML)
    }
    return doc
}

const style = URL.createObjectURL(new Blob([`
@namespace epub "http://www.idpf.org/2007/ops";
body > img, section > img {
    display: block;
    margin: auto;
}
.title h1 {
    text-align: center;
}
body > section > .title, body.notesBodyType > .title {
    margin: 3em 0;
}
body.notesBodyType > section .title h1 {
    text-align: start;
}
body.notesBodyType > section .title {
    margin: 1em 0;
}
p {
    text-indent: 1em;
    margin: 0;
}
:not(p) + p, p:first-child {
    text-indent: 0;
}
[data-foliate-continued] > p:first-child {
    text-indent: 1em;
}
.poem p {
    text-indent: 0;
    margin: 1em 0;
}
.text-author, .date {
    text-align: end;
}
.text-author:before {
    content: "—";
}
table {
    border-collapse: collapse;
}
td, th {
    padding: .25em;
}
a[epub|type~="noteref"] {
    font-size: .75em;
    vertical-align: super;
}
body:not(.notesBodyType) > .title, body:not(.notesBodyType) > .epigraph {
    margin: 3em 0;
}
`], { type: 'text/css' }))

const template = html => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
    <head><link href="${style}" rel="stylesheet" type="text/css"/></head>
    <body>${html}</body>
</html>`

// name of custom ID attribute for TOC items
const dataID = 'data-foliate-id'

// The paginator lays out a whole section in one frame, so a giant section
// (a book that is one long chapter) costs seconds on every open and resize.
// Sections longer than this many characters of text are cut into parts.
export const SECTION_LIMIT = 80_000
// An image counts as this much text when weighing a section.
const IMAGE_WEIGHT = 2_000
// marks the parts of a cut section after the first one
const continuedAttr = 'data-foliate-continued'
// Tags the spine step of every CFI in a book whose sections were cut, so that
// a CFI saved before they were (it has no tag) can be told apart and moved.
// The tag names the limit, as another limit would cut the book differently:
// a change of the limit can then tell which cut a tagged CFI was made in.
const partsTag = limit => `fb2-parts-${limit}`

/** How much a node weighs toward a section's limit: its text, and its images. */
const weigh = node => (node.textContent?.length ?? 0)
    + (node.nodeType === 1 ? (node.localName === 'img' ? 1
        : node.getElementsByTagName('img').length) * IMAGE_WEIGHT : 0)

/** The spine part of a tagged CFI that points at section `index`. */
const taggedSpine = (index, tag) => [{ index: 6 }, { index: (index + 1) * 2, id: tag }]

/**
 * Cuts a converted section into parts of at most `limit` (where blocks allow),
 * at the boundaries of its child nodes, descending into nested sections that
 * are too long themselves. Each part is a shallow copy of `el` holding a run
 * of the original children, so styles keyed on the nesting still apply; only
 * the first part keeps the section's id. Returns null when the section fits,
 * else `[parts, plan, weights]`: the parts, a note of which children each one
 * holds (no nodes, so it keeps no DOM alive), to move old CFIs onto them (see
 * moveSteps), and what each part weighs.
 */
const cutSection = (el, limit, weight = weigh(el)) => {
    if (weight <= limit) return null
    // a piece is a child: element number `n` (or `sub`, its part, when it is
    // a nested section that was cut too), or text after element number `after`
    const groups = [], weights = [], nested = new Map()
    let group = [], size = 0
    const add = (node, piece, weight) => {
        if (size && piece.n && size + weight > limit) {
            groups.push(group)
            weights.push(size)
            group = [], size = 0
        }
        group.push([node, piece])
        size += weight
    }
    let n = 0
    for (const child of Array.from(el.childNodes)) {
        const weight = weigh(child)
        if (child.nodeType !== 1) {
            add(child, { after: n }, weight)
            continue
        }
        n++
        // a nested section too long itself is cut first; its first part may
        // join the blocks before it, its last part the blocks after it
        const cut = weight > limit && child.localName === 'section'
            ? cutSection(child, limit, weight) : null
        if (!cut) {
            add(child, { n, sub: 0 }, weight)
            continue
        }
        const [parts, plan, partWeights] = cut
        nested.set(n, plan)
        parts.forEach((part, sub) => add(part, { n, sub }, partWeights[sub]))
    }
    groups.push(group)
    weights.push(size)
    const parts = groups.map((group, i) => {
        const part = el.cloneNode(false)
        if (i) {
            part.removeAttribute('id')
            part.setAttribute(continuedAttr, '')
        }
        part.append(...group.map(([node]) => node))
        return part
    })
    const plan = { nested, parts: groups.map(group => group.map(([, piece]) => piece)) }
    return [parts, plan, weights]
}

/**
 * Finds the first piece in a cut section's plan that `match` accepts: the
 * number of its part and how many elements come before it in that part, with
 * itself. Undefined if none does.
 */
const locate = (plan, match) => {
    for (const [i, pieces] of plan.parts.entries()) {
        let elements = 0
        for (const piece of pieces) {
            if (piece.n) elements++
            if (match(piece)) return [i, elements]
        }
    }
}

/**
 * Finds where CFI steps taken inside a section before it was cut by `plan`
 * (the steps below the section's element) point now: `[part, steps]`, the
 * number of the part and the steps inside it. Null if they fit no child.
 */
const moveSteps = (plan, steps) => {
    const [step, ...rest] = steps
    if (!step) return [0, []]
    // an even index is element number index / 2; an odd one is the text after
    // element number (index - 1) / 2 (0: before the first element)
    if (step.index % 2) {
        const after = (step.index - 1) / 2
        const found = locate(plan, piece => piece.after === after)
        if (found) return [found[0], [{ ...step, index: found[1] * 2 + 1 }]]
        // no text there (a CFI may name an empty gap): take the element
        return moveSteps(plan, [{ index: Math.max(after, 1) * 2 }])
    }
    const n = step.index / 2
    let sub = 0, inner = rest
    if (plan.nested.has(n)) {
        const moved = moveSteps(plan.nested.get(n), rest)
        if (!moved) return null
        ;[sub, inner] = moved
    }
    const found = locate(plan, piece => piece.n === n && piece.sub === sub)
    return found ? [found[0], [{ ...step, index: found[1] * 2 }, ...inner]] : null
}

/**
 * Moves a CFI saved before the book's sections were cut (it has no tag) onto
 * the part that now holds its place, collapsed to its start. `cuts` says,
 * for each section as it was, where its parts start and how it was cut. A CFI
 * that is tagged already, or that can't be read, is returned as it is.
 */
const upgradeCFI = (cuts, tag, cfi) => {
    let parsed
    try {
        parsed = CFI.parse(CFI.collapse(cfi))
    } catch {
        return cfi
    }
    const [spine, steps = []] = parsed
    if (!spine?.length || spine.at(-1).id?.startsWith(partsTag(''))) return cfi
    const cut = cuts[CFI.fake.toIndex(spine)]
    if (!cut) return cfi
    let part = 0, moved = steps
    // the steps run from <html> to <body> (4) to the section (2), then inside
    if (cut.plan && steps[0]?.index === 4 && steps[1]?.index === 2) {
        const found = moveSteps(cut.plan, steps.slice(2))
        if (found) [part, moved] = [found[0], [...steps.slice(0, 2), ...found[1]]]
        else moved = steps.slice(0, 2)
    }
    const newSpine = taggedSpine(cut.first + part, tag)
    return CFI.toString(moved.length ? [newSpine, moved] : [newSpine])
}

// `sectionLimit` overrides SECTION_LIMIT for tests (Infinity keeps every
// section whole, as before sections were cut)
export const makeFB2 = async (blob, { sectionLimit = SECTION_LIMIT } = {}) => {
    const book = {}
    const doc = await parseXML(blob)
    const converter = new FB2Converter(doc)

    const $ = x => doc.querySelector(x)
    const $$ = x => [...doc.querySelectorAll(x)]
    const getPerson = el => {
        const nick = getElementText(el.querySelector('nickname'))
        if (nick) return nick
        const first = getElementText(el.querySelector('first-name'))
        const middle = getElementText(el.querySelector('middle-name'))
        const last = getElementText(el.querySelector('last-name'))
        const name = [first, middle, last].filter(x => x).join(' ')
        const sortAs = last
            ? [last, [first, middle].filter(x => x).join(' ')].join(', ')
            : null
        return { name, sortAs }
    }
    const getDate = el => el?.getAttribute('value') ?? getElementText(el)
    const annotation = $('title-info annotation')
    book.metadata = {
        title: getElementText($('title-info book-title')),
        identifier: getElementText($('document-info id')),
        language: getElementText($('title-info lang')),
        author: $$('title-info author').map(getPerson),
        translator: $$('title-info translator').map(getPerson),
        contributor: $$('document-info author').map(getPerson)
            // techincially the program probably shouldn't get the `bkp` role
            // but it has been so used by calibre, so ¯\_(ツ)_/¯
            .concat($$('document-info program-used').map(getElementText))
            .map(x => Object.assign(typeof x === 'string' ? { name: x } : x,
                { role: 'bkp' })),
        publisher: getElementText($('publish-info publisher')),
        published: getDate($('title-info date')),
        modified: getDate($('document-info date')),
        description: annotation ? converter.convert(annotation,
            { annotation: ['div', SECTION] }).innerHTML : null,
        subject: $$('title-info genre').map(getElementText),
    }
    if ($('coverpage image')) {
        const src = converter.getImageSrc($('coverpage image'))
        book.getCover = () => fetch(src).then(res => res.blob())
    } else book.getCover = () => null

    // get convert each body
    const bodyData = Array.from(doc.querySelectorAll('body'), body => {
        const converted = converter.convert(body, { body: ['body', BODY] })
        return [Array.from(converted.children), converted]
    })

    const urls = []
    /** Makes a section of the book from a converted element. */
    const makeSection = (el, linear) => {
        const str = template(el.outerHTML)
        const blob = new Blob([str], { type: MIME.XHTML })
        const url = URL.createObjectURL(blob)
        urls.push(url)
        return {
            ids: [el, ...el.querySelectorAll('[id]')].map(el => el.id),
            load: () => url,
            createDocument: () => new DOMParser().parseFromString(str, MIME.XHTML),
            // doo't count image data as it'd skew the size too much
            size: blob.size - Array.from(el.querySelectorAll('[src]'),
                el => el.getAttribute('src')?.length ?? 0)
                .reduce((a, b) => a + b, 0),
            linear,
        }
    }

    // a section for each section in the first body, and one for each
    // additional body; a long one is cut into parts (see cutSection), so
    // `cuts` says where each one's parts start and how it was cut
    const sectionData = [], cuts = [], toc = []
    const items = bodyData[0][0].map(el => ({ el }))
        .concat(bodyData.slice(1).map(([, body]) => {
            body.classList.add('notesBodyType')
            return { el: body, linear: 'no' }
        }))
    for (const { el, linear } of items) {
        const label = normalizeWhitespace(
            el.querySelector('.title, .subtitle, p')?.textContent
            ?? (el.classList.contains('title') ? el.textContent : ''))
        // set up titles for TOC
        const titles = linear ? [] : Array.from(
            el.querySelectorAll(':scope > section > .title'),
            (el, index) => {
                el.setAttribute(dataID, index)
                return { el, title: getElementText(el), index }
            })
        const first = sectionData.length
        const [parts, plan] = cutSection(el, sectionLimit) ?? [[el], null]
        cuts.push({ first, plan })
        for (const part of parts) sectionData.push(makeSection(part, linear))
        const partOf = new Map(parts.map((part, i) => [part, first + i]))
        const sectionOf = el => {
            while (!partOf.has(el)) el = el.parentNode
            return partOf.get(el)
        }
        toc.push({
            label,
            href: first.toString(),
            // each title points at the part that holds it
            subitems: titles.length ? titles.map(({ el, title, index }) => ({
                label: title,
                href: `${sectionOf(el)}#${index}`,
            })) : null,
        })
    }

    // once a section is cut, every section's CFI carries the tag, and an old
    // CFI (from before the cut, or another reader) is moved when resolved
    const tag = cuts.some(cut => cut.plan) ? partsTag(sectionLimit) : null
    const idMap = new Map()
    book.sections = sectionData.map((section, index) => {
        const { ids, load, createDocument, size, linear } = section
        for (const id of ids) if (id) idMap.set(id, index)
        const cfi = tag ? CFI.toString([taggedSpine(index, tag)]) : undefined
        return { id: index, load, createDocument, size, linear, cfi }
    })

    book.toc = toc

    if (tag) {
        book.upgradeCFI = cfi => upgradeCFI(cuts, tag, cfi)
        book.resolveCFI = cfi => {
            const parts = CFI.parse(book.upgradeCFI(cfi))
            const index = CFI.fake.toIndex((parts.parent ?? parts).shift())
            return { index, anchor: doc => CFI.toRange(doc, parts) }
        }
    } else book.upgradeCFI = cfi => cfi

    book.resolveHref = href => {
        const [a, b] = href.split('#')
        return a
            // the link is from the TOC
            ? { index: Number(a), anchor: doc => doc.querySelector(`[${dataID}="${b}"]`) }
            // link from within the page
            : { index: idMap.get(b), anchor: doc => doc.getElementById(b) }
    }
    book.splitTOCHref = href => href?.split('#')?.map(x => Number(x)) ?? []
    book.getTOCFragment = (doc, id) => doc.querySelector(`[${dataID}="${id}"]`)
    book.isExternal = uri => /^\w+:/i.test(uri)

    book.destroy = () => {
        for (const url of urls) URL.revokeObjectURL(url)
    }
    return book
}
