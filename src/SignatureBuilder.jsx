import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Save, X, Upload, Trash2, QrCode, Bold, Italic, AlignLeft, AlignCenter, AlignRight, RotateCcw, Undo2, Redo2, Type, Square, Minus, Copy } from "lucide-react";
import jsQR from "jsqr";
import { api } from "./api";
import { Field, useToast } from "./ui";
import { SIGNATURES, SAMPLE, FONT_STACKS, rectBg, adaptSignatureFields } from "./signatureTemplates";
import "./compose-extras.css";

const TEXT = [
  ["name", "Full name *"],
  ["title", "Job title"],
  ["org", "Organization"],
  ["field", "Department or field"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["wcid", "WeChat ID"],
  ["wcl", "WeChat profile link"],
  ["web", "Website"],
  ["loc", "Location"],
  ["li", "LinkedIn username"],
  ["gh", "GitHub username"],
  ["wa", "WhatsApp number"],
  ["tg", "Telegram username"],
  ["x", "X username"],
  ["ig", "Instagram username"],
  ["fb", "Facebook username"],
  ["yt", "YouTube channel/username"],
  ["cta", "Button text (optional)"],
  ["ctau", "Button link"],
  ["tag", "Small note (optional)"],
  ["iconBase", "Icon base URL (optional: online folder holding the icon PNGs, helps Gmail show icons)"],
];
const clean = (o = {}) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => String(v || "").trim()),
  );
const shrink = (file, max, square) =>
  new Promise((res, rej) => {
    const img = new Image(),
      u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      let sw = img.naturalWidth || img.width,
        sh = img.naturalHeight || img.height,
        sx = 0,
        sy = 0;
      if (!sw || !sh)
        return rej(
          new Error("This image type is not supported. Try PNG or JPG."),
        );
      if (square) {
        const m = Math.min(sw, sh);
        sx = (sw - m) / 2;
        sy = (sh - m) / 2;
        sw = sh = m;
      }
      const k = Math.min(1, max / Math.max(sw, sh)),
        c = document.createElement("canvas");
      c.width = Math.round(sw * k);
      c.height = Math.round(sh * k);
      c.getContext("2d").drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        c.width,
        c.height,
      );
      c.toBlob(
        (b) => (b ? res(b) : rej(new Error("Could not process this image"))),
        file.type === "image/png" ||
          file.type === "image/svg+xml" ||
          file.type === "image/webp"
          ? "image/png"
          : "image/jpeg",
        0.9,
      );
    };
    img.onerror = () => rej(new Error("Not a valid image"));
    img.src = u;
  });
// ---- QR reading helpers: crops + uniform scaling + blur so round-dot WeChat QR codes decode ----
const tick = () => new Promise((r) => setTimeout(r, 0));
function blurGray(src, w, h, r) {
  // separable box blur on a Uint8ClampedArray luminance plane
  const tmp = new Float32Array(w * h), out = new Uint8ClampedArray(w * h), k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / k;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
function grayToRgba(g, w, h, stretch) {
  let lo = 255, hi = 0;
  if (stretch) for (let i = 0; i < g.length; i++) { if (g[i] < lo) lo = g[i]; if (g[i] > hi) hi = g[i]; }
  const span = Math.max(1, hi - lo), rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < g.length; i++) {
    const v = stretch ? ((g[i] - lo) * 255) / span : g[i];
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
async function decodeQrImage(image) {
  const nw = image.naturalWidth, nh = image.naturalHeight, side = Math.min(nw, nh);
  // crops [sx, sy, sw, sh]: whole picture first, then square windows sliding along the long edge
  const crops = [[0, 0, nw, nh]];
  const long = Math.max(nw, nh), step = Math.max(1, Math.round(side * 0.4));
  for (let p = 0; p + side <= long + 1; p += step) crops.push(nw >= nh ? [p, 0, side, side] : [0, p, side, side]);
  const last = long - side; if (last > 0 && (last % step)) crops.push(nw >= nh ? [last, 0, side, side] : [0, last, side, side]);
  const blurs = [0, 2, 4], t0 = Date.now();
  for (const [ci, [sx, sy, sw, sh]] of crops.entries()) {
    for (const target of ci === 0 ? [1000, 1600] : [1000]) {
      if (Date.now() - t0 > 8000) return null;   // give up after ~8 s so the button never hangs
      const k = target / Math.max(sw, sh);           // ONE uniform scale: never distorts the picture
      const w = Math.max(60, Math.round(sw * k)), h = Math.max(60, Math.round(sh * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.imageSmoothingQuality = "high"; x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
      x.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
      const img = x.getImageData(0, 0, w, h), px = img.data, lum = new Uint8ClampedArray(w * h);
      for (let i = 0; i < lum.length; i++) lum[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) | 0;
      for (const b of blurs) {
        // blur 0 = untouched pixels; blur > 0 merges round "dot" modules (new WeChat style) into solid squares
        const data = b ? grayToRgba(blurGray(lum, w, h, b), w, h, true) : grayToRgba(lum, w, h, true);
        const r = jsQR(data, w, h, { inversionAttempts: "attemptBoth" });
        if (r?.data) return r.data;
        await tick();
      }
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try { const d = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(c); if (d[0]?.rawValue) return d[0].rawValue; } catch { /* keep going */ }
      }
    }
  }
  return null;
}
function WeChatQrField({ value, onChange }) {
  const ref = useRef(), toast = useToast(), [busy, setBusy] = useState(false);
  const read = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose a QR image file", "err");
    setBusy(true);
    try {
      const url = URL.createObjectURL(file), image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Could not read that image"));
        image.src = url;
      });
      const raw = await decodeQrImage(image);
      const result = raw ? { data: raw } : null;
      URL.revokeObjectURL(url);
      if (!result?.data) return toast("No QR code found. Try a sharper, tightly cropped screenshot.", "err");
      const qrLink = result.data.trim();
      onChange(qrLink);
      toast("WeChat QR link extracted");
    } catch (e) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label="WeChat QR code">
      <div className="img-field">
        <button type="button" className="btn" disabled={busy} onClick={() => ref.current.click()}>
          <QrCode size={14} /> {busy ? "Reading QR…" : value ? "Replace QR" : "Upload QR"}
        </button>
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { read(e.target.files[0]); e.target.value = ""; }} />
      </div>
      <p className="hint" style={{ margin: "4px 0 0" }}>Upload the screenshot of My QR Code to extract its profile link.</p>
    </Field>
  );
}

