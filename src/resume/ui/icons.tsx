// Thin line icons (24x24) in a Figma-like style.
const P: Record<string, string> = {
  move: 'M5 3l14 7-6 2-2 6z', hand: 'M18 11V6a2 2 0 00-4 0M14 10V4a2 2 0 00-4 0v6M10 10.5V6a2 2 0 00-4 0v8M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.9-5.7-2.4L3.4 16a2 2 0 013.2-2.4L8 15',
  rect: 'M4 4h16v16H4z', ellipse: 'M12 20a8 8 0 100-16 8 8 0 000 16z', line: 'M5 19L19 5', text: 'M5 6V4h14v2M12 4v16M9 20h6',
  image: 'M4 4h16v16H4zM9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM20 15l-5-5L6 20', star: 'M12 3l2.6 5.600 6.100.8-4.500 4.200 1.100 6.100L12 16.800 6.700 19.700l1.100-6.100L3.300 9.400l6.100-.8z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', eyeoff: 'M3 3l18 18M10.600 6.100A9 9 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.200 3.800M6.400 7.400A17 17 0 002 12s4 7 10 7a9.500 9.500 0 004-.900',
  lock: 'M6 11h12v9H6zM8.500 11V8a3.500 3.500 0 017 0v3', unlock: 'M6 11h12v9H6zM8.500 11V8a3.500 3.500 0 016.800-1.200',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  alignL: 'M4 3v18M8 7h12v4H8zM8 14h7v4H8z', alignC: 'M12 3v18M5 7h14v4H5zM8 14h8v4H8z', alignR: 'M20 3v18M4 7h12v4H4zM9 14h7v4H9z',
  alignT: 'M3 4h18M7 8h4v12H7zM14 8h4v7h-4z', alignM: 'M3 12h18M7 5h4v14H7zM14 8h4v8h-4z', alignB: 'M3 20h18M7 4h4v12H7zM14 9h4v7h-4z',
  distH: 'M4 4v16M20 4v16M9 8h6v8H9z', distV: 'M4 4h16M4 20h16M8 9h8v6H8z',
  group: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7.500h2.500V13', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', copy: 'M9 9h11v11H9zM5 15V4h11', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', page: 'M6 3h9l4 4v14H6zM14 3v5h5', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', grid: 'M4 4h16v16H4zM4 12h16M12 4v16', margin: 'M7 7h10v10H7z',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.500 9.500a2.500 2.500 0 114 2c-.8.600-1.500 1-1.500 2M12 17h.01', code: 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14', chevron: 'M6 9l6 6 6-6',
  bold: 'M7 4h6a3.500 3.500 0 010 7H7zM7 11h7a3.500 3.500 0 010 7H7z', italic: 'M10 4h8M6 20h8M15 4L9 20', underline: 'M7 4v7a5 5 0 0010 0V4M5 21h14',
  tleft: 'M4 6h16M4 10h10M4 14h16M4 18h10', tcenter: 'M4 6h16M7 10h10M4 14h16M7 18h10', tright: 'M4 6h16M10 10h10M4 14h16M10 18h10', frontt: 'M8 8h12v12H8zM4 16V4h12', download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', bar: 'M4 10h16v4H4z',
}
export type IconName = keyof typeof P
export function Icon({ n, size = 16, sw = 1.6 }: { n: IconName; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[n]} /></svg>
}
