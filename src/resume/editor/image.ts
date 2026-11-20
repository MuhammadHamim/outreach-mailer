/** Downscale an uploaded image (max 900px) so resumes stay small to save and export. */
export function shrinkImage(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onerror = () => rej(new Error('Could not read the image'))
    fr.onload = () => {
      const im = new Image()
      im.onerror = () => rej(new Error('Not a valid image'))
      im.onload = () => {
        const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas')
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k)
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
        res({ src: c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85), w: c.width, h: c.height })
      }
      im.src = fr.result as string
    }
    fr.readAsDataURL(file)
  })
}