function ImageField({ label, hint, value, onChange, square, max }) {
  const ref = useRef(),
    toast = useToast(),
    [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast("Choose an image file (PNG, JPG, WebP or SVG)", "err");
    if (file.size > 8e6) return toast("Image is larger than 8 MB", "err");
    setBusy(true);
    try {
      const blob = await shrink(file, max, square);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      onChange(dataUrl);
    } catch (e) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label={label}>
      <div className="img-field">
        {value && <img src={value} alt="" className="img-thumb" />}
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => ref.current.click()}
        >
          <Upload size={14} />{" "}
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && (
          <button
            type="button"
            className="btn"
            onClick={() => onChange("")}
            aria-label="Remove image"
          >
            <Trash2 size={14} />
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pick(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className="hint" style={{ margin: "4px 0 0" }}>
        {hint}
      </p>
    </Field>
  );
}

// ======================================================================================
// FREE-FORM SIGNATURE DESIGNER (modelled on the resume design mode)
//  - every part of the signature is an item on a canvas: drag it anywhere, resize it with the handles,
//    snap to the other items, nudge with the arrow keys, add text / images / shapes from the floating toolbar
//  - the floating panel edits the selected item (position, size, alignment, colour, font, link, photo ...)
//  - the layout is saved in fields.layout and compiled into an email-safe table by signatureTemplates.js
// ======================================================================================
const KIND = { pic: "pic", name: "text", title: "text", org: "text", tag: "text", contacts: "contacts", social: "social", cta: "button", bar: "rect", hair: "rect", vline: "rect" };
const LABEL = { pic: "Photo / logo", name: "Name", title: "Job title", org: "Organization / field", tag: "Small note", contacts: "Contact list", social: "Social icons", cta: "Button", bar: "Top accent bar", hair: "Top hairline", vline: "Divider line" };
const BUILTIN = Object.keys(KIND);
const AUTO = new Set(["pic", "contacts", "social", "button"]); // width follows the content
const kindOf = (id, it = {}) => KIND[id] || (it.type === "text" ? "text" : it.type === "image" ? "image" : "rect");
const labelOf = (id, it = {}) => LABEL[id] || (it.type === "text" ? "Text" : it.type === "image" ? "Image" : "Shape");
const TEXT_KEYS = { name: [["name", "Full name"]], title: [["title", "Job title"]], org: [["org", "Organization"], ["field", "Department or field"]], tag: [["tag", "Note text"]], cta: [["cta", "Button text"]] };
const DEF_SIZE = { name: 26, title: 13, org: 12, contacts: 13, tag: 11, cta: 12 };
const DEF_BOLD = { name: true, title: true };
const defColor = (id, accent) => ({ name: "#0f172a", title: accent, org: "#475569", contacts: "#1e293b", tag: "#64748b" })[id] || "#1e293b";
const DIRS8 = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HPOS = { nw: ["0%", "0%", "nwse-resize"], n: ["50%", "0%", "ns-resize"], ne: ["100%", "0%", "nesw-resize"], e: ["100%", "50%", "ew-resize"], se: ["100%", "100%", "nwse-resize"], s: ["50%", "100%", "ns-resize"], sw: ["0%", "100%", "nesw-resize"], w: ["0%", "50%", "ew-resize"] };
const TOL = 5;

const readImage = async (file, max) => {
  const blob = await shrink(file, max, false);
  const src = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  const dim = await new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth || 100, h: im.naturalHeight || 100 });
    im.onerror = () => res({ w: 100, h: 100 });
    im.src = src;
  });
  return { src, ...dim };
};

// Build the first free layout by measuring the classic layout in a hidden element.
function seedLayout(real) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:1000px;visibility:hidden;pointer-events:none;";
  host.innerHTML = SIGNATURES[0].build({ ...real, layout: undefined, _design: true });
  document.body.appendChild(host);
  try {
    const bar = host.querySelector('[data-el="bar"]');
    if (!bar) return null;
    const br = bar.getBoundingClientRect(), items = {};
    host.querySelectorAll("[data-el]").forEach((el) => {
      const id = el.getAttribute("data-el"), r = el.getBoundingClientRect();
      const st = { ...((real.styles || {})[id] || {}) };
      delete st.dx;
      delete st.dy;
      items[id] = { x: Math.round(r.left - br.left), y: Math.round(r.top - br.top), w: Math.round(r.width), h: Math.round(r.height), ...st };
    });
    if (items.hair) { items.hair.y += 2; items.hair.h = 1; }
    if (items.vline) items.vline.w = 3;
    ["name", "title", "org"].forEach((k) => items[k] && (items[k].w += 8)); // slack: fonts differ slightly between clients
    if (items.tag) items.tag.w = Math.max(items.tag.w, 200);
    return { items };
  } finally {
    host.remove();
  }
}

const Handle = ({ dir, onDown }) => (
  <span
    onPointerDown={(e) => e.button === 0 && onDown(e, dir)}
    style={{ position: "absolute", left: HPOS[dir][0], top: HPOS[dir][1], width: 9, height: 9, margin: "-4.5px 0 0 -4.5px", background: "#fff", border: "1px solid #0d99ff", boxSizing: "border-box", cursor: HPOS[dir][2], zIndex: 6, touchAction: "none" }}
  />
);

