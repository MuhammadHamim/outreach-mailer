// Adapted from Hamim's supplied signature HTML. Uses inline styles and tables
// so the result remains dependable in Gmail, Outlook, and Apple Mail.
import {
  faFacebook,
  faGithub,
  faInstagram,
  faLinkedin,
  faTelegram,
  faWhatsapp,
  faWeixin,
  faXTwitter,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";

export const SAMPLE = {
  name: "Your Name", title: "Your title", org: "Organization", field: "Department or field",
  email: "you@example.com", phone: "+1 555 123 4567", wcid: "", wcl: "", web: "example.com", loc: "",
  li: "linkedin.com/in/you", gh: "", wa: "", tg: "", x: "", ig: "", fb: "", yt: "",
  cta: "", ctau: "", tag: "", accent: "#2563eb", photo: "", mode: "logo",
};
const esc = (s = "") => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const href = (s="") => /^(https?:|mailto:|tel:)/i.test(String(s).trim()) ? String(s).trim() : `https://${String(s).trim()}`;
const brandIcons = {
  li: [faLinkedin, "#0a66c2"],
  gh: [faGithub, "#24292f"],
  wc: [faWeixin, "#07c160"],
  wa: [faWhatsapp, "#25d366"],
  tg: [faTelegram, "#229ed9"],
  x: [faXTwitter, "#111827"],
  ig: [faInstagram, "#c13584"],
  fb: [faFacebook, "#1877f2"],
  yt: [faYoutube, "#ff0000"],
};

const brandIconHtml = (id, label, url, height = 28) => {
  const [, color] = brandIcons[id] || [null, "#64748b"];
  const padded = 8;
  const badge = `<table cellpadding="0" cellspacing="0" border="0"><tr><td height="${height}" align="center" valign="middle" bgcolor="${color}" style="height:${height}px;padding:0 ${padded}px;border-radius:999px;color:#fff;font:700 11px Arial,sans-serif;white-space:nowrap">${esc(label)}</td></tr></table>`;
  return `<td style="padding-right:6px">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">${badge}</a>` : badge}</td>`;
};
const line = (symbol, value, url, accent) => {
  if (!value) return "";
  const badge = `<table cellpadding="0" cellspacing="0" border="0"><tr><td width="18" height="18" align="center" valign="middle" bgcolor="${accent}" style="width:18px;height:18px;border-radius:50%;color:#fff;font:700 9px Arial,sans-serif">${esc(symbol)}</td></tr></table>`;
  return `<tr><td width="26" style="padding:4px 8px 4px 0;line-height:18px">${badge}</td><td style="padding:4px 0;font:13px/1.4 'Segoe UI',Arial,sans-serif;color:#1e293b">${url ? `<a href="${esc(href(url))}" style="color:#1e293b;text-decoration:none">${esc(value)}</a>` : esc(value)}</td></tr>`;
};
export const SIGNATURES = [{
  id: "hamim-signature", name: "Hamim's signature", purpose: "Supplied style",
  build: (f = {}) => {
    const a = /^#[\da-f]{6}$/i.test(f.accent || "") ? f.accent : "#2563eb";
    const n = esc(f.name || ""), initials = esc((f.name || "H").trim().charAt(0).toUpperCase());
    const imageSize = Math.max(56, Math.min(112, Number(f.imageSize) || 88));
    const socialSize = Math.max(24, Math.min(36, Number(f.socialIconSize) || 28));
    const avatar = f.mode === "photo" && f.photo
      ? `<img src="${esc(f.photo)}" width="${imageSize}" height="${imageSize}" alt="${n}" style="display:block;width:${imageSize}px;height:${imageSize}px;border-radius:50%;border:3px solid ${a};object-fit:cover">`
      : f.mode === "logo"
        ? `<table cellpadding="0" cellspacing="0" border="0"><tr><td width="${imageSize}" height="${imageSize}" align="center" valign="middle" bgcolor="${a}" style="width:${imageSize}px;height:${imageSize}px;border-radius:20px;font:700 ${Math.round(imageSize * 0.475)}px 'Segoe UI',Arial,sans-serif;color:#fff">${initials}</td></tr></table>`
        : "";
    const identity = `<td valign="middle" style="width:270px"><div style="font:700 26px/1.1 'Segoe UI',Arial,sans-serif;color:#0f172a;letter-spacing:-.6px;white-space:nowrap">${n}</div>${f.title ? `<div style="font:700 13px 'Segoe UI',Arial,sans-serif;color:${a};margin-top:6px">${esc(f.title)}</div>` : ""}${f.org || f.field ? `<div style="font:12px/1.45 'Segoe UI',Arial,sans-serif;color:#475569;margin-top:3px">${esc(f.org || "")}${f.org && f.field ? "<br>" : ""}${esc(f.field || "")}</div>` : ""}</td>`;
    const contacts = [line("@",""+ (f.email||""),f.email ? `mailto:${f.email}` : "",a),line("T",f.phone,`tel:${(f.phone||"").replace(/\s/g,"")}`,a),line("W",f.wcid ? `WeChat: ${f.wcid}` : "",f.wcl,a),line("G",f.web,f.web,a),line("L",f.loc,"",a)].join("");
    const username = (value) => String(value || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?/i, "").replace(/^([a-z]+\.(com|org|net)\/)/i, "").replace(/\/$/, "");
    const socialLinks = [
      ["li", "LinkedIn", username(f.li) ? `https://www.linkedin.com/in/${encodeURIComponent(username(f.li))}` : ""],
      ["gh", "GitHub", username(f.gh) ? `https://github.com/${encodeURIComponent(username(f.gh))}` : ""],
      ["wc", "WeChat", f.wcl || ""],
      ["wa", "WhatsApp", username(f.wa) ? `https://wa.me/${encodeURIComponent(username(f.wa).replace(/[^0-9]/g, ""))}` : ""],
      ["tg", "Telegram", username(f.tg) ? `https://t.me/${encodeURIComponent(username(f.tg))}` : ""],
      ["x", "X", username(f.x) ? `https://x.com/${encodeURIComponent(username(f.x))}` : ""],
      ["ig", "Instagram", username(f.ig) ? `https://instagram.com/${encodeURIComponent(username(f.ig))}` : ""],
      ["fb", "Facebook", username(f.fb) ? `https://facebook.com/${encodeURIComponent(username(f.fb))}` : ""],
      ["yt", "YouTube", username(f.yt) ? `https://youtube.com/@${encodeURIComponent(username(f.yt))}` : ""],
    ];
    const socials = socialLinks.filter(([id, label, url]) => url).map(([id, label, url]) => brandIconHtml(id, label, url, socialSize)).join("");
    const cta = f.cta && f.ctau ? `<a href="${esc(href(f.ctau))}" style="display:inline-block;background:${a};color:#fff;font:700 12px 'Segoe UI',Arial,sans-serif;padding:8px 14px;border-radius:7px;text-decoration:none">${esc(f.cta)}</a>` : "";
    const socialRow = socials ? `<table cellpadding="0" cellspacing="0" border="0"><tr>${socials}</tr></table>` : "";
    const footer = socials || cta ? `<tr><td colspan="2" style="padding-top:14px"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-left:${f.mode === "none" ? "0" : `${imageSize + 16}px`}\">${socialRow}</td><td align="right">${cta}</td></tr></table></td></tr>` : "";
    const avatarCell = avatar ? `<td valign="middle" style="padding-right:16px">${avatar}</td>` : "";
    const topRule = `<tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px"><tr><td width="72" height="4" bgcolor="${a}" style="font-size:0;line-height:0">&nbsp;</td><td height="1" bgcolor="#e2e8f0" style="font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
    return `<table width="640" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:640px;font-family:'Segoe UI',Arial,Helvetica,sans-serif">${topRule}<tr><td valign="middle" style="padding-right:26px"><table cellpadding="0" cellspacing="0" border="0"><tr>${avatarCell}${identity}</tr></table></td>${contacts ? `<td width="220" valign="middle" style="border-left:3px solid ${a};padding-left:26px"><table cellpadding="0" cellspacing="0" border="0">${contacts}</table></td>` : ""}</tr>${footer}${f.tag ? `<tr><td colspan="2"><div style="font:11px 'Segoe UI',Arial,sans-serif;color:#64748b;margin-top:8px;letter-spacing:.4px">${esc(f.tag)}</div></td></tr>` : ""}</table>`;
  },
}];
export const adaptSignatureFields = (fields = {}) => ({
  ...fields,
  org: fields.org || fields.company || "",
  field: fields.field || fields.tagline || "",
  web: fields.web || fields.website || "",
  li: fields.li || fields.linkedin || "",
  cta: fields.cta || fields.ctaText || "",
  ctau: fields.ctau || fields.ctaUrl || "",
  photo: fields.photo || fields.photoUrl || "",
  accent: fields.accent || "#2563eb",
  mode: fields.mode || (fields.photo || fields.photoUrl ? "photo" : "logo"),
});
export const adaptSignature = (signature) => {
  const fields = adaptSignatureFields(signature?.fields || {});
  if (signature?.name && !fields.name) fields.name = signature.name;
  return { ...signature, fields, templateId: "hamim-signature", html: SIGNATURES[0].build(fields), css: "" };
};
