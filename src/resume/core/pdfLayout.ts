import { normalize, uid, type Data, type Obj } from './data'

// "Exact look" import: every line of text becomes a free text object at its original position (edit it in Design mode),
// and everything that is not text (rules, bullets, boxes, photos) becomes one locked background image under the text.

const PXW = (210 * 96) / 25.4, PXH = (297 * 96) / 25.4 // the editor's page, in CSS px (A4)
const SCALE = 2 // background resolution: canvas px per page px

export async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  return pdfjs
}

// The app ships these families; a PDF font that matches one of them gets the app's own stack, anything else keeps its name plus a generic fallback.
const STACKS: [RegExp, string][] = [
  [/eb[ -]?garamond/i, "'EB Garamond',Garamond,Georgia,serif"],
  [/garamond/i, "Garamond,'Palatino Linotype',Georgia,serif"],
  [/arial|helvetica|liberation[ -]?sans|nimbus[ -]?sans/i, 'Arial,Helvetica,sans-serif'],
  [/times|liberation[ -]?serif|nimbus[ -]?rom/i, "'Times New Roman',Times,serif"],
  [/georgia/i, "Georgia,'Times New Roman',serif"],
  [/calibri|carlito/i, "Calibri,'Segoe UI',Arial,sans-serif"],
  [/roboto/i, "Roboto,'Microsoft YaHei','PingFang SC',sans-serif"],
  [/open[ -]?sans/i, "'Open Sans','Microsoft YaHei','PingFang SC',sans-serif"],
  [/lato/i, "Lato,'Microsoft YaHei','PingFang SC',sans-serif"],
  [/montserrat/i, "Montserrat,'Microsoft YaHei','PingFang SC',sans-serif"],
  [/source[ -]?sans/i, "'Source Sans 3','Microsoft YaHei','PingFang SC',sans-serif"],
  [/(^|[^a-z])inter([^a-z]|$)/i, "Inter,'Microsoft YaHei','PingFang SC',sans-serif"],
  [/poppins/i, "Poppins,'Microsoft YaHei','PingFang SC',sans-serif"],
  [/merriweather/i, 'Merriweather,Georgia,serif'],
  [/playfair/i, "'Playfair Display',Georgia,serif"],
  [/lora/i, 'Lora,Georgia,serif'],
  [/courier|mono/i, "'Courier New',monospace"],
]
export function fontInfo(raw: string, generic: string, flags?: { bold?: boolean; italic?: boolean }) {
  const name = raw.replace(/^[A-Z]{6}\+/, '')
  const hit = STACKS.find(([re]) => re.test(name))
  const fam = name.split(/[-,]/)[0].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/MT$|PS$/, '').trim()
  const gen = /mono/i.test(generic) ? 'monospace' : /serif/i.test(generic) && !/sans/i.test(generic) ? 'serif' : 'sans-serif'
  const css = hit ? hit[1] : fam ? `'${fam.replace(/'/g, '')}',${gen}` : gen
  return {
    css,
    // only fonts the OS ships can be measured reliably before the app's own web fonts have loaded
    safe: /^(Arial|'Times New Roman'|Georgia|Calibri|'Courier New')/.test(css),
    bold: !!flags?.bold || /bold|black|heavy|semi ?bold|demi/i.test(name),
    italic: !!flags?.italic || /italic|oblique/i.test(name),
  }
}

type Run = { s: string; x: number; y: number; w: number; size: number; css: string; safe: boolean; bold: boolean; italic: boolean; color: string }

// text is rendered through the editor's mini markdown (**bold**, [text](url)): neutralise sequences that would be taken as markup
const esc = (t: string) => t.replace(/\*\*/g, '*\u200b*').replace(/\]\(/g, ']\u200b(')

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/** Most solid colour among the pixels that the text added (full render vs. render without text). */
export function sampleColor(full: ImageData, bare: ImageData, fallback = '#111827') {
  let best = -1, c = fallback
  const f = full.data, b = bare.data
  for (let i = 0; i < f.length; i += 4) {
    const d = Math.abs(f[i] - b[i]) + Math.abs(f[i + 1] - b[i + 1]) + Math.abs(f[i + 2] - b[i + 2])
    if (d > best) { best = d; c = hex(f[i], f[i + 1], f[i + 2]) }
  }
  return best < 40 ? fallback : c
}