const AlignGlyph = ({ k }) => {
  const line = { left: [3, 2, 3, 14], hcenter: [8, 2, 8, 14], right: [13, 2, 13, 14], top: [2, 3, 14, 3], vcenter: [2, 8, 14, 8], bottom: [2, 13, 14, 13] }[k];
  const box = { left: [4, 5, 7, 3], hcenter: [5, 5, 6, 3], right: [5, 5, 7, 3], top: [5, 4, 3, 7], vcenter: [5, 5, 3, 6], bottom: [5, 5, 3, 7] }[k];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d={`M${line[0]} ${line[1]}L${line[2]} ${line[3]}`} />
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx="1" />
    </svg>
  );
};

function SigStage({ fields, parts, accent, sel, setSel, patchItem, patchItems, removeItem, restoreItem, resetItemStyle, addItem, set, undo, redo, reseed }) {
  const items = fields.layout.items;
  const live = useRef(items);
  live.current = items;
  const refs = useRef({}), stage = useRef(null), panel = useRef(null), fileRef = useRef(null);
  const [guides, setGuides] = useState(null), [grid, setGrid] = useState(false), [pp, setPp] = useState(null), [open, setOpen] = useState(true), [tick, setTick] = useState(0);
  const toast = useToast();

  const shown = (id, it) => !!it && !it.hidden && (kindOf(id, it) === "rect" || !!parts[id]);
  const ids = Object.keys(items).filter((id) => shown(id, items[id]));
  const hiddenIds = Object.keys(items).filter((id) => items[id] && items[id].hidden);

  // measure the real size of every item (height of text, width of auto-sized blocks) and add newly filled-in builtin items
  useLayoutEffect(() => {
    const upd = {};
    let bottom = 0;
    Object.values(items).forEach((it) => it && !it.hidden && it.h != null && (bottom = Math.max(bottom, (it.y || 0) + it.h)));
    Object.keys(parts).forEach((id) => {
      if (!items[id] && BUILTIN.includes(id)) { upd[id] = { x: 0, y: bottom + 12, w: 260 }; bottom += 44; }
    });
    Object.keys(items).forEach((id) => {
      const it = items[id], el = refs.current[id];
      if (!it || !el || it.hidden) return;
      const k = kindOf(id, it);
      if (k === "rect" || k === "image") return;
      const h = Math.ceil(el.offsetHeight), w = AUTO.has(k) ? Math.ceil(el.offsetWidth) : it.w;
      if (h !== it.h || w !== it.w) upd[id] = { ...(upd[id] || {}), h, w };
    });
    if (Object.keys(upd).length) patchItems(upd);
  });

  const box = (it) => ({ l: it.x, t: it.y, r: it.x + (it.w || 0), b: it.y + (it.h || 0) });
  const overlaps = new Set();
  ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => {
    const p = box(items[a]), q = box(items[b]);
    if (p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b) { overlaps.add(a); overlaps.add(b); }
  }));
  let maxR = 0, maxB = 0;
  ids.forEach((id) => { const b = box(items[id]); maxR = Math.max(maxR, b.r); maxB = Math.max(maxB, b.b); });
  const cw = Math.max(560, maxR + 60), ch = Math.max(170, maxB + 60);

  const cands = (id) => {
    const cx = [0], cy = [0];
    Object.entries(live.current).forEach(([k, v]) => {
      if (k === id || !shown(k, v) || v.w == null) return;
      cx.push(v.x, v.x + v.w / 2, v.x + v.w);
      cy.push(v.y, v.y + (v.h || 0) / 2, v.y + (v.h || 0));
    });
    return { cx, cy };
  };
  const near = (v, list) => { let best = null; list.forEach((c) => { const d = c - v; if (Math.abs(d) <= TOL && (best === null || Math.abs(d) < Math.abs(best))) best = d; }); return best; };
  const snapBox = (pos, size, list, out) => {
    let best = null;
    [0, size / 2, size].forEach((off) => { const d = near(pos + off, list); if (d !== null && (best === null || Math.abs(d) < Math.abs(best.d))) best = { d, line: pos + off + d }; });
    if (!best) return pos;
    out.push(best.line);
    return pos + best.d;
  };
  const track = (move, end) => {
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); end && end(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startDrag = (e, id) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    stage.current && stage.current.focus();
    setSel(id);
    const it0 = { ...live.current[id] }, x0 = e.clientX, y0 = e.clientY, { cx, cy } = cands(id);
    let moved = false;
    track(
      (ev) => {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return;
        moved = true;
        let dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (ev.shiftKey) (Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0));
        let nx = it0.x + dx, ny = it0.y + dy;
        const gv = [], gh = [];
        if (!ev.altKey) { nx = snapBox(nx, it0.w || 0, cx, gv); ny = snapBox(ny, it0.h || 0, cy, gh); }
        setGuides({ v: gv, h: gh });
        patchItem(id, { x: Math.max(0, Math.round(nx)), y: Math.max(0, Math.round(ny)) });
      },
      () => setGuides(null),
    );
  };

  const startResize = (e, id, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const it0 = { ...live.current[id] }, kind = kindOf(id, it0), x0 = e.clientX, y0 = e.clientY, s0 = fields.imageSize || 88, { cx } = cands(id), ar = it0.w / Math.max(1, it0.h);
    track(
      (ev) => {
        const dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (kind === "pic") return set("imageSize", Math.round(Math.max(24, Math.min(240, s0 + Math.max(dx, dy)))));
        let x = it0.x, y = it0.y, w = it0.w, h = it0.h;
        if (dir.includes("e")) w = it0.w + dx;
        if (dir.includes("w")) w = it0.w - dx;
        if (dir.includes("s")) h = it0.h + dy;
        if (dir.includes("n")) h = it0.h - dy;
        if (ev.shiftKey && dir.length === 2) (Math.abs(w - it0.w) >= Math.abs(h - it0.h) ? (h = w / ar) : (w = h * ar));
        w = Math.max(16, w);
        h = Math.max(2, h);
        if (dir.includes("w")) x = it0.x + it0.w - w;
        if (dir.includes("n")) y = it0.y + it0.h - h;
        const gv = [];
        if (!ev.altKey) {
          if (dir.includes("e")) { const d = near(x + w, cx); if (d !== null) { w += d; gv.push(x + w); } }
          if (dir.includes("w")) { const d = near(x, cx); if (d !== null) { x += d; w -= d; gv.push(x); } }
        }
        setGuides({ v: gv, h: [] });
        const p = { x: Math.max(0, Math.round(x)), w: Math.round(w) };
        if (kind !== "text") Object.assign(p, { y: Math.max(0, Math.round(y)), h: Math.round(h) });
        patchItem(id, p);
      },
      () => setGuides(null),
    );
  };

  const dupItem = (id) => {
    const it = items[id];
    if (!it || BUILTIN.includes(id)) return;
    const nid = addItem({ ...it, x: it.x + 14, y: it.y + 14 });
    setSel(nid);
  };
  const nudge = (dx, dy) => { const it = items[sel]; if (it) patchItem(sel, { x: Math.max(0, it.x + dx), y: Math.max(0, it.y + dy) }); };
  const onKey = (e) => {
    const t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey, step = e.shiftKey ? 10 : 1;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); return redo(); }
    if (!sel || !items[sel]) return;
    if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); return dupItem(sel); }
    if (e.key === "Escape") return setSel(null);
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeItem(sel); return setSel(null); }
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (k) { e.preventDefault(); nudge(k[0], k[1]); }
  };

  const alignTo = (m) => {
    const it = items[sel];
    if (!it) return;
    const others = ids.filter((k) => k !== sel).map((k) => box(items[k]));
    const b = others.length
      ? { l: Math.min(...others.map((o) => o.l)), r: Math.max(...others.map((o) => o.r)), t: Math.min(...others.map((o) => o.t)), b: Math.max(...others.map((o) => o.b)) }
      : { l: 0, r: cw - 60, t: 0, b: ch - 60 };
    const P = { left: { x: b.l }, hcenter: { x: Math.round((b.l + b.r) / 2 - it.w / 2) }, right: { x: b.r - it.w }, top: { y: b.t }, vcenter: { y: Math.round((b.t + b.b) / 2 - (it.h || 0) / 2) }, bottom: { y: b.b - (it.h || 0) } }[m];
    patchItem(sel, Object.fromEntries(Object.entries(P).map(([k, v]) => [k, Math.max(0, Math.round(v))])));
  };

  const addImg = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose an image file (PNG, JPG, WebP or SVG)", "err");
    try {
      const im = await readImage(file, 480), w = Math.min(160, im.w);
      setSel(addItem({ type: "image", src: im.src, x: 24, y: 24, w, h: Math.round((w * im.h) / im.w), fit: "cover" }));
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const dragPanel = (e) => {
    if (e.target.closest("button") || e.button !== 0) return;
    e.preventDefault();
    const st = stage.current.getBoundingClientRect(), r = panel.current.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    track((ev) => setPp({ left: Math.max(0, Math.min(st.width - 90, ev.clientX - st.left - ox)), top: Math.max(0, Math.min(st.height - 40, ev.clientY - st.top - oy)) }));
  };

  const tb = (on) => ({ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 8, border: 0, cursor: "pointer", background: on ? "#0d99ff" : "transparent", color: "rgba(255,255,255,.85)" });
  const sep = <span style={{ width: 1, height: 20, background: "rgba(255,255,255,.15)", margin: "0 4px" }} />;
  const it = sel ? items[sel] : null;

  return (
    <div ref={stage} tabIndex={0} onKeyDown={onKey} style={{ position: "relative", height: 520, marginTop: 8, border: "1px solid var(--border,#d6dae3)", borderRadius: 12, background: "#eceef3", overflow: "hidden", outline: "none" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: "40px 40px 90px" }} onPointerDown={(e) => { if (e.target === e.currentTarget) { setSel(null); stage.current && stage.current.focus(); } }}>
        <div
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}
          style={{ position: "relative", width: cw, height: ch, background: "#fff", boxShadow: "0 1px 6px rgba(15,23,42,.15)", borderRadius: 4, backgroundImage: grid ? "linear-gradient(to right, rgba(99,102,241,.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,.14) 1px, transparent 1px)" : undefined, backgroundSize: grid ? "8px 8px" : undefined }}
        >
          {ids.map((id) => {
            const p = items[id], k = kindOf(id, p), on = sel === id, rect = k === "rect", fixedH = rect || k === "image";
            const dirs = k === "text" ? ["w", "e"] : fixedH ? DIRS8 : k === "pic" ? ["se"] : [];
            return (
              <div
                key={id}
                ref={(el) => { if (el) refs.current[id] = el; else delete refs.current[id]; }}
                onPointerDown={(e) => startDrag(e, id)}
                onDoubleClick={() => { setSel(id); setOpen(true); setTick((n) => n + 1); }}
                title={labelOf(id, p)}
                style={{ position: "absolute", left: p.x, top: p.y, width: AUTO.has(k) ? "max-content" : p.w, height: fixedH ? p.h : undefined, cursor: "move", touchAction: "none", boxSizing: "border-box", outline: on ? "1px solid #0d99ff" : overlaps.has(id) ? "1px dashed #f43f5e" : undefined, background: rect ? rectBg(p, id, accent) : undefined, borderRadius: rect ? p.radius || 0 : undefined }}
              >
                {rect && <span style={{ position: "absolute", inset: -5 }} />}
                {!rect && <div style={{ pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: parts[id] }} />}
                {on && dirs.map((d) => <Handle key={d} dir={d} onDown={(e, dir) => startResize(e, id, dir)} />)}
                {on && (
                  <span style={{ position: "absolute", left: "50%", top: "100%", transform: "translate(-50%,8px)", background: "#0d99ff", color: "#fff", fontSize: 11, lineHeight: "16px", padding: "0 6px", borderRadius: 3, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 7 }}>
                    {Math.round(p.w || 0)} × {Math.round(p.h || 0)}
                  </span>
                )}
              </div>
            );
          })}
          {guides && guides.v.map((x, i) => <div key={"v" + i} style={{ position: "absolute", left: x, top: 0, bottom: 0, width: 1, background: "#f43f5e", pointerEvents: "none" }} />)}
          {guides && guides.h.map((y, i) => <div key={"h" + i} style={{ position: "absolute", top: y, left: 0, right: 0, height: 1, background: "#f43f5e", pointerEvents: "none" }} />)}
        </div>
      </div>

      {/* floating tool bar (bottom centre, like the resume editor) */}
      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 2, padding: 4, borderRadius: 12, background: "#2c2c2c", boxShadow: "0 8px 24px rgba(0,0,0,.35)", zIndex: 30 }}>
        <button type="button" title="Undo (Ctrl+Z)" style={tb(false)} onClick={undo}><Undo2 size={17} /></button>
        <button type="button" title="Redo (Ctrl+Y)" style={tb(false)} onClick={redo}><Redo2 size={17} /></button>
        {sep}
        <button type="button" title="Add text" style={tb(false)} onClick={() => { const id = addItem({ type: "text", text: "Type something", x: 24, y: 24, w: 180 }); setSel(id); setOpen(true); setTick((n) => n + 1); }}><Type size={17} /></button>
        <button type="button" title="Add image" style={tb(false)} onClick={() => fileRef.current && fileRef.current.click()}><Upload size={17} /></button>
        <button type="button" title="Add rectangle" style={tb(false)} onClick={() => setSel(addItem({ type: "rect", x: 24, y: 24, w: 100, h: 60, bg: "#e2e8f0" }))}><Square size={17} /></button>
        <button type="button" title="Add line" style={tb(false)} onClick={() => setSel(addItem({ type: "rect", x: 24, y: 24, w: 120, h: 2, bg: accent }))}><Minus size={17} /></button>
        {sep}
        <button type="button" title="Show grid" style={{ ...tb(grid), fontSize: 14, fontWeight: 700 }} onClick={() => setGrid(!grid)}>#</button>
        <button type="button" title="Reset the whole layout to the classic arrangement" style={tb(false)} onClick={reseed}><RotateCcw size={16} /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { addImg(e.target.files[0]); e.target.value = ""; }} />
      </div>

      {/* floating inspector panel (drag the header to move it) */}
      <div
        ref={panel}
        style={{ position: "absolute", width: 284, maxHeight: "calc(100% - 84px)", display: "flex", flexDirection: "column", background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,.22)", zIndex: 25, ...(pp ? { left: pp.left, top: pp.top } : { right: 12, top: 12 }) }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div onPointerDown={dragPanel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderBottom: open ? "1px solid #e2e8f0" : 0, cursor: "grab", userSelect: "none", fontSize: 12, fontWeight: 600 }}>
          <span>{it ? labelOf(sel, it) : "Signature canvas"}</span>
          <button type="button" className="btn" style={{ padding: "0 8px", minHeight: 22 }} onClick={() => setOpen(!open)}>{open ? "–" : "+"}</button>
        </div>
        {open && (
          <div style={{ overflow: "auto", padding: 10, display: "grid", gap: 10 }}>
            <SigInspector sel={sel} it={it} fields={fields} accent={accent} set={set} patchItem={patchItem} resetItemStyle={resetItemStyle} removeItem={(id) => { removeItem(id); setSel(null); }} dupItem={dupItem} alignTo={alignTo} hiddenIds={hiddenIds} restoreItem={restoreItem} tick={tick} reseed={reseed} overlapCount={overlaps.size} />
          </div>
        )}
      </div>
    </div>
  );
}

