// Direct PDF file (pages rendered as images). Used where printing is blocked (embedded previews) or when the user prefers a file.
export async function pdfFile(name: string) {
  const [{ default: h2c }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const src = document.getElementById('pages')
  if (!src) throw new Error('Nothing to export')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:794px'
  host.innerHTML = src.innerHTML
  host.querySelectorAll('.hdl').forEach((e) => e.remove())
  host.querySelectorAll('.cv-ui').forEach((e) => e.remove())
  host.querySelectorAll<HTMLElement>('[data-oid]').forEach((e) => { e.style.outline = 'none' })
  host.querySelectorAll<HTMLElement>('.selbox,.eh').forEach((e) => { e.style.outline = 'none' })
  document.body.appendChild(host)
  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pgs = host.querySelectorAll<HTMLElement>('.page')
    for (let i = 0; i < pgs.length; i++) {
      const cv = await h2c(pgs[i], { scale: 2, backgroundColor: '#ffffff' })
      if (i) pdf.addPage()
      pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297)
    }
    const blob = pdf.output('blob'), filename = (name || 'resume').replace(/[^\w\- ]+/g, '') + '.pdf'
    const dl = await (window as any).claude?.use?.('downloads')
    if (dl) return void (await dl.save({ filename, data: blob }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  } finally { host.remove() }
}
