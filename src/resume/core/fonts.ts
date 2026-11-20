// Font choices shared by templates, the canvas and the JSON format. Web fonts are bundled (see fontFaces.ts).
const CJK = ",'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif"
export const FONTS: Record<string, [string, string]> = {
  '': ['Template default', ''], serif: ['Serif (Georgia)', "Georgia,'Times New Roman',serif"], sans: ['Sans (Arial)', 'Arial,Helvetica,sans-serif'],
  humanist: ['Humanist (Calibri)', "Calibri,'Segoe UI',Arial,sans-serif"], times: ['Times New Roman', "'Times New Roman',Times,serif"], garamond: ['Garamond', "Garamond,'Palatino Linotype',Georgia,serif"],
  roboto: ['Roboto', "Roboto" + CJK], opensans: ['Open Sans', "'Open Sans'" + CJK], lato: ['Lato', "Lato" + CJK], montserrat: ['Montserrat', "Montserrat" + CJK],
  sourcesans: ['Source Sans 3', "'Source Sans 3'" + CJK], inter: ['Inter', "Inter" + CJK], poppins: ['Poppins', "Poppins" + CJK],
  merriweather: ['Merriweather (serif)', "Merriweather,Georgia,serif"], playfair: ['Playfair Display (serif)', "'Playfair Display',Georgia,serif"], lora: ['Lora (serif)', "Lora,Georgia,serif"], ebgaramond: ['EB Garamond (serif)', "'EB Garamond',Garamond,Georgia,serif"],
}
export const fontCss = (key?: string): string | undefined => (key && FONTS[key]?.[1]) || undefined