const NumF = ({ l, v, on, min, max, step = 1, title }) => (
  <label title={title} style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid var(--border,#d6dae3)", borderRadius: 6, padding: "0 6px", background: "#fff" }}>
    <span style={{ fontSize: 11, color: "#64748b", minWidth: 12 }}>{l}</span>
    <input type="number" min={min} max={max} step={step} value={v ?? ""} onChange={(e) => e.target.value !== "" && on(Number(e.target.value))} style={{ border: 0, outline: 0, width: "100%", minWidth: 0, padding: "5px 0", background: "transparent" }} />
  </label>
);
const Tog = ({ on, onClick, title, children }) => <button type="button" className={`btn${on ? " primary" : ""}`} title={title} onClick={onClick}>{children}</button>;

function SigInspector({ sel, it, fields, accent, set, patchItem, resetItemStyle, removeItem, dupItem, alignTo, hiddenIds, restoreItem, tick, reseed, overlapCount }) {
  const first = useRef(null);
  useEffect(() => { if (tick && first.current) { first.current.focus(); first.current.select && first.current.select(); } }, [tick]);
  const row = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
  const sec = { display: "grid", gap: 6, paddingTop: 8, borderTop: "1px solid #eef0f4" };
  const cap = { fontSize: 11, fontWeight: 600, color: "#64748b" };

  if (!it)
    return (
      <>
        <p className="hint" style={{ margin: 0 }}>Click anything to select it, then drag to move. Double-click text to type. Arrow keys nudge (Shift = 10px). Hold Alt while dragging to turn snapping off.</p>
        {overlapCount > 0 && <p style={{ margin: 0, fontSize: 12, color: "#be123c" }}>Red dashed items overlap. Email layouts cannot overlap, so overlapping items are pushed down in the real email.</p>}
        {hiddenIds.length > 0 && (
          <div style={sec}>
            <span style={cap}>Hidden items</span>
            {hiddenIds.map((id) => (
              <button key={id} type="button" className="btn" onClick={() => restoreItem(id)}>Show “{labelOf(id, fields.layout.items[id])}”</button>
            ))}
          </div>
        )}
        <div style={sec}>
          <button type="button" className="btn" onClick={reseed}><RotateCcw size={14} /> Reset layout</button>
        </div>
      </>
    );

  const id = sel, kind = kindOf(id, it), up = (patch) => patchItem(id, patch);
  const col = (k, def, label) => (
    <label style={{ ...row, gap: 4 }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <input type="color" value={it[k] || def} onChange={(e) => up({ [k]: e.target.value })} />
      {it[k] && <button type="button" className="btn" style={{ padding: "0 6px", minHeight: 22 }} onClick={() => up({ [k]: undefined })}>Reset</button>}
    </label>
  );
  const fontSel = (
    <select value={it.font || ""} onChange={(e) => up({ font: e.target.value || undefined })} style={{ maxWidth: 140 }}>
      <option value="">Font: default</option>
      {Object.entries(FONT_STACKS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
  const link = (ph) => <input value={it.link || ""} placeholder={ph} onChange={(e) => up({ link: e.target.value || undefined })} />;
  const bold = it.bold === undefined ? !!DEF_BOLD[id] : it.bold;
  const textStyleRows = (
    <>
      <div style={row}>
        {fontSel}
        <NumF l="Aa" title="Font size" v={it.size ?? ""} min={8} max={64} on={(n) => up({ size: n })} />
      </div>
      <div style={row}>
        <Tog on={bold} title="Bold" onClick={() => up({ bold: !bold })}><Bold size={14} /></Tog>
        <Tog on={!!it.italic} title="Italic" onClick={() => up({ italic: !it.italic || undefined })}><Italic size={14} /></Tog>
        {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([k, Icon]) => (
          <Tog key={k} on={it.align === k} title={`Text ${k}`} onClick={() => up({ align: it.align === k ? undefined : k })}><Icon size={14} /></Tog>
        ))}
      </div>
      {col("color", defColor(id, accent), "Colour")}
    </>
  );

  return (
    <>
      <div style={row}>
        {["left", "hcenter", "right", "top", "vcenter", "bottom"].map((m) => (
          <button key={m} type="button" className="btn" style={{ padding: "2px 6px" }} title={`Align ${m.replace("hcenter", "horizontal centre").replace("vcenter", "vertical centre")} to the other items`} onClick={() => alignTo(m)}><AlignGlyph k={m} /></button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <NumF l="X" v={it.x} min={0} on={(n) => up({ x: Math.max(0, n) })} />
        <NumF l="Y" v={it.y} min={0} on={(n) => up({ y: Math.max(0, n) })} />
        {(kind === "text" || kind === "image" || kind === "rect") && <NumF l="W" title="Width" v={it.w} min={4} on={(n) => up({ w: Math.max(4, n) })} />}
        {(kind === "image" || kind === "rect") && <NumF l="H" title="Height" v={it.h} min={1} on={(n) => up({ h: Math.max(1, n) })} />}
      </div>

      {TEXT_KEYS[id] && (
        <div style={sec}>
          {TEXT_KEYS[id].map(([k, l], i) => (
            <Field key={k} label={l}>
              <input ref={i === 0 ? first : undefined} value={fields[k] || ""} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
        </div>
      )}
      {it.type === "text" && (
        <div style={sec}>
          <textarea ref={first} rows={3} value={it.text || ""} onChange={(e) => up({ text: e.target.value })} />
        </div>
      )}

      {(kind === "text" || kind === "contacts") && (
        <div style={sec}>
          {textStyleRows}
          {kind === "text" && link("Link (optional) https://…")}
          {kind === "contacts" && <p className="hint" style={{ margin: 0 }}>Each contact line keeps its own link — edit the values in the form below.</p>}
        </div>
      )}

      {kind === "button" && (
        <div style={sec}>
          <Field label="Button link"><input value={fields.ctau || ""} placeholder="https://…" onChange={(e) => set("ctau", e.target.value)} /></Field>
          <div style={row}>
            {fontSel}
            <NumF l="Aa" title="Font size" v={it.size ?? ""} min={9} max={24} on={(n) => up({ size: n })} />
            <NumF l="◜" title="Corner radius" v={it.radius ?? ""} min={0} max={30} on={(n) => up({ radius: n })} />
          </div>
          <div style={row}>
            <Tog on={it.bold !== false} title="Bold" onClick={() => up({ bold: it.bold === false ? undefined : false })}><Bold size={14} /></Tog>
            <Tog on={!!it.italic} title="Italic" onClick={() => up({ italic: !it.italic || undefined })}><Italic size={14} /></Tog>
          </div>
          {col("bg", accent, "Button colour")}
          {col("color", "#ffffff", "Text colour")}
        </div>
      )}

      {kind === "social" && (
        <div style={sec}>
          <div className="seg">
            {[["icons", "Icons"], ["text", "Text only"]].map(([k, l]) => (
              <button type="button" key={k} className={(fields.iconStyle || "icons") === k ? "on" : ""} onClick={() => set("iconStyle", k)}>{l}</button>
            ))}
          </div>
          <label style={row}><span style={{ fontSize: 12 }}>Icon size</span><input type="range" min="16" max="48" value={fields.socialIconSize || 28} onChange={(e) => set("socialIconSize", Number(e.target.value))} /></label>
          <p className="hint" style={{ margin: 0 }}>Edit the profile links in the form below.</p>
        </div>
      )}

      {kind === "pic" && (
        <div style={sec}>
          <div className="seg">
            {[["photo", "Photo"], ["logo", "Logo"]].map(([k, l]) => (
              <button type="button" key={k} className={(fields.mode || "logo") === k ? "on" : ""} onClick={() => set("mode", k)}>{l}</button>
            ))}
          </div>
          <div className="seg">
            {[["circle", "Circle"], ["round", "Rounded"], ["square", "Square"]].map(([k, l]) => (
              <button type="button" key={k} className={it.shape === k ? "on" : ""} onClick={() => up({ shape: it.shape === k ? undefined : k })}>{l}</button>
            ))}
          </div>
          {fields.mode === "photo" && <ImageField label="Change photo" hint="A square photo is cropped automatically." value={fields.photo} onChange={(v) => set("photo", v)} max={240} square />}
          {(fields.mode || "logo") === "logo" && (
            <>
              <div style={row}>
                <input value={fields.logoLetter || ""} maxLength={2} placeholder="Letter" style={{ width: 70 }} onChange={(e) => set("logoLetter", e.target.value)} />
                {fontSel}
              </div>
              {col("bg", accent, "Background")}
              {col("color", "#ffffff", "Letter colour")}
            </>
          )}
          <label style={row}><span style={{ fontSize: 12 }}>Size</span><input type="range" min="24" max="240" value={fields.imageSize || 88} onChange={(e) => set("imageSize", Number(e.target.value))} /></label>
          {link("Link when clicked (optional)")}
        </div>
      )}

      {kind === "image" && (
        <div style={sec}>
          <ImageField label="Replace image" hint="" value={it.src} onChange={(v) => up({ src: v })} max={480} />
          <div style={row}>
            <div className="seg">
              {[["cover", "Fill"], ["contain", "Fit"]].map(([k, l]) => (
                <button type="button" key={k} className={(it.fit || "cover") === k ? "on" : ""} onClick={() => up({ fit: k })}>{l}</button>
              ))}
            </div>
            <NumF l="◜" title="Corner radius" v={it.radius ?? ""} min={0} max={999} on={(n) => up({ radius: n })} />
          </div>
          {link("Link when clicked (optional)")}
        </div>
      )}

      {kind === "rect" && (
        <div style={sec}>
          {col("bg", rectBg({}, id, accent), "Fill colour")}
          <NumF l="◜" title="Corner radius" v={it.radius ?? ""} min={0} max={999} on={(n) => up({ radius: n })} />
        </div>
      )}

      <div style={{ ...sec, ...row }}>
        <button type="button" className="btn" onClick={() => resetItemStyle(id)}><RotateCcw size={14} /> Reset style</button>
        {!BUILTIN.includes(id) && <button type="button" className="btn" title="Duplicate (Ctrl+D)" onClick={() => dupItem(id)}><Copy size={14} /></button>}
        <button type="button" className="btn" title={BUILTIN.includes(id) ? "Hide (restore it from the canvas panel)" : "Delete"} onClick={() => removeItem(id)}><Trash2 size={14} /></button>
      </div>
    </>
  );
}

export default function SignatureBuilder({ initial, onSaved, onCancel }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name || "");
  const [templateId] = useState("hamim-signature");
  const [fields, setFields] = useState({
    accent: "#2563eb",
    mode: "logo",
    imageSize: 88,
    socialIconSize: 28,
    iconStyle: "icons",
    logoLetter: "",
    ...adaptSignatureFields(initial?.fields || {}),
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));
  const [sel, setSel] = useState(null); // selected item on the design canvas
  const real = { accent: "#2563eb", ...clean(fields) };
  // ---- free layout helpers (fields.layout.items[id] = { x, y, w, h, ...style }) ----
  const tidy = (o) => {
    Object.keys(o).forEach((k) => (o[k] === undefined || o[k] === "") && delete o[k]);
    return o;
  };
  const patchItems = (map) =>
    setFields((f) => {
      const items = { ...((f.layout && f.layout.items) || {}) };
      Object.entries(map).forEach(([id, p]) => (items[id] = tidy({ ...(items[id] || {}), ...p })));
      return { ...f, layout: { ...(f.layout || {}), items } };
    });
  const patchItem = (id, p) => patchItems({ [id]: p });
  const removeItem = (id) =>
    setFields((f) => {
      const items = { ...f.layout.items };
      if (BUILTIN.includes(id)) items[id] = { ...items[id], hidden: true };
      else delete items[id];
      return { ...f, layout: { ...f.layout, items } };
    });
  const restoreItem = (id) => patchItem(id, { hidden: undefined });
  const resetItemStyle = (id) =>
    setFields((f) => {
      const keep = ["x", "y", "w", "h", "type", "text", "src", "hidden"], cur = f.layout.items[id] || {};
      const items = { ...f.layout.items, [id]: Object.fromEntries(Object.entries(cur).filter(([k]) => keep.includes(k))) };
      return { ...f, layout: { ...f.layout, items } };
    });
  const addItem = (it) => {
    const id = `${it.type[0]}${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
    patchItem(id, it);
    return id;
  };
  const reseed = () => {
    const L = seedLayout({ ...real, styles: undefined });
    if (L) {
      setFields((f) => ({ ...f, layout: L, styles: undefined }));
      setSel(null);
    }
  };
  // first time (or an old signature): build the free layout from the classic one
  useLayoutEffect(() => {
    if (fields.layout) return;
    const L = seedLayout(real);
    if (L) setFields((f) => (f.layout ? f : { ...f, layout: L }));
  }, []);
  // undo / redo of every change in the editor (changes made within 0.6 s count as one step)
  const hist = useRef({ past: [], future: [], last: Date.now(), skip: false, cur: null });
  useEffect(() => {
    const h = hist.current;
    if (h.skip) { h.skip = false; h.cur = fields; return; }
    if (h.cur && h.cur !== fields) {
      const now = Date.now();
      if (now - h.last > 600) { h.past.push(h.cur); if (h.past.length > 80) h.past.shift(); }
      h.last = now;
      h.future = [];
    }
    h.cur = fields;
  }, [fields]);
  const undo = () => { const h = hist.current, p = h.past.pop(); if (p) { h.future.push(fields); h.skip = true; setFields(p); } };
  const redo = () => { const h = hist.current, n = h.future.pop(); if (n) { h.past.push(fields); h.skip = true; setFields(n); } };
  const parts = fields.layout ? SIGNATURES[0].build(real, { parts: true }).parts : {};
  const save = async () => {
    if (!name.trim()) return toast("Give this signature a name", "err");
    if (!real.name) return toast("Enter your full name", "err");
    setBusy(true);
    try {
      const t = SIGNATURES.find((x) => x.id === templateId) || SIGNATURES[0];
      const r = await api.post("/api/signatures", {
        id: initial?.id,
        name: name.trim(),
        templateId,
        fields,
        html: t.build(real),
        css: "",
      });
      toast("Signature saved");
      onSaved(r);
    } catch (e) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sig-builder">
      <div className="sig-intro">
        <strong>Hamim’s signature style</strong>
        <span className="muted small">
          Update the details and preview your email-safe signature as you go.
        </span>
      </div>
      <div className="form-grid">
        <Field label="Signature name *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Work signature"
          />
        </Field>
        <Field label="Accent colour">
          <div className="sig-colors">
            {[
              "#2563eb",
              "#4f46e5",
              "#7c3aed",
              "#db2777",
              "#e11d48",
              "#ea580c",
              "#ca8a04",
              "#16a34a",
              "#0d9488",
              "#0891b2",
              "#334155",
            ].map((c) => (
              <button
                type="button"
                aria-label={`Use ${c}`}
                title={c}
                key={c}
                onClick={() => set("accent", c)}
                style={{
                  background: c,
                  outline:
                    (fields.accent || "#2563eb") === c
                      ? "2px solid var(--accent,#4f46e5)"
                      : "none",
                }}
              />
            ))}
            <input
              type="color"
              value={fields.accent || "#2563eb"}
              onChange={(e) => set("accent", e.target.value)}
            />
          </div>
        </Field>
      </div>
      <div className="sig-modebar">
        <strong>Image style</strong>
        <div className="seg">
          {[
            ["photo", "Photo"],
            ["logo", "Logo"],
            ["none", "Text only"],
          ].map(([k, l]) => (
            <button
              type="button"
              key={k}
              className={(fields.mode || "logo") === k ? "on" : ""}
              onClick={() => set("mode", k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {fields.mode === "logo" && (
        <Field
          label="Logo letter"
          hint="Leave empty to use the first letter of your name. You can type 1–2 characters."
        >
          <input
            value={fields.logoLetter || ""}
            maxLength={2}
            onChange={(e) => set("logoLetter", e.target.value)}
            placeholder={(fields.name || "H").trim().charAt(0).toUpperCase() || "H"}
            style={{ maxWidth: 90 }}
          />
        </Field>
      )}
      <div className="sig-modebar">
        <strong>Contact &amp; social links</strong>
        <div className="seg">
          {[
            ["icons", "Icons"],
            ["text", "Text only"],
          ].map(([k, l]) => (
            <button
              type="button"
              key={k}
              className={(fields.iconStyle || "icons") === k ? "on" : ""}
              onClick={() => set("iconStyle", k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {fields.mode !== "none" && (
        <Field label={fields.mode === "photo" ? "Photo size" : "Logo size"}>
          <input
            type="range"
            min="24"
            max="240"
            value={fields.imageSize || 88}
            onChange={(e) => set("imageSize", Number(e.target.value))}
          />
        </Field>
      )}
      <Field label="Social icon size">
        <input
          type="range"
          min="16"
          max="48"
          value={fields.socialIconSize || 28}
          onChange={(e) => set("socialIconSize", Number(e.target.value))}
        />
      </Field>
      {fields.mode === "photo" && (
        <ImageField
          label="Profile photo"
          hint="A square photo is cropped automatically."
          value={fields.photo}
          onChange={(v) => set("photo", v)}
          max={240}
          square
        />
      )}
      <div className="form-grid">
        {TEXT.map(([k, l]) => (
          k === "wcl" ? (
            <div key={k}>
              <Field label={l}>
                <input
                  value={fields[k] || ""}
                  onChange={(e) => set(k, e.target.value)}
                  placeholder={SAMPLE[k] || "https://weixin.qq.com/..."}
                />
              </Field>
              <WeChatQrField value={fields.wcl} onChange={(v) => set("wcl", v)} />
            </div>
          ) : (
            <Field key={k} label={l}>
              <input
                value={fields[k] || ""}
                onChange={(e) => set(k, e.target.value)}
                placeholder={SAMPLE[k] || ""}
              />
            </Field>
          )
        ))}
      </div>
      <div>
        <strong>Design your signature</strong>{" "}
        <span className="muted small">drag anything to place it · drag the handles to resize · double-click text to type</span>
        {fields.layout ? (
          <SigStage
            fields={fields}
            parts={parts}
            accent={real.accent}
            sel={sel}
            setSel={setSel}
            patchItem={patchItem}
            patchItems={patchItems}
            removeItem={removeItem}
            restoreItem={restoreItem}
            resetItemStyle={resetItemStyle}
            addItem={addItem}
            set={set}
            undo={undo}
            redo={redo}
            reseed={reseed}
          />
        ) : (
          <p className="hint">Preparing the editor…</p>
        )}
        <strong style={{ display: "block", marginTop: 14 }}>Email result</strong>
        <span className="muted small">this is what your recipients receive</span>
        <div
          className="sig-preview"
          onClick={(e) => e.preventDefault()}
          dangerouslySetInnerHTML={{ __html: SIGNATURES[0].build(real) }}
        />
      </div>
      <div className="sig-actions">
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={save}
        >
          <Save size={14} />{" "}
          {initial?.id ? "Update signature" : "Save signature"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
