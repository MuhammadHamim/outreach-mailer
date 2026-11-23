import { useRef, useState } from "react";
import { ClipboardCopy, Code2, Download, FileText, HelpCircle } from "lucide-react";
import { useToast } from "./ui";
import { SIGNATURES, iconPack, signaturePlain } from "./signatureTemplates";

// Lets the user paste the signature into Gmail / Outlook / QQ / 163 / any webmail.
// `signature` = result of adaptSignature(): { name, fields, html }
export default function SignatureCopy({ signature }) {
  const toast = useToast();
  const box = useRef(null);
  const [help, setHelp] = useState(false);
  const html = signature.html || "";
  const hosted = !!String(signature.fields?.iconBase || "").trim();

  // Rich copy: put the signature on the page and copy the selection, exactly like pressing Ctrl+C on it.
  // Mail editors then receive real formatted HTML (tables, colours, links) instead of a picture.
  const copyRich = async (h = html, msg = "Signature copied. Paste it into your email (Ctrl+V).") => {
    try {
      box.current.innerHTML = h;
      const r = document.createRange();
      r.selectNodeContents(box.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { /* fall through */ }
      sel.removeAllRanges();
      if (!ok && navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([h], { type: "text/html" }),
            "text/plain": new Blob([signaturePlain(signature.fields)], { type: "text/plain" }),
          }),
        ]);
        ok = true;
      }
      if (!ok) throw new Error("copy blocked");
      toast(msg);
    } catch {
      toast("Your browser blocked copying. Use “Copy HTML” instead.", "err");
    }
  };
  // Same signature with text labels (Email, LinkedIn, GitHub…) instead of icons, for webmail that drops images
  const textOnlyHtml = () => SIGNATURES[0].build({ ...signature.fields, iconStyle: "text" });
  const copyText = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch {
      toast("Your browser blocked copying", "err");
    }
  };
  const downloadHtml = () => {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${signature.name || "Signature"}</title></head><body>${html}</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    a.download = `${(signature.name || "signature").replace(/[^\w-]+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const downloadIcons = () => {
    iconPack(signature.fields?.accent).forEach((ic, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = ic.src;
        a.download = `${ic.key}.png`;
        a.click();
      }, i * 150),
    );
  };

  return (
    <div className="sig-copy">
      <div className="sig-copy-btns">
        <button type="button" className="btn" onClick={() => copyRich()}>
          <ClipboardCopy size={14} /> Copy signature
        </button>
        <button type="button" className="btn" onClick={() => copyRich(textOnlyHtml(), "Text-only signature copied (no icons). Paste it into your email.")}>
          <ClipboardCopy size={14} /> Copy text-only (no icons)
        </button>
        <button type="button" className="btn" onClick={() => copyText(html, "HTML code copied")}>
          <Code2 size={14} /> Copy HTML
        </button>
        <button type="button" className="btn" onClick={() => copyText(signaturePlain(signature.fields), "Plain-text signature copied")}>
          <FileText size={14} /> Copy plain text
        </button>
        <button type="button" className="btn" onClick={() => setHelp((v) => !v)}>
          <HelpCircle size={14} /> How to use
        </button>
      </div>
      {/* hidden rendered copy used for the selection-based fallback */}
      <div ref={box} style={{ position: "fixed", left: -9999, top: 0, width: 700, background: "#fff", color: "#1e293b", colorScheme: "light" }} aria-hidden="true" />
      {help && (
        <div className="sig-help">
          <p>
            <b>Gmail / Outlook web / QQ / 163:</b> click <i>Copy signature</i>, open the
            signature settings (Gmail: Settings → See all settings → Signature; Outlook: Settings →
            Compose and reply; QQ/163: Settings → Signature), and paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>.
            Or paste it straight into a message body.
          </p>
          <p>
            <b>Icons not showing?</b> Gmail and some webmail remove pasted images. Fix: upload the
            icon PNGs to any public folder (your website, GitHub Pages, an image host), put that
            folder’s address in <i>Icon base URL</i> when you edit the signature, then copy again.
          </p>
          <div className="sig-help-row">
            <button type="button" className="btn small" onClick={downloadIcons}>
              <Download size={13} /> Download the 13 icons
            </button>
            <button type="button" className="btn small" onClick={downloadHtml}>
              <Download size={13} /> Download signature .html
            </button>
            <span className="muted small">
              {hosted ? "Icon base URL is set — icons load from your server." : "Icon base URL is empty — icons are embedded."}
            </span>
          </div>
          <p className="muted small">
            Outlook desktop: save the .html into <code>%appdata%\Microsoft\Signatures</code>, then pick it in File → Options → Mail → Signatures.
          </p>
        </div>
      )}
    </div>
  );
}
