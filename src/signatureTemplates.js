// 16 email-safe signature templates (tables + inline styles only, so Gmail / Outlook / Apple Mail render them).
// Each template: build(fields) -> HTML string. Every user value is escaped.

export const SAMPLE = {
  name: 'Your Name', title: 'Your Title', company: 'Company or University', phone: '+1 555 123 4567',
  email: 'you@example.com', website: 'example.com', linkedin: 'linkedin.com/in/you',
  tagline: 'A short line about you', ctaText: 'Book a call', ctaUrl: 'example.com/call', accent: '#4f46e5',
};

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (u = '') => { const s = String(u).trim(); return !s ? '' : /^(https?:|mailto:|tel:)/i.test(s) ? s : `https://${s}`; };
const bare = (u = '') => String(u).replace(/^https?:\/\//i, '').replace(/\/$/, '');
const FONT = 'font-family:Arial,Helvetica,sans-serif;';
const SERIF = 'font-family:Georgia,\'Times New Roman\',serif;';
const MONO = 'font-family:Consolas,Menlo,monospace;';

const link = (href, text, c, extra = '') => `<a href="${esc(href)}" style="color:${c};text-decoration:none;${extra}">${esc(text)}</a>`;
const contact = (f, c, sep = ' &nbsp;&bull;&nbsp; ') => [
  f.phone && link(`tel:${f.phone.replace(/\s/g, '')}`, f.phone, c),
  f.email && link(`mailto:${f.email}`, f.email, c),
  f.website && link(url(f.website), bare(f.website), c),
  f.linkedin && link(url(f.linkedin), 'LinkedIn', c),
].filter(Boolean).join(sep);
const stack = (f, c) => [
  f.phone && link(`tel:${f.phone.replace(/\s/g, '')}`, f.phone, c),
  f.email && link(`mailto:${f.email}`, f.email, c),
  f.website && link(url(f.website), bare(f.website), c),
  f.linkedin && link(url(f.linkedin), 'LinkedIn', c),
].filter(Boolean).join('<br>');
const roleLine = (f, sep = ' | ') => [f.title, f.company].filter(Boolean).map(esc).join(sep);
const img = (src, w, radius = '0') => src ? `<img src="${esc(url(src))}" width="${w}" height="${w}" alt="" style="display:block;width:${w}px;height:${w}px;border:0;border-radius:${radius}">` : '';
const logo = (f, w = 90) => f.logoUrl ? `<img src="${esc(url(f.logoUrl))}" width="${w}" alt="${esc(f.company || '')}" style="display:block;width:${w}px;height:auto;border:0">` : '';
const btn = (f, c) => f.ctaText && f.ctaUrl ? `<a href="${esc(url(f.ctaUrl))}" style="display:inline-block;background:${c};color:#ffffff;padding:7px 15px;border-radius:5px;text-decoration:none;font-weight:bold;font-size:12px">${esc(f.ctaText)}</a>` : '';
const wrap = (inner, font = FONT) => `<table cellpadding="0" cellspacing="0" border="0" style="${font}font-size:13px;line-height:1.5;color:#333333;margin-top:18px"><tr><td>${inner}</td></tr></table>`;
const row = (html, style = '') => html ? `<div style="${style}">${html}</div>` : '';

export const SIGNATURES = [
  { id: 'classic', name: 'Classic', purpose: 'Everyday use', build: (f) => wrap(`${row(esc(f.name), 'font-size:16px;font-weight:bold;color:#111')}${row(roleLine(f), 'color:#666')}${row(contact(f, f.accent), 'margin-top:6px')}`) },
  { id: 'accent-bar', name: 'Accent bar', purpose: 'Business', build: (f) => wrap(`<table cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:4px solid ${f.accent};padding-left:12px">${row(esc(f.name), 'font-size:16px;font-weight:bold;color:#111')}${row(roleLine(f), 'color:#666')}${row(stack(f, '#333'), 'margin-top:6px')}</td></tr></table>`) },
  { id: 'logo-left', name: 'Logo left', purpose: 'Company mail', build: (f) => wrap(`<table cellpadding="0" cellspacing="0" border="0"><tr>${f.logoUrl ? `<td style="padding-right:14px;border-right:1px solid #dddddd;vertical-align:top">${logo(f)}</td>` : ''}<td style="padding-left:${f.logoUrl ? 14 : 0}px;vertical-align:top">${row(esc(f.name), 'font-size:15px;font-weight:bold;color:#111')}${row(roleLine(f), 'color:#666')}${row(contact(f, f.accent, '<br>'), 'margin-top:6px')}</td></tr></table>`) },
  { id: 'minimal', name: 'Minimal', purpose: 'Quick replies', build: (f) => wrap(`${row(`<b style="color:#111">${esc(f.name)}</b>${f.title ? ` &mdash; ${esc(f.title)}` : ''}`)}${row(contact(f, f.accent), 'font-size:12px;margin-top:2px')}`) },
  { id: 'banner', name: 'Colour banner', purpose: 'Sales / marketing', build: (f) => wrap(`<table cellpadding="0" cellspacing="0" border="0" style="background:${f.accent};border-radius:8px"><tr><td style="padding:14px 18px;color:#ffffff">${row(esc(f.name), 'font-size:17px;font-weight:bold;color:#ffffff')}${row(roleLine(f), 'color:#ffffff;opacity:.9')}${row(contact(f, '#ffffff'), 'margin-top:8px;font-size:12px')}</td></tr></table>`) },
  { id: 'academic', name: 'Academic', purpose: 'Professors / research', build: (f) => wrap(`${row(esc(f.name), 'font-size:16px;font-weight:bold;color:#111')}${row(esc(f.title), 'font-style:italic;color:#555')}${row(esc(f.company), 'color:#555')}<div style="border-top:1px solid #bbbbbb;margin-top:8px;padding-top:6px;font-size:12px">${contact(f, f.accent, ' &nbsp;/&nbsp; ')}</div>`, SERIF) },
  { id: 'job-seeker', name: 'Job seeker', purpose: 'Applications', build: (f) => wrap(`${row(esc(f.name), 'font-size:16px;font-weight:bold;color:#111')}${row(esc(f.tagline || f.title), 'color:#555;margin-bottom:8px')}${[f.linkedin && link(url(f.linkedin), 'LinkedIn', f.accent, 'border:1px solid ' + f.accent + ';padding:3px 10px;border-radius:12px;font-size:12px;margin-right:6px;display:inline-block'), f.website && link(url(f.website), 'Portfolio', f.accent, 'border:1px solid ' + f.accent + ';padding:3px 10px;border-radius:12px;font-size:12px;margin-right:6px;display:inline-block'), f.email && link(`mailto:${f.email}`, 'Email me', f.accent, 'border:1px solid ' + f.accent + ';padding:3px 10px;border-radius:12px;font-size:12px;display:inline-block')].filter(Boolean).join('')}${row(esc(f.phone), 'margin-top:8px;color:#666;font-size:12px')}`) },
  { id: 'startup', name: 'Startup', purpose: 'Founders / pitches', build: (f) => wrap(`${row(esc(f.name), 'font-size:18px;font-weight:bold;color:#111;letter-spacing:-0.3px')}${row(roleLine(f, ' at '), 'color:#666')}${row(esc(f.tagline), 'font-style:italic;color:#777;margin:6px 0')}${row(btn(f, f.accent), 'margin:8px 0')}${row(contact(f, f.accent), 'font-size:12px')}`) },
  { id: 'sales', name: 'Sales CTA', purpose: 'Outreach / follow-ups', build: (f) => wrap(`<table cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:top;padding-right:16px">${row(esc(f.name), 'font-size:15px;font-weight:bold;color:#111')}${row(roleLine(f), 'color:#666')}${row(f.phone ? link(`tel:${f.phone.replace(/\s/g, '')}`, f.phone, f.accent, 'font-size:15px;font-weight:bold') : '', 'margin-top:6px')}${row(f.email ? link(`mailto:${f.email}`, f.email, '#333') : '')}</td><td style="vertical-align:middle">${btn(f, f.accent)}</td></tr></table>`) },
  { id: 'formal', name: 'Formal / legal', purpose: 'Legal & corporate', build: (f) => wrap(`${row(esc(f.name).toUpperCase(), 'font-size:14px;letter-spacing:1.5px;color:#111;font-weight:bold')}${row(roleLine(f), 'color:#555;margin-top:2px')}${row(stack(f, '#333'), 'margin-top:8px;font-size:12px')}${row('This message may contain confidential information intended only for the addressee.', 'margin-top:10px;font-size:10px;color:#999;max-width:420px')}`, SERIF) },
  { id: 'developer', name: 'Developer', purpose: 'Tech roles', build: (f) => wrap(`${row(`<span style="color:${f.accent}">~/</span>${esc(f.name)}`, 'font-size:15px;font-weight:bold;color:#111')}${row(`# ${roleLine(f, ' @ ')}`, 'color:#888')}${row([f.website && link(url(f.website), 'portfolio', f.accent), f.linkedin && link(url(f.linkedin), 'linkedin', f.accent), f.email && link(`mailto:${f.email}`, 'mail', f.accent)].filter(Boolean).map((x) => `[ ${x} ]`).join(' '), 'margin-top:6px')}`, MONO) },
  { id: 'creative', name: 'Creative', purpose: 'Design & media', build: (f) => wrap(`${row(esc(f.name), `font-size:22px;font-weight:bold;color:${f.accent};letter-spacing:-0.5px`)}${row(esc(f.title), 'color:#111;font-weight:bold')}<div style="height:3px;width:60px;background:${f.accent};margin:6px 0 8px"></div>${row(esc(f.tagline), 'color:#666;font-style:italic;margin-bottom:6px')}${row(contact(f, '#333'), 'font-size:12px')}`) },
  { id: 'executive', name: 'Executive', purpose: 'Senior / formal', build: (f) => wrap(`<table cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid ${f.accent};border-bottom:1px solid #cccccc"><tr><td style="padding:10px 4px 10px 0">${row(esc(f.name), 'font-size:16px;font-weight:bold;color:#111')}${row(esc(f.title), `color:${f.accent};font-weight:bold`)}${row(esc(f.company), 'color:#666')}${row(contact(f, '#333'), 'margin-top:6px;font-size:12px')}</td></tr></table>`, SERIF) },
  { id: 'photo', name: 'Photo circle', purpose: 'Personal brand', build: (f) => wrap(`<table cellpadding="0" cellspacing="0" border="0"><tr>${f.photoUrl ? `<td style="padding-right:14px;vertical-align:middle">${img(f.photoUrl, 72, '50%')}</td>` : ''}<td style="vertical-align:middle">${row(esc(f.name), 'font-size:16px;font-weight:bold;color:#111')}${row(roleLine(f), `color:${f.accent}`)}${row(contact(f, '#555'), 'margin-top:4px;font-size:12px')}</td></tr></table>`) },
  { id: 'dark-card', name: 'Dark card', purpose: 'Modern / tech', build: (f) => wrap(`<table cellpadding="0" cellspacing="0" border="0" style="background:#16181d;border-radius:8px"><tr><td style="padding:14px 18px">${row(esc(f.name), 'font-size:16px;font-weight:bold;color:#ffffff')}${row(roleLine(f), `color:${f.accent}`)}${row(contact(f, '#c9ccd4'), 'margin-top:8px;font-size:12px')}</td></tr></table>`) },
  { id: 'friendly', name: 'Friendly', purpose: 'Support / warm tone', build: (f) => wrap(`${row('Warm regards,', 'color:#666;margin-bottom:4px')}${row(esc(f.name), `font-size:16px;font-weight:bold;color:${f.accent}`)}${row(roleLine(f), 'color:#666')}${row(esc(f.tagline), 'color:#888;font-style:italic;margin-top:4px')}${row(contact(f, '#555'), 'margin-top:6px;font-size:12px')}`) },
];
