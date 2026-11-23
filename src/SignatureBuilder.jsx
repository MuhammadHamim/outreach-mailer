import { useRef, useState } from "react";
import { Save, X, Upload, Trash2, QrCode } from "lucide-react";
import jsQR from "jsqr";
import { api } from "./api";
import { Field, useToast } from "./ui";
import { SIGNATURES, SAMPLE, adaptSignatureFields } from "./signatureTemplates";
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
      let result = null;
      const scales = [1, 1.5, 2, 0.75];
      for (const multiplier of scales) {
        if (result) break;
        const width = Math.min(2400, Math.round(image.naturalWidth * multiplier));
        const height = Math.min(2400, Math.round(image.naturalHeight * multiplier));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height);
        result = jsQR(pixels.data, width, height, { inversionAttempts: "attemptBoth" });

        if (!result && "BarcodeDetector" in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
            const detected = await detector.detect(canvas);
            if (detected[0]?.rawValue) result = { data: detected[0].rawValue };
          } catch {
            // jsQR remains the fallback for this image.
          }
        }
      }
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
  const real = { accent: "#2563eb", ...clean(fields) };
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
            min="56"
            max="112"
            value={fields.imageSize || 88}
            onChange={(e) => set("imageSize", Number(e.target.value))}
          />
        </Field>
      )}
      <Field label="Social icon size">
        <input
          type="range"
          min="20"
          max="36"
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
        <strong>Signature preview</strong>
        <div
          className="sig-preview"
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
