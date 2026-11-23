// Hamim's signature. Table layout + inline styles + real PNG icons so it stays intact
// in Gmail, Outlook, QQ, 163 and Apple Mail. Matches the supplied "Hamim_s_email_signature.html".
export const SAMPLE = {
  name: "Your Name", title: "Your title", org: "Organization", field: "Department or field",
  email: "you@example.com", phone: "+1 555 123 4567", wcid: "", wcl: "", web: "example.com", loc: "",
  li: "linkedin.com/in/you", gh: "", wa: "", tg: "", x: "", ig: "", fb: "", yt: "",
  cta: "", ctau: "", tag: "", accent: "#2563eb", photo: "", mode: "logo", iconBase: "", logoLetter: "", iconStyle: "icons",
};
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const href = (s = "") => (/^(https?:|mailto:|tel:)/i.test(String(s).trim()) ? String(s).trim() : `https://${String(s).trim()}`);

const W = "#fff";
function disc(x, c) { x.fillStyle = c; x.beginPath(); x.arc(48, 48, 48, 0, 7); x.fill(); }
const GL = {
mail:(x) =>{x.lineWidth=5;x.strokeRect(25,31,46,34);x.beginPath();x.moveTo(26,33);x.lineTo(48,51);x.lineTo(70,33);x.stroke()},
phone:(x) =>{x.lineWidth=5;x.strokeRect(35,22,26,52);x.beginPath();x.arc(48,66,2.5,0,7);x.fill()},
globe:(x) =>{x.lineWidth=5;x.beginPath();x.arc(48,48,24,0,7);x.stroke();x.beginPath();x.ellipse(48,48,10,24,0,0,7);x.stroke();x.beginPath();x.moveTo(24,48);x.lineTo(72,48);x.stroke()},
pin:(x, a) =>{x.beginPath();x.moveTo(48,76);x.bezierCurveTo(30,56,28,48,28,40);x.arc(48,40,20,Math.PI,0);x.bezierCurveTo(68,48,66,56,48,76);x.fill();x.fillStyle=a;x.beginPath();x.arc(48,40,7,0,7);x.fill()}
};
const P = {"li":["0A66C2","M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"],"gh":["181717","M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"],"wc":["07C160","M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"],"wa":["25D366","M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"],"tg":["26A5E4","M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"],"x":["000000","M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"],"ig":["E4405F","M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"],"fb":["0866FF","M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"],"yt":["FF0000","M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"]};
const BR = {};
Object.keys(P).forEach((k) => {
  BR[k] = (x) => {
    if (k === "ig") {
      const g = x.createLinearGradient(0, 96, 96, 0);
      g.addColorStop(0, "#FEDA75"); g.addColorStop(0.25, "#FA7E1E"); g.addColorStop(0.5, "#D62976"); g.addColorStop(0.75, "#962FBF"); g.addColorStop(1, "#4F5BD5");
      x.fillStyle = g;
    } else x.fillStyle = "#" + P[k][0];
    x.save(); x.scale(4, 4); x.fill(new Path2D(P[k][1])); x.restore();
  };
});
export const ICON_LABELS = { li: "LinkedIn", gh: "GitHub", wc: "WeChat", wa: "WhatsApp", tg: "Telegram", x: "X", ig: "Instagram", fb: "Facebook", yt: "YouTube", mail: "Email", phone: "Phone", globe: "Website", pin: "Location" };
const cache = {};
export function iconPng(name, accent = "#2563eb") {
  const key = name + (GL[name] ? accent : "");
  if (cache[key]) return cache[key];
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const x = c.getContext("2d");
  x.lineCap = x.lineJoin = "round";
  if (GL[name]) { disc(x, accent); x.fillStyle = x.strokeStyle = W; GL[name](x, accent); } else BR[name](x);
  return (cache[key] = c.toDataURL("image/png"));
}
// All 13 icons as { key, label, src } - used by the "download icons" panel.
export const iconPack = (accent = "#2563eb") => Object.keys(ICON_LABELS).map((k) => ({ key: k, label: ICON_LABELS[k], src: iconPng(k, accent) }));

const HOSTS = {
  li: (h) => `https://www.linkedin.com/in/${h.replace(/^in\//, "")}`,
  gh: (h) => `https://github.com/${h}`, tg: (h) => `https://t.me/${h}`, x: (h) => `https://x.com/${h}`,
  ig: (h) => `https://instagram.com/${h}`, fb: (h) => `https://facebook.com/${h}`, yt: (h) => `https://youtube.com/@${h}`,
};
export const socialUrl = (id, value) => {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v) || /^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) return href(v);
  if (id === "wa") { const d = v.replace(/[^\d]/g, ""); return d ? `https://wa.me/${d}` : ""; }
  const h = v.replace(/^@/, "").split("/").map(encodeURIComponent).join("/");
  return HOSTS[id] ? HOSTS[id](h) : "";
};

