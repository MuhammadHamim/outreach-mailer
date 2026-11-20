export type Entry = { title: string; right?: string; sub?: string; subRight?: string; bullets?: string[] }
export type Skill = { label: string; items: string }
export type Style = { size?: number; font?: string; accent?: string; lineHeight?: number; margin?: number; gap?: number; align?: 'left' | 'center'; headerGap?: number; icons?: boolean; photoShape?: 'circle' | 'rounded' | 'square'; photoSize?: number }
export type Fmt = { ax?: number; ay?: number; grp?: string; locked?: boolean; hidden?: boolean; w?: number; th?: number; opacity?: number; color?: string; size?: number; bold?: boolean; italic?: boolean; underline?: boolean; align?: 'left' | 'center' | 'right'; font?: string; dx?: number; dy?: number }
export type Obj = {
  id: string; type: 'text' | 'line' | 'rect' | 'image' | 'icon'; grp?: string; locked?: boolean; hidden?: boolean; path?: string; x: number; y: number; w: number; h?: number; rot?: number; opacity?: number
  text?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; align?: 'left' | 'center' | 'right'; font?: string; lh?: number; ls?: number; caps?: 'upper' | 'small'
  eid?: string; from?: string; thickness?: number; dash?: boolean; fill?: string; stroke?: string; sw?: number; radius?: number; src?: string; fit?: 'cover' | 'contain'
}
export type Layout = { pages: { bg?: string; objects: Obj[] }[] }
export type BlockType = 'text' | 'entries' | 'skills' | 'bullets' | 'tags'
export type Block = { type: BlockType; text?: string; entries?: Entry[]; skills?: Skill[]; bullets?: string[]; tags?: string }
// A section has a title and any number of blocks, each with its own layout.
export type Section = { title: string; hideTitle?: boolean; pageBreak?: boolean; flow?: 'keep' | 'split'; gapTop?: number; blocks: Block[] }
export type Data = { basics: { name: string; headline?: string; location?: string; email?: string; phone?: string; links?: { label: string; url?: string }[]; photo?: string; personal?: { label: string; value: string }[]; icons?: Record<string, string> }; sections: Section[]; style?: Style; fmt?: Record<string, Fmt>; template?: string; layout?: Layout }
export type Rec = { id: string; name: string; template: string; data: Data; updated: number }
export const uid = () => Math.random().toString(36).slice(2, 10)
export const BLOCK_LABELS: Record<BlockType, string> = { entries: 'Entries (title, dates, bullets)', bullets: 'Bullet list', text: 'Paragraph', skills: 'Label: items rows', tags: 'Tags / chips' }
export const newBlock = (type: BlockType): Block => ({ type, ...(type === 'entries' ? { entries: [{ title: '', right: '', sub: '', subRight: '', bullets: [] }] } : type === 'skills' ? { skills: [{ label: '', items: '' }] } : type === 'bullets' ? { bullets: [''] } : type === 'tags' ? { tags: '' } : { text: '' }) })

const B0 = { name: 'Your Name', headline: 'Your headline', location: '', email: '', phone: '', links: [] }

const AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 150'><rect width='120' height='150' fill='%23d6dde8'/><circle cx='60' cy='56' r='26' fill='%2394a3b8'/><path d='M12 150c4-34 24-52 48-52s44 18 48 52z' fill='%2394a3b8'/></svg>"
const RAW: any = {
  basics: {
    name: 'Alex Morgan', headline: 'Software Engineer', location: 'Austin, TX', email: 'alex@example.com', phone: '+1 555 123 4567',
    personal: [{ label: 'Gender', value: 'Male' }, { label: 'Age', value: '29' }, { label: 'Nationality', value: 'American' }, { label: 'Marital status', value: 'Single' }],
    photo: AVATAR,
    links: [{ label: 'linkedin.com/in/alexmorgan', url: 'https://linkedin.com/in/alexmorgan' }, { label: 'github.com/alexmorgan', url: 'https://github.com/alexmorgan' }],
  },
  sections: [
    { title: 'Summary', kind: 'text', text: 'Full-stack engineer with 5+ years building web products. **Led a team of 4** to ship a payments platform used by 200k users.' },
    { title: 'Professional Experience', kind: 'entries', entries: [{ title: 'Senior Software Engineer', right: 'Jan 2022 – Present', sub: 'Acme Corp', subRight: 'Austin, TX', bullets: ['Cut API latency by **40%** by redesigning the caching layer', 'Open source work: [Project repo](https://github.com/alexmorgan/project)'] }] },
    { title: 'Education', kind: 'entries', entries: [{ title: 'University of Texas at Austin', right: 'Austin, TX', sub: 'B.S. Computer Science', subRight: '2015 – 2019', bullets: ['**GPA: 3.8 / 4.0**'] }] },
    { title: 'Selected Projects', kind: 'entries', pageBreak: false, entries: [{ title: 'Realtime Chat App', right: '2023', bullets: ['Built with React, Node.js and WebSockets'] }] },
    { title: 'Technical Skills', kind: 'skills', skills: [{ label: 'Languages', items: 'TypeScript, Python, Go, SQL' }, { label: 'Tools', items: 'React, Node.js, Docker, AWS, Git' }] },
    { title: 'Certifications', kind: 'bullets', bullets: ['AWS Certified Solutions Architect (2023)', 'Google Professional Cloud Developer (2022)'] },
    { title: 'Open Source', blocks: [{ type: 'text', text: 'Maintainer of **3 libraries** with 2k+ GitHub stars.' }, { type: 'bullets', bullets: ['Contributed to React and Vite', 'Speaker at DevConf 2024'] }, { type: 'tags', tags: 'TypeScript, Rust, Docs' }] },
    { title: 'Interests', kind: 'tags', tags: 'Open source, Hiking, Chess' },
    { title: 'Languages', kind: 'skills', skills: [{ label: 'English', items: 'Native' }, { label: 'Spanish', items: 'Conversational' }] },
  ],
  template: 'classic',
  style: { size: 12, font: 'serif', accent: '#1e3a8a', lineHeight: 1.45, margin: 12, gap: 10, align: 'center', icons: true },
  fmt: { 'basics.name': { color: '#1e3a8a', size: 30, bold: true, italic: false, underline: false, align: 'center', font: 'serif', dx: 0, dy: 0 } },
}