let probe: HTMLElement | null = null
/** Natural width of a text in the chosen font, in px, measured the way the DOM lays it out (canvas and DOM can round glyph advances differently). */
function measure(text: string, css: string, size: number, bold: boolean, italic: boolean) {
  if (!probe) {
    probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre'
    document.body.appendChild(probe)
  }
  probe.style.font = `${italic ? 'italic ' : ''}${bold ? 700 : 400} ${size}px ${css}`
  probe.textContent = text
  return probe.getBoundingClientRect().width
}
const baseCache = new Map<string, number>()
/** Distance from the top of a text box to its baseline, measured with a hidden probe so it is exactly what this browser lays out. */
function baselineOffset(css: string, size: number, bold: boolean, italic: boolean, lh: number) {
  const key = [css, size, bold, italic, lh].join('|')
  let v = baseCache.get(key)
  if (v === undefined) {
    const el = document.createElement('div')
    el.style.cssText = `position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;font:${italic ? 'italic ' : ''}${bold ? 700 : 400} ${size}px ${css};line-height:${lh}`
    el.innerHTML = 'Hxg<span style="display:inline-block;width:0;height:0"></span>'
    document.body.appendChild(el)
    v = el.querySelector('span')!.getBoundingClientRect().bottom - el.getBoundingClientRect().top
    el.remove()
    if (!(v > 0)) v = size * (lh / 2 + 0.35)
    baseCache.set(key, v)
  }
  return v
}
// pdf.js writes letter-spaced words as "E X P E R I E N C E": join them again (a double space stays a word break)
const unspace = (t: string) => (/^(?:\S{1,2} ){3,}\S{1,2}$/.test(t.trim()) || /^(?:\S{1,2}(?: {1,2}|$)){4,}$/.test(t.trim()) ? t.trim().replace(/ {2,}/g, '\u0001').replace(/ /g, '').replace(/\u0001/g, ' ') : t)

type Ink = { c: string; v: number[]; m: number }
const cos = (a: number[], b: number[]) => (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]) || 1)

/** The ink of every pixel column of a text box: its strongest pixel and what it added over the background (null where the text added nothing).
 *  Anti-aliasing only scales that difference, so its direction identifies the colour class (grey vs blue ...), also for light text on dark. */
function columnInk(full: ImageData, bare: ImageData): (Ink | null)[] {
  const out: (Ink | null)[] = []
  for (let x = 0; x < full.width; x++) {
    let best: Ink | null = null
    for (let y = 0; y < full.height; y++) {
      const i = (y * full.width + x) * 4, v = [full.data[i] - bare.data[i], full.data[i + 1] - bare.data[i + 1], full.data[i + 2] - bare.data[i + 2]], m = Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2])
      if (m >= 120 && (!best || m > best.m)) best = { c: hex(full.data[i], full.data[i + 1], full.data[i + 2]), v, m }
    }
    out.push(best)
  }
  return out
}

/** Splits one run (sizes and x/w in PDF points) where its colour changes, e.g. a blue link inside a grey line, but only at a space so words are never cut. */
function splitByColor(r: Run, cols: (Ink | null)[], devPerPt: number, x0dev: number): Run[] {
  const px = (r.size * devPerPt) / SCALE, tol = r.size * devPerPt * 0.8, segs: { a: number; b: number; c: string; v: number[]; m: number }[] = []
  cols.forEach((k, i) => {
    if (!k) return
    const last = segs[segs.length - 1]
    if (last && i - last.b <= tol && cos(last.v, k.v) > 0.96) { last.b = i; if (k.m > last.m) { last.c = k.c; last.v = k.v; last.m = k.m } } else segs.push({ a: i, b: i, ...k })
  })
  const real = segs.filter((sg) => sg.b - sg.a >= r.size * devPerPt * 0.4)
  if (real.length < 2 || !/\s/.test(r.s)) return [r]
  const pre = (n: number) => measure(r.s.slice(0, n), r.css, px, r.bold, r.italic), total = pre(r.s.length) || 1, cuts: number[] = []
  for (let i = 1; i < real.length; i++) {
    if (cos(real[i - 1].v, real[i].v) > 0.96) continue
    const at = (col: number) => (x0dev + col) / devPerPt - r.x, fE = at(real[i - 1].b) / r.w, fS = at(real[i].a) / r.w
    let best = -1, bd = Infinity
    // a space between the end of the previous colour and the start of the next one; the one closest to the new colour wins (so a lone "·" separator stays with the old colour)
    for (let j = 1; j < r.s.length - 1; j++) if (r.s[j] === ' ') { const f = pre(j) / total; if (f >= fE - 0.02 && f <= fS + 0.02) { const d = Math.abs(f - fS); if (d < bd) { bd = d; best = j } } }
    if (best > 0 && bd < 0.08 && !cuts.includes(best)) cuts.push(best)
  }
  if (!cuts.length) return [r]
  cuts.sort((p, q) => p - q)
  const bounds = [0, ...cuts, r.s.length], out: Run[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const raw = r.s.slice(bounds[i], bounds[i + 1]), txt = raw.trim()
    if (!txt) continue
    const a = bounds[i] + (raw.length - raw.trimStart().length), b = bounds[i + 1] - (raw.length - raw.trimEnd().length)
    const xa = r.x + (r.w * pre(a)) / total, xb = r.x + (r.w * pre(b)) / total
    const lo = xa * devPerPt - x0dev, hi = xb * devPerPt - x0dev
    const inside = real.filter((sg) => sg.b >= lo && sg.a <= hi).sort((p, q) => q.b - q.a - (p.b - p.a))
    out.push({ ...r, s: txt, x: xa, w: Math.max(0.1, xb - xa), color: inside[0]?.c ?? r.color })
  }
  return out.length ? out : [r]
}