const clamp = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Number(v) || d));
const FONT = "font-family:'Segoe UI',Arial,Helvetica,sans-serif;";

const TEXT_LABELS = { mail: "Email", phone: "Tel", wc: "WeChat", globe: "Web", pin: "Location" };

export const SIGNATURES = [{
  id: "hamim-signature", name: "Hamim's signature", purpose: "Supplied style",
  build: (f = {}) => {
    const a = /^#[\da-f]{6}$/i.test(f.accent || "") ? f.accent : "#2563eb";
    const n = String(f.name || "");
    const size = clamp(f.imageSize, 56, 112, 88), soc = clamp(f.socialIconSize, 20, 36, 28);
    const mode = f.mode === "photo" && !f.photo ? "logo" : f.mode || "logo";
    const textOnly = f.iconStyle === "text"; // text labels instead of icons (for webmail that blocks images)
    const base = String(f.iconBase || "").trim().replace(/\/+$/, "");
    const src = (name) => (base ? `${base}/${name}.png` : iconPng(name, a));
    const img = (name, s) => `<img src="${esc(src(name))}" width="${s}" height="${s}" alt="${ICON_LABELS[name]}" style="display:block;border:0;width:${s}px;height:${s}px;cursor:pointer;">`;

    // logo letter: the user's own choice (1-2 characters), otherwise the first letter of the name
    const custom = String(f.logoLetter || "").trim().slice(0, 2);
    const letter = (custom || n.trim()[0] || "H").toUpperCase();
    const letterSize = Math.round(size * (letter.length > 1 ? 0.36 : 0.475));

    let pic = "";
    if (mode === "photo")
      pic = `<td valign="middle" style="padding-right:16px;"><img src="${esc(f.photo)}" width="${size}" height="${size}" alt="${esc(n)}" style="display:block;width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${a};object-fit:cover;"></td>`;
    else if (mode === "logo")
      pic = `<td valign="middle" style="padding-right:16px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="${size}" height="${size}" align="center" valign="middle" bgcolor="${a}" style="width:${size}px;height:${size}px;border-radius:20px;${FONT}font-size:${letterSize}px;font-weight:700;color:#ffffff;">${esc(letter)}</td></tr></table></td>`;

    // name stays on ONE line (nowrap); the other lines wrap inside a 240px column
    const who = `<td valign="middle" width="240" style="width:240px;"><div style="${FONT}font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.6px;line-height:1.1;white-space:nowrap;">${esc(n)}</div>`
      + (f.title ? `<div style="${FONT}font-size:13px;font-weight:700;color:${a};margin-top:6px;">${esc(f.title)}</div>` : "")
      + (f.org || f.field ? `<div style="${FONT}font-size:12px;color:#475569;margin-top:3px;line-height:1.45;">${esc(f.org || "")}${f.org && f.field ? "<br>" : ""}${esc(f.field || "")}</div>` : "")
      + `</td>`;

    const row = (icon, text, url) => {
      const lead = textOnly
        ? `<td valign="middle" style="${FONT}font-size:11px;font-weight:700;color:${a};padding:4px 12px 4px 0;white-space:nowrap;">${TEXT_LABELS[icon]}</td>`
        : `<td valign="middle" style="padding:4px 10px 4px 0;">${img(icon, 18)}</td>`;
      return `<tr>${lead}<td valign="middle" style="${FONT}font-size:13px;color:#1e293b;padding:4px 0;">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:#1e293b;text-decoration:none;cursor:pointer;">${esc(text)}</a>` : esc(text)}</td></tr>`;
    };
    let rows = "";
    if (f.email) rows += row("mail", f.email, `mailto:${f.email}`);
    if (f.phone) rows += row("phone", f.phone, `tel:${String(f.phone).replace(/\s/g, "")}`);
    if (f.wcid) rows += row("wc", textOnly ? f.wcid : `WeChat: ${f.wcid}`, f.wcl ? href(f.wcl) : "");
    if (f.web) rows += row("globe", f.web, href(f.web));
    if (f.loc) rows += row("pin", f.loc);

    const links = { li: socialUrl("li", f.li), gh: socialUrl("gh", f.gh), wc: f.wcl ? href(f.wcl) : "", wa: socialUrl("wa", f.wa), tg: socialUrl("tg", f.tg), x: socialUrl("x", f.x), ig: socialUrl("ig", f.ig), fb: socialUrl("fb", f.fb), yt: socialUrl("yt", f.yt) };
    let s = "";
    Object.keys(links).forEach((k) => {
      const u = links[k];
      if (!(k === "wc" ? f.wcid || u : u)) return;
      const inner = textOnly
        ? `<span style="${FONT}font-size:12px;font-weight:700;color:${a};">${ICON_LABELS[k]}</span>`
        : img(k, soc);
      s += `<td valign="middle" style="padding-right:${textOnly ? 14 : 10}px;">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(ICON_LABELS[k])}" style="text-decoration:none;cursor:pointer;display:inline-block;">${inner}</a>` : inner}</td>`;
    });
    const cta = f.cta && f.ctau ? `<a href="${esc(href(f.ctau))}" style="display:inline-block;background:${a};color:#ffffff;${FONT}font-size:12px;font-weight:700;letter-spacing:0.3px;padding:9px 18px;border-radius:8px;text-decoration:none;cursor:pointer;">${esc(f.cta)}</a>` : "";

    // social links + button sit UNDER the name/title/organisation text (aligned with the text, not the logo)
    const off = mode === "none" ? 0 : size + 16;
    const under = (s || cta)
      ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr><td style="padding-left:${off}px;">`
        + (s ? `<table cellpadding="0" cellspacing="0" border="0"><tr>${s}</tr></table>` : "")
        + (cta ? `<div style="margin-top:${s ? 12 : 0}px;">${cta}</div>` : "")
        + `</td></tr></table>`
      : "";

    // the line goes on TOP, because the signature is the last thing in the email
    const bar = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;"><tr><td width="72" height="4" bgcolor="${a}" style="font-size:0;line-height:0;">&nbsp;</td><td height="1" bgcolor="#e2e8f0" style="font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

    // Explicit white card (bgcolor attribute + inline style, no transparency). Webmail dark modes (QQ, 163, Outlook.com)
    // paint their own dark background behind a transparent signature, which made the dark text unreadable.
    return `<table cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="${FONT}max-width:640px;background-color:#ffffff;color:#1e293b;color-scheme:light only;"><tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:4px 12px 12px 4px;">`
      + `<table cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="${FONT}max-width:640px;background-color:#ffffff;">`
      + `<tr><td colspan="2">${bar}</td></tr>`
      + `<tr><td valign="middle" style="padding-right:26px;"><table cellpadding="0" cellspacing="0" border="0"><tr>${pic}${who}</tr></table>${under}</td>`
      + (rows ? `<td valign="middle" style="border-left:3px solid ${a};padding-left:26px;"><table cellpadding="0" cellspacing="0" border="0">${rows}</table></td>` : "")
      + `</tr>`
      + (f.tag ? `<tr><td colspan="2"><div style="${FONT}font-size:11px;color:#64748b;margin-top:12px;letter-spacing:0.4px;">${esc(f.tag)}</div></td></tr>` : "")
      + `</table>`
      + `</td></tr></table>`;
  },
}];