export function normalize(x: any): Data {
  if (!x || typeof x !== 'object' || !x.basics || !Array.isArray(x.sections)) throw new Error('JSON needs a "basics" object and a "sections" array.')
  const nb = (b: any, i: number, j: number): Block => {
    const type = b?.type ?? b?.kind
    if (!['text', 'entries', 'skills', 'bullets', 'tags'].includes(type)) throw new Error(`Section ${i + 1}, block ${j + 1}: "type" must be text, entries, skills, bullets or tags.`)
    if (type === 'text') return { type, text: b.text ?? '' }
    if (type === 'skills') return { type, skills: b.skills ?? [] }
    if (type === 'bullets') return { type, bullets: b.bullets ?? [] }
    if (type === 'tags') return { type, tags: b.tags ?? '' }
    return { type, entries: (b.entries ?? []).map((e: any) => ({ title: e.title ?? '', right: e.right ?? '', sub: e.sub ?? '', subRight: e.subRight ?? '', bullets: e.bullets ?? [] })) }
  }
  const sections = (x.sections as any[]).map((s, i): Section => ({
    title: String(s.title ?? ''), hideTitle: !!s.hideTitle, pageBreak: !!s.pageBreak, flow: s.flow === 'split' ? 'split' : 'keep', ...(typeof s.gapTop === 'number' ? { gapTop: Math.max(0, Math.min(80, s.gapTop)) } : {}),
    blocks: Array.isArray(s.blocks) ? s.blocks.map((b: any, j: number) => nb(b, i, j)) : s.kind ? [nb(s, i, 0)] : [],
  }))
  const obj = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : undefined)
  return { template: typeof x.template === 'string' ? x.template : undefined, basics: { ...B0, ...x.basics, links: x.basics.links ?? [], personal: Array.isArray(x.basics.personal) ? x.basics.personal.map((p: any) => ({ label: String(p?.label ?? ''), value: String(p?.value ?? '') })) : undefined, icons: obj(x.basics.icons), photo: typeof x.basics.photo === 'string' && /^(data:image\/|https?:)/.test(x.basics.photo) ? x.basics.photo : undefined }, sections, style: obj(x.style), fmt: obj(x.fmt), layout: Array.isArray(x.layout?.pages) && !x.layout.pages.some((p: any) => p?.objects?.some((o: any) => o?.eid)) ? { pages: x.layout.pages.map((p: any) => ({ bg: p.bg, objects: (p.objects || []).filter((o: any) => o && ['text', 'line', 'rect', 'image', 'icon'].includes(o.type)).map((o: any) => ({ ...o, id: o.id || uid() })) })) } : undefined }
}

export const BLANK: Data = normalize({ basics: B0, sections: [{ title: 'Summary', kind: 'text' }, { title: 'Experience', kind: 'entries' }, { title: 'Education', kind: 'entries' }, { title: 'Skills', kind: 'skills' }] })
export const SAMPLE: Data = normalize(RAW)
// Same content without style overrides, so each template shows its own look.
export const SAMPLE_PLAIN: Data = { ...SAMPLE, template: undefined, style: undefined, fmt: undefined }