export async function layoutFromPdf(bytes: Uint8Array): Promise<Data> {
  const pdfjs = await loadPdfjs()
  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  const pages: { bg?: string; objects: Obj[] }[] = []
  let chars = 0

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const v1 = page.getViewport({ scale: 1 }), k = Math.min(PXW / v1.width, PXH / v1.height)
    const ol = await page.getOperatorList({ annotationMode: 0 }) // also loads the fonts
    const showOps = new Set<number>()
    ol.fnArray.forEach((fn: number, i: number) => { if (fn >= pdfjs.OPS.showText && fn <= pdfjs.OPS.nextLineSetSpacingShowText) showOps.add(i) })
    const tc = await page.getTextContent()

    // two renders of the page: with text, and without it (the background)
    const vp = page.getViewport({ scale: k * SCALE })
    const mk = () => { const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); return c }
    const full = mk(), bare = mk()
    await page.render({ canvas: full, canvasContext: full.getContext('2d')!, viewport: vp, annotationMode: 0, background: '#ffffff' } as any).promise
    await page.render({ canvas: bare, canvasContext: bare.getContext('2d')!, viewport: vp, annotationMode: 0, background: '#ffffff', operationsFilter: (i: number) => !showOps.has(i) } as any).promise
    const fctx = full.getContext('2d')!, bctx = bare.getContext('2d')!

    const fonts = new Map<string, ReturnType<typeof fontInfo>>()
    const fontOf = (name: string) => {
      let f = fonts.get(name)
      if (!f) {
        let o: any = null
        try { o = page.commonObjs.has(name) ? page.commonObjs.get(name) : null } catch { /* font not resolved */ }
        f = fontInfo(String(o?.name || o?.fallbackName || ''), String(tc.styles?.[name]?.fontFamily || o?.fallbackName || ''), { bold: o?.bold || o?.black, italic: o?.italic })
        fonts.set(name, f)
      }
      return f
    }

    const runs: Run[] = []
    for (const it of tc.items as any[]) {
      if (typeof it.str !== 'string' || !it.str.trim()) continue
      const t = it.transform as number[], size = Math.hypot(t[2], t[3]), f = fontOf(it.fontName)
      const x = t[4], y = t[5], w = it.width as number
      // colour: look at what the text added to the page inside its box
      const cx = Math.max(0, Math.floor(x * k * SCALE) - 1), cw = Math.max(1, Math.min(full.width - cx, Math.ceil(w * k * SCALE) + 2))
      const top = Math.max(0, Math.floor((v1.height - y - size * 0.85) * k * SCALE)), ch = Math.max(1, Math.min(full.height - top, Math.ceil(size * 1.15 * k * SCALE)))
      const fi = fctx.getImageData(cx, top, cw, ch), bi = bctx.getImageData(cx, top, cw, ch), color = sampleColor(fi, bi)
      const run: Run = { s: unspace(it.str), x, y, w, size, css: f.css, safe: f.safe, bold: f.bold, italic: f.italic, color }
      runs.push(...(/\s/.test(run.s) ? splitByColor(run, columnInk(fi, bi), k * SCALE, cx) : [run]))
    }

    // rows: runs on the same baseline
    runs.sort((a, b) => b.y - a.y || a.x - b.x)
    const rows: Run[][] = []
    for (const r of runs) {
      const row = rows[rows.length - 1]
      if (row && Math.abs(row[0].y - r.y) < Math.max(1.5, r.size * 0.3)) row.push(r); else rows.push([r])
    }

    const objs: Obj[] = []
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x)
      // a row becomes one object per visually separate piece (e.g. a title on the left and its dates on the right)
      const groups: Run[][] = []
      for (const r of row) {
        const g = groups[groups.length - 1], prev = g?.[g.length - 1]
        const same = prev && r.x - (prev.x + prev.w) <= r.size * 1.2 && Math.abs(prev.size - r.size) < 0.6 && prev.css === r.css && prev.italic === r.italic && prev.color === r.color
        if (same) g.push(r); else groups.push([r])
      }
      groups.forEach((g) => {
        // letter-spaced headings arrive as one run per glyph: keep the spacing as letter-spacing and only treat clearly wider gaps as spaces
        const gaps = g.slice(1).map((r, i) => r.x - (g[i].x + g[i].w))
        const spaced = g.length >= 4 && g.filter((r) => r.s.trim().length <= 1).length >= g.length * 0.7
        const med = spaced ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0
        const wordGap = (size: number) => (spaced ? med * 2 + size * 0.1 : size * 0.2)
        const allBold = g.every((r) => r.bold)
        let text = ''
        g.forEach((r, i) => {
          if (i && gaps[i - 1] > wordGap(r.size) && !/\s$/.test(text) && !/^\s/.test(r.s)) text += ' '
          text += !allBold && r.bold ? `**${esc(r.s.trim())}**${/\s$/.test(r.s) ? ' ' : ''}` : esc(r.s)
        })
        text = text.replace(/\*\*\s*\*\*/g, ' ').replace(/ +/g, ' ').trim()
        if (!text) return
        chars += text.length
        const f = g[0], left = g[0].x, right = g[g.length - 1].x + g[g.length - 1].w
        const sizePx = Math.round(f.size * k * 100) / 100, wPx = Math.ceil((right - left) * k * 1.12 + 8)
        // letter-spacing: one run per glyph -> the gap between glyphs; otherwise what the real width has over the natural width (system fonts only)
        let ls: number | undefined
        if (spaced && med * k > 0.3) ls = med * k
        else if (g.every((r) => r.safe)) {
          const diffs = g.map((r) => { const txt = r.s.trim(); return txt ? { d: r.w * k - measure(txt, r.css, r.size * k, r.bold, r.italic), n: txt.length } : { d: 0, n: 1 } })
          const per = diffs.map((x) => x.d / x.n).sort((a, b) => a - b)[Math.floor(diffs.length / 2)], total = diffs.reduce((acc, x) => acc + Math.abs(x.d), 0)
          if (total > 0.6 && Math.abs(per) > 0.004) ls = Math.max(-0.05 * sizePx, Math.min(0.6 * sizePx, per))
        }
        const LH = 1.2, baseline = (v1.height - f.y) * k, off = baselineOffset(f.css, sizePx, allBold, f.italic, LH)
        objs.push({
          id: uid(), type: 'text', text, size: sizePx, color: f.color, font: f.css, bold: allBold || undefined, italic: f.italic || undefined, lh: LH,
          ls: ls === undefined ? undefined : Math.round(ls * 100) / 100,
          x: Math.round(left * k * 10) / 10, y: Math.round((baseline - off) * 100) / 100, w: wPx,
        })
      })
    }

    // background: PNG when it is small (flat colours), JPEG when it holds a photo
    let bg: string | undefined
    const px = bctx.getImageData(0, 0, bare.width, bare.height).data
    let ink = 0
    for (let i = 0; i < px.length; i += 32) if (px[i] < 250 || px[i + 1] < 250 || px[i + 2] < 250) ink++
    if (ink > 3) {
      bg = bare.toDataURL('image/png')
      if (bg.length > 700_000) bg = bare.toDataURL('image/jpeg', 0.88)
    }
    const bgObj: Obj[] = bg ? [{ id: uid(), type: 'image', src: bg, x: 0, y: 0, w: Math.round(v1.width * k * 10) / 10, h: Math.round(v1.height * k * 10) / 10, fit: 'cover', locked: true }] : []
    pages.push({ objects: [...bgObj, ...objs] })
  }

  if (chars < 20) throw new Error('This PDF has no selectable text (it is probably made of page images), so nothing can be extracted.')
  return normalize({
    template: 'classic',
    // the template header is hidden: everything on the page comes from the objects
    basics: { name: '', headline: '', links: [] },
    fmt: { 'basics.name': { hidden: true }, 'basics.headline': { hidden: true }, 'basics.rule': { hidden: true } },
    sections: [], layout: { pages },
  })
}