export const signaturePlain = (f = {}) => {
  const t = [f.name, [f.title, f.org].filter(Boolean).join(", "), f.field, ""];
  [["Email", f.email], ["Phone", f.phone], ["WeChat ID", f.wcid], ["WeChat", f.wcl], ["Web", f.web], ["Location", f.loc],
   ["LinkedIn", socialUrl("li", f.li)], ["GitHub", socialUrl("gh", f.gh)], ["WhatsApp", socialUrl("wa", f.wa)], ["Telegram", socialUrl("tg", f.tg)],
   ["X", socialUrl("x", f.x)], ["Instagram", socialUrl("ig", f.ig)], ["Facebook", socialUrl("fb", f.fb)], ["YouTube", socialUrl("yt", f.yt)]]
    .forEach(([l, v]) => v && t.push(`${l}: ${v}`));
  return t.filter((x, i) => x || i === 3).join("\n").trim();
};

export const adaptSignatureFields = (fields = {}) => ({
  ...fields,
  org: fields.org || fields.company || "", field: fields.field || fields.tagline || "",
  web: fields.web || fields.website || "", li: fields.li || fields.linkedin || "",
  cta: fields.cta || fields.ctaText || "", ctau: fields.ctau || fields.ctaUrl || "",
  photo: fields.photo || fields.photoUrl || "", accent: fields.accent || "#2563eb",
  mode: fields.mode || (fields.photo || fields.photoUrl ? "photo" : "logo"),
});
export const adaptSignature = (signature) => {
  const fields = adaptSignatureFields(signature?.fields || {});
  if (signature?.name && !fields.name) fields.name = signature.name;
  return { ...signature, fields, templateId: "hamim-signature", html: SIGNATURES[0].build(fields), css: "" };
};
