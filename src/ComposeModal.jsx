import { useEffect, useRef, useState } from "react"; // CHANGED: + useRef
import { Clock, Paperclip, Save, Send, UploadCloud } from "lucide-react"; // CHANGED: + Paperclip, UploadCloud
import { api } from "./api";
import { Field, Modal, useToast } from "./ui";
import RichEditor from "./RichEditor"; // NEW
import SignaturePicker from "./SignaturePicker"; // NEW

const pad = (n) => String(n).padStart(2, "0");
const localInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const when = (ms) => (ms ? new Date(ms).toLocaleString() : "—");
const fmtSize = (n) =>
  n > 1e6
    ? `${(n / 1e6).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1e3))} KB`; // NEW

export default function ComposeModal({ docs = [], onClose, onDone }) {
  const [to, setTo] = useState(""),
    [toName, setToName] = useState(""),
    [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(""),
    [bodyText, setBodyText] = useState(""); // CHANGED: replaces `body`
  const [sig, setSig] = useState(null); // NEW: { id, html } | null
  const [extra, setExtra] = useState([]),
    [uploading, setUploading] = useState(false),
    [drag, setDrag] = useState(false); // NEW
  const fileRef = useRef(); // NEW
  const [attach, setAttach] = useState(new Set()),
    [mode, setMode] = useState("now"),
    [at, setAt] = useState(localInput(new Date(Date.now() + 3600e3)));
  const [prev, setPrev] = useState([]),
    [showPrev, setShowPrev] = useState(false),
    [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const key = to.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(key)) {
      setPrev([]);
      return;
    }
    const t = setTimeout(
      () =>
        api
          .post("/api/emails/check-duplicates", { addresses: [key] })
          .then((d) => setPrev(d[key] || []))
          .catch(() => {}),
      400,
    );
    return () => clearTimeout(t);
  }, [to]);

  // NEW: files uploaded from this window + the library, de-duplicated
  const allDocs = [
    ...docs,
    ...extra.filter((x) => !docs.some((d) => d.id === x.id)),
  ];
  const upload = async (files) => {
    setUploading(true);
    try {
      for (const f of files) {
        if (f.size > 10e6) {
          toast(`${f.name} is larger than 10 MB`, "err");
          continue;
        }
        const d = await api.put(
          `/api/documents?name=${encodeURIComponent(f.name)}`,
          f,
          { "x-file-type": f.type || "application/octet-stream" },
        );
        setExtra((s) => [...s, d]);
        setAttach((s) => new Set(s).add(d.id));
      }
    } catch (e) {
      toast(e.message, "err");
    } finally {
      setUploading(false);
    }
  };

  const sentBefore = prev.filter((d) => ["sent", "replied"].includes(d.status));
  const ready =
    /^\S+@\S+\.\S+$/.test(to.trim()) &&
    subject.trim() &&
    bodyText.trim() &&
    (mode !== "schedule" || at); // CHANGED: bodyText
  const go = async () => {
    setBusy(true);
    try {
      const signatureHtml = sig?.html || ""; // the server turns pictures into inline cid: images
      const html = `${bodyHtml}${signatureHtml ? `<br>${signatureHtml}` : ""}`; // NEW
      await api.post("/api/emails", {
        to,
        toName,
        subject,
        body: bodyText,
        html,
        css: sig?.css || "",
        attachments: [...attach],
        mode,
        sendAt: mode === "schedule" ? new Date(at).getTime() : undefined,
      }); // CHANGED: + html
      onDone(
        mode === "now"
          ? "Queued — sending now"
          : mode === "schedule"
            ? "Email scheduled"
            : "Draft saved",
      );
    } catch (e) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New email"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || uploading || !ready}
            onClick={go}
          >
            {mode === "draft" ? (
              <>
                <Save size={16} /> Save draft
              </>
            ) : mode === "schedule" ? (
              <>
                <Clock size={16} /> Schedule
              </>
            ) : (
              <>
                <Send size={16} /> {busy ? "Sending…" : "Send now"}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="To *">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com"
            autoFocus
          />
        </Field>
        <Field label="Recipient name (optional)">
          <input value={toName} onChange={(e) => setToName(e.target.value)} />
        </Field>
      </div>
      {sentBefore.length > 0 && (
        <div className="banner warn">
          <span>
            You already emailed this address on{" "}
            <b>{when(sentBefore[0].sentAt)}</b> (“{sentBefore[0].subject}”).{" "}
            <button className="linkbtn" onClick={() => setShowPrev(!showPrev)}>
              {showPrev ? "Hide" : "View what you sent"}
            </button>
          </span>
        </div>
      )}
      {showPrev &&
        sentBefore.map((d) => (
          <div key={d.id} className="preview">
            <div className="small muted">
              {when(d.sentAt)} · {d.status}
            </div>
            <strong>{d.subject}</strong>
            <pre>{d.body}</pre>
          </div>
        ))}
      <Field label="Subject *">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>

      {/* CHANGED: textarea -> rich editor */}
      <Field label="Message *">
        <RichEditor
          onChange={(h, t) => {
            setBodyHtml(h);
            setBodyText(t);
          }}
        />
      </Field>

      {/* NEW: signature */}
      <SignaturePicker sig={sig} onChange={setSig} />

      {/* CHANGED: attachments (library + upload here) */}
      <h4>Attachments</h4>
      {!allDocs.length ? (
        <p className="muted small">No documents yet. Upload one below.</p>
      ) : (
        <div className="chips">
          {allDocs.map((d) => (
            <label
              key={d.id}
              className={`chip ${attach.has(d.id) ? "on" : ""}`}
              title={d.size ? fmtSize(d.size) : ""}
            >
              <input
                type="checkbox"
                hidden
                checked={attach.has(d.id)}
                onChange={() =>
                  setAttach((s) => {
                    const n = new Set(s);
                    n.has(d.id) ? n.delete(d.id) : n.add(d.id);
                    return n;
                  })
                }
              />
              {d.name}
            </label>
          ))}
        </div>
      )}
      <div
        className={`att-drop ${drag ? "over" : ""}`}
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload([...e.dataTransfer.files]);
        }}
      >
        {uploading ? <UploadCloud size={18} /> : <Paperclip size={18} />}
        <span>
          {uploading
            ? "Uploading…"
            : "Attach a file from your computer (or drop it here). It is also saved to Documents. Max 10 MB."}
        </span>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            upload([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>

      <h4>When</h4>
      <div className="seg">
        {[
          ["now", "Send now"],
          ["schedule", "Schedule"],
          ["draft", "Save as draft"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={mode === k ? "on" : ""}
            onClick={() => setMode(k)}
          >
            {l}
          </button>
        ))}
      </div>
      {mode === "schedule" && (
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}
      {mode === "schedule" && (
        <p className="hint">Uses your computer's local time.</p>
      )}
    </Modal>
  );
}
