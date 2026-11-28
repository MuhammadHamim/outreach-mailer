import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, PDFString, PDFHexString, decodePDFRawStream } from 'pdf-lib'
import { normalize, type Data } from './data'

// The resume JSON travels inside the PDF as an embedded file. It is invisible to ATS parsers
// (the page text is untouched) but lets this app restore the exact design when the PDF is uploaded again.
const ATTACH = 'resume.json'

export async function embedData(pdf: Uint8Array, data: unknown, title?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false })
  if (title) doc.setTitle(title)
  await doc.attach(new TextEncoder().encode(JSON.stringify(data)), ATTACH, {
    mimeType: 'application/json', description: 'Outreach Mailer resume data', creationDate: new Date(), modificationDate: new Date(),
  })
  return doc.save()
}

export async function savePdfWithData(bytes: Uint8Array, name: string, data: unknown) {
  const out = await embedData(bytes, data, name)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([out as BlobPart], { type: 'application/pdf' }))
  a.download = (name || 'resume').replace(/[^\w\- ]+/g, '') + '.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

// Reads the embedded file with pdf-lib only: pdf.js changed its attachment API between versions, pdf-lib's object model is stable.
function walk(node: PDFDict, out: { name: string; bytes: Uint8Array }[]) {
  const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
  if (kids) for (let i = 0; i < kids.size(); i++) { const k = kids.lookupMaybe(i, PDFDict); if (k) walk(k, out) }
  const names = node.lookupMaybe(PDFName.of('Names'), PDFArray)
  if (!names) return
  for (let i = 0; i + 1 < names.size(); i += 2) {
    const key = names.lookup(i), spec = names.lookupMaybe(i + 1, PDFDict)
    const st = spec?.lookupMaybe(PDFName.of('EF'), PDFDict)?.lookup(PDFName.of('F'))
    if (st instanceof PDFRawStream) out.push({ name: key instanceof PDFString || key instanceof PDFHexString ? key.decodeText() : '', bytes: decodePDFRawStream(st).decode() })
  }
}
async function readEmbedded(bytes: Uint8Array): Promise<Uint8Array | null> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const root = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  const out: { name: string; bytes: Uint8Array }[] = []
  if (root) walk(root, out)
  return out.find((f) => f.name === ATTACH)?.bytes ?? null
}

/** exact = the PDF was made by this app (its design is restored from the embedded data).
 *  Otherwise mode 'look' rebuilds the page as free text objects at their exact positions (edit them in Design mode),
 *  and mode 'text' extracts the text into the sections of a template. */
export async function readResumePdf(file: File, mode: 'look' | 'text' = 'look'): Promise<{ data: Data; exact: boolean; mode: 'exact' | 'look' | 'text' }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let emb: Uint8Array | null = null
  try { emb = await readEmbedded(bytes) } catch { /* unreadable for pdf-lib: fall through to text extraction */ }
  if (emb) {
    try { return { data: normalize(JSON.parse(new TextDecoder().decode(emb))), exact: true, mode: 'exact' } } catch { /* damaged attachment: fall through */ }
  }
  if (mode === 'text') return { data: parseLines(await extractLines(bytes.slice())), exact: false, mode }
  const { layoutFromPdf } = await import('./pdfLayout')
  return { data: await layoutFromPdf(bytes.slice()), exact: false, mode }
}

export type Line = { text: string; x: number }

async function extractLines(bytes: Uint8Array): Promise<Line[]> {
  const pdfjs = await (await import('./pdfLayout')).loadPdfjs()
  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  const lines: Line[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent()
    const items = (tc.items as any[]).filter((i) => typeof i.str === 'string' && i.str.trim()).map((i) => ({ s: i.str as string, x: i.transform[4] as number, y: i.transform[5] as number, w: (i.width as number) || 0, h: (i.height as number) || 10 }))
    items.sort((a, b) => b.y - a.y || a.x - b.x)
    let row: typeof items = []
    const flush = () => {
      if (!row.length) return
      row.sort((a, b) => a.x - b.x)
      let t = row[0].s
      for (let k = 1; k < row.length; k++) {
        const gap = row[k].x - (row[k - 1].x + row[k - 1].w)
        t += (gap > row[k].h * 0.15 || /\s$/.test(t) || /^\s/.test(row[k].s) ? ' ' : '') + row[k].s
      }
      lines.push({ text: t.replace(/\s+/g, ' ').trim(), x: row[0].x }); row = []
    }
    for (const it of items) { if (row.length && Math.abs(row[0].y - it.y) > Math.max(2, it.h * 0.4)) flush(); row.push(it) }
    flush()
  }
  return lines
}

