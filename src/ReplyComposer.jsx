import { useRef, useState } from "react";
import { CornerUpLeft, Paperclip, UploadCloud } from "lucide-react";
import { api } from "./api";
import { fmtSize, useToast } from "./ui";
import RichEditor from "./RichEditor";
import SignaturePicker from "./SignaturePicker";

// Rich-text reply: same editor as "Compose", plus signature picker and attachments.
export default function ReplyComposer({ emailId, docs = [], onSent }) {
  const toast = useToast();
  const [bodyHtml, setBodyHtml] = useState(""),
    [bodyText, setBodyText] = useState("");
  const [sig, setSig] = useState(null);
  const [extra, setExtra] = useState([]),
    [attach, setAttach] = useState(new Set());
  const [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [editorKey, setEditorKey] = useState(0);
  const fileRef = useRef();
  const allDocs = [...docs, ...extra.filter((x) => !docs.some((d) => d.id === x.id))];

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

  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/api/emails/${emailId}/reply`, {
        text: bodyText,
        html: `${bodyHtml}${sig?.html ? `<br>${sig.html}` : ""}`,
        attachments: [...attach],
      });
      setBodyHtml("");
      setBodyText("");
      setAttach(new Set());
      setEditorKey((k) => k + 1); // clears the editor
      toast("Reply sent");
      await onSent?.();
    } catch (e) {
      toast(e.message, "err");
    }
    setBusy(false);
  };

  return (
    <div className="composer reply-composer">
      <RichEditor
        key={editorKey}
        minHeight={140}
        onChange={(h, t) => {
          setBodyHtml(h);
          setBodyText(t);
        }}
      />
      <SignaturePicker sig={sig} onChange={setSig} />
      <h4>Attachments</h4>
      {allDocs.length > 0 && (
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
        className="att-drop"
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload([...e.dataTransfer.files]);
        }}
      >
        {uploading ? <UploadCloud size={18} /> : <Paperclip size={18} />}
        <span>
          {uploading ? "Uploading…" : "Attach a file (or drop it here). Max 10 MB."}
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
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button
          className="btn primary"
          disabled={busy || uploading || !bodyText.trim()}
          onClick={send}
        >
          <CornerUpLeft size={16} /> {busy ? "Sending…" : "Send reply"}
        </button>
      </div>
    </div>
  );
}