export const JSON_REF: [string, string][] = [
  ['template', 'classic | modern | compact | sidebar | elegant | academic | photoClassic | photoSidebar | photoBand | infoGrid'],
  ['basics.photo', 'Profile photo as a data: URL or https URL (shown by the photo templates)'],
  ['basics.personal', 'List of {"label":"Gender","value":"Male"} details (age, nationality ...), shown by the photo templates'],
  ['basics.icons', 'Per contact item icon key or "none", e.g. {"email":"none","link0":"github"}'],
  ['style.icons', 'true = show an icon before each contact detail'],
  ['style.headerGap', 'Extra space below the header block in px, 0 to 60'],
  ['style.photoShape / photoSize', 'circle | rounded | square, and photo size in mm (20 to 50)'],
  ['sections[].gapTop', 'Space above this section in px (overrides style.gap), 0 to 80'],
  ['style.size', 'Base font size in px, 9 to 16'],
  ['style.font', '"" (template default) | serif | sans | humanist | times | garamond | roboto | opensans | lato | montserrat | sourcesans | inter | poppins | merriweather | playfair | lora | ebgaramond'],
  ['style.accent', 'Any hex colour for headings and links, e.g. "#1e3a8a"'],
  ['style.lineHeight', 'Line spacing, 1.1 to 2'],
  ['style.margin', 'Page margin in mm, 6 to 25'],
  ['style.gap', 'Space between sections in px, 2 to 26'],
  ['style.align', 'Header alignment: left | center'],
  ['sections[].title', 'Section heading text'],
  ['sections[].hideTitle', 'true hides the heading'],
  ['sections[].pageBreak', 'true starts the section on a new page'],
  ['sections[].flow', 'keep = move whole section to next page if it does not fit | split = continue across pages'],
  ['sections[].blocks[].type', 'text | entries | skills | bullets | tags (mix any number per section)'],
  ['fmt', 'Per-element overrides made with the canvas editor, keyed by element id'],
  ['fmt.<id>.color', 'Hex text colour, e.g. "#b91c1c"'],
  ['fmt.<id>.size', 'Font size in px'],
  ['fmt.<id>.bold / italic / underline', 'true or false'],
  ['fmt.<id>.align', 'left | center | right'],
  ['fmt.<id>.font', 'Same values as style.font'],
  ['fmt.<id>.dx / dy', 'Move the element by this many px (right / down). Negative moves left / up'],
  ['layout', 'Free objects drawn on top of the template pages (text boxes, dividers, boxes, images). Everything else is edited through fmt'],
  ['layout.pages[].bg', 'Page background colour (hex)'],
  ['layout.pages[].objects[]', 'Elements in stacking order, back to front. Common: id, type (text | line | rect | image), x, y, w, h (px on a 794 x 1123 A4 page), rot (deg), opacity (0 to 1)'],
  ['objects text', 'text, size, color, bold, italic, underline, align, font (CSS family), lh (line height), ls (letter spacing), caps (upper | small)'],
  ['objects line', 'w = length, thickness, color, dash (true = dashed); use rot 90 for vertical'],
  ['objects rect', 'w, h, fill, stroke, sw (stroke width), radius (999 = pill or circle)'],
  ['objects image', 'src (data URL), w, h, fit (cover | contain), radius'],
  ['objects icon', 'path (24x24 SVG path), stroke (colour), sw (line width), w = size. Also on any object: grp, locked, hidden'],
  ['fmt.<id>.ax / ay', 'Absolute position on the page in px once an element has been moved on the canvas (the element then no longer affects the others)'],
  ['fmt.<id>.grp / locked', 'Group name shared by elements that move together / true = cannot be selected on the canvas'],
  ['fmt.<id>.hidden', 'true hides the element (restore it from the Design panel)'],
  ['fmt.<id>.w', 'Width in px (the element becomes a block of that width)'],
  ['fmt.<id>.th / opacity', 'Divider thickness in px (ids ending in .rule) / opacity 0 to 1'],
  ['Element ids', 'basics.name | headline | location | email | phone | link0 | rule · s{section}.title | rule · s{section}.b{block}.text | tags | bl{n} | k{n}.label | k{n}.items | e{n}.title | e{n}.right | e{n}.sub | e{n}.subRight | e{n}.bl{n}  (numbers start at 0, e.g. s1.b0.e0.title)'],
]

function locate(d: Data, id: string): [any, string] | null {
  const p = id.split('.')
  try {
    if (p[0] === 'basics') {
      const m = p[1].match(/^link(\d+)$/)
      return m ? [d.basics.links![+m[1]], 'label'] : [d.basics, p[1]]
    }
    const s = d.sections[+p[0].slice(1)]
    if (p[1] === 'title') return [s, 'title']
    const b = s.blocks[+p[1].slice(1)], q = p.slice(2)
    if (q[0] === 'text' || q[0] === 'tags') return [b, q[0]]
    if (q[0].startsWith('bl')) return [b.bullets, q[0].slice(2)]
    if (q[0].startsWith('k')) return [b.skills![+q[0].slice(1)], q[1]]
    const e = b.entries![+q[0].slice(1)]
    return q[1].startsWith('bl') ? [e.bullets, q[1].slice(2)] : [e, q[1]]
  } catch { return null }
}
export const getByEid = (d: Data, id: string): string | undefined => { const l = locate(d, id); return l ? l[0]?.[l[1]] : undefined }
// Writes edited text back into the data. Returns true if something changed.
export function setByEid(d: Data, id: string, v: string): boolean {
  const l = locate(d, id)
  if (!l || !l[0] || l[0][l[1]] === v) return false
  l[0][l[1]] = v
  return true
}
