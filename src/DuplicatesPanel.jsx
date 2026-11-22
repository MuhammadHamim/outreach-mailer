import { useState } from "react";
import { Modal } from "./ui.jsx";

const SENT = ["sent", "replied"];
const when = (ms) => (ms ? new Date(ms).toLocaleString() : "—");

export default function DuplicatesPanel({ dups, resend, onToggle, onAll }) {
  const [view, setView] = useState(null);
  const keys = Object.keys(dups || {});
  if (!keys.length) return null;
  const sentKeys = keys.filter((k) =>
    dups[k].some((d) => SENT.includes(d.status)),
  );

  return (
    <div style={{ margin: "12px 0" }}>
      <div className="banner warn">
        <span>
          <b>{keys.length}</b> address{keys.length > 1 ? "es" : ""} in this file
          already exist in the app
          {sentKeys.length > 0 && (
            <>
              {" "}
              — <b>{sentKeys.length}</b> already emailed. Those are skipped
              unless you tick “Send again”.
            </>
          )}
        </span>
      </div>
      {sentKeys.length > 1 && (
        <div className="btn-row" style={{ margin: "8px 0" }}>
          <button className="btn small" onClick={() => onAll(sentKeys, true)}>
            Send again to all
          </button>
          <button className="btn small" onClick={() => onAll(sentKeys, false)}>
            Skip all
          </button>
        </div>
      )}
      <ul className="list">
        {keys.map((k) => {
          const last = dups[k][0],
            wasSent = SENT.includes(last.status);
          return (
            <li key={k}>
              <div>
                <strong>{k}</strong>
                <div className="muted small">
                  {wasSent
                    ? `Sent ${when(last.sentAt)}`
                    : `In app as ${last.status}`}{" "}
                  · {dups[k].length} email{dups[k].length > 1 ? "s" : ""}
                  {last.status === "replied" && " · they replied"}
                </div>
              </div>
              <div className="btn-row">
                <button className="btn small" onClick={() => setView(k)}>
                  View {wasSent ? "sent email" : "email"}
                </button>
                {wasSent && (
                  <label
                    className="small"
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={resend.has(k)}
                      onChange={() => onToggle(k)}
                    />{" "}
                    Send again
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {view && (
        <Modal title={`Emails to ${view}`} onClose={() => setView(null)} wide>
          {dups[view].map((d) => (
            <div key={d.id} style={{ marginBottom: 16 }}>
              <div className="muted small">
                {d.status} · {d.kind} · {when(d.sentAt || d.createdAt)}
                {d.batchName ? ` · ${d.batchName}` : ""}
              </div>
              <strong>{d.subject}</strong>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                {d.body}
              </div>
              {d.attachments.length > 0 && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Attachments: {d.attachments.join(", ")}
                </div>
              )}
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