const HEAD = /^(summary|profile|professional summary|career summary|summary of qualifications|objective|career objective|about( me)?|experience|work experience|professional experience|work history|employment( history)?|education|education and training|academic background|skills|technical skills|key skills|core (skills|competencies)|projects|personal projects|certifications?|licenses?( and certifications?)?|awards|honou?rs( and awards)?|achievements|languages|interests|hobbies|publications|volunteer\w*( experience)?|references|courses|training)$/i
const BUL = /^[•·▪●◦○■□▫‣⁃\-–—*]\s+/
const clean = (s: string) => s.replace(/[:\s]+$/, '')

/** Turns extracted text lines into resume data. Pure function: no PDF access, so it can be tested on its own. */
export function parseLines(lines: Line[]): Data {
  if (lines.map((l) => l.text).join('').length < 40) throw new Error('This PDF has no selectable text (it is probably made of page images), so nothing can be extracted.')
  const isHead = (l: string, i: number) => {
    const t = clean(l)
    return t.length > 1 && t.length < 40 && (HEAD.test(t) || (i >= 2 && t === t.toUpperCase() && /[A-Z]{3}/.test(t) && t.split(/\s+/).length <= 4 && !/[@\d]/.test(t)))
  }
  const first = lines.findIndex((l, i) => i > 0 && isHead(l.text, i))
  const top = lines.slice(0, first < 0 ? Math.min(5, lines.length) : first).map((l) => l.text), topText = top.join(' ')
  const email = topText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || ''
  const phone = topText.match(/\+?\d[\d\s().-]{7,}\d/)?.[0]?.trim() || ''
  const urls = topText.match(/(?:https?:\/\/|www\.|linkedin\.com|github\.com)[^\s|·,]+/gi) || []
  const plain = top.filter((l) => !l.includes('@') && !urls.some((u) => l.includes(u)) && l.replace(/\D/g, '').length < 7)

  const sections: any[] = []
  if (first < 0) sections.push({ title: 'Content', blocks: [{ type: 'text', text: lines.slice(top.length).map((l) => l.text).join('\n') || lines.map((l) => l.text).join('\n') }] })
  else {
    let i = first
    while (i < lines.length) {
      const title = clean(lines[i].text); let j = i + 1
      while (j < lines.length && !isHead(lines[j].text, j)) j++
      const body = lines.slice(i + 1, j).map((l) => l.text)
      if (/summary|profile|objective|about/i.test(title)) sections.push({ title, blocks: [{ type: 'text', text: body.join(' ') }] })
      else if (body.length && body.every((l) => /^[^:]{2,32}:\s*\S/.test(l)))
        sections.push({ title, blocks: [{ type: 'skills', skills: body.map((l) => ({ label: l.slice(0, l.indexOf(':')).trim(), items: l.slice(l.indexOf(':') + 1).trim() })) }] })
      else {
        // Chromium prints list bullets as graphics, not text, so there may be no marker: without markers every line is one item,
        // except a line that clearly continues the previous one (previous has no end punctuation, this one starts lowercase).
        const marked = body.some((l) => BUL.test(l)), bullets: string[] = []
        for (const l of body) {
          const txt = l.replace(BUL, '')
          const cont = bullets.length && (marked ? !BUL.test(l) : !/[.!?;:)]$/.test(bullets[bullets.length - 1]) && /^[a-z]/.test(txt))
          if (cont) bullets[bullets.length - 1] += ' ' + txt; else bullets.push(txt)
        }
        sections.push({ title, blocks: [{ type: 'bullets', bullets }] })
      }
      i = j
    }
  }
  return normalize({
    basics: { name: plain[0] || 'Your Name', headline: plain[1] || '', email, phone, links: urls.map((u) => ({ label: u.replace(/^https?:\/\//, ''), url: /^https?:/i.test(u) ? u : 'https://' + u })) },
    sections,
  })
}
