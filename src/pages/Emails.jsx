import { useEffect, useMemo, useState } from "react";
import {
  Search,
  CalendarClock,
  Trash2,
  Paperclip,
  Pencil,
  RefreshCw,
  Send,
  Mail,
  X,
  CheckCheck,
  Undo2,
  Shuffle,
  Tag,
  MessageCircle,
  CornerUpLeft,
  Inbox,
  BellRing,
} from "lucide-react";
import { api } from "../api.js";
import {
  Badge,
  Empty,
  Field,
  Modal,
  Toggle,
  fmtTime,
  useToast,
} from "../ui.jsx";
import ComposeModal from "../ComposeModal.jsx";
import ReplyComposer from "../ReplyComposer.jsx";
import SignaturePicker from "../SignaturePicker.jsx";

const STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "replied",
  "failed",
  "missed",
];
const pad = (n) => String(n).padStart(2, "0");
const localInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const DAY = 86400000;

const TAG_COLORS = [
  "#6c7bff",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
  "#ef4444",
  "#0ea5e9",
];
const tagColor = (t) =>
  TAG_COLORS[
    [...t].reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_COLORS.length
  ];
const SUGGEST = [
  "Interested",
  "Waiting",
  "Follow-up",
  "Meeting",
  "Declined",
  "Important",
];
export const TagChip = ({ t, onX }) => (
  <span className="tagchip" style={{ "--tc": tagColor(t) }}>
    {t}
    {onX && (
      <button type="button" onClick={onX} aria-label={`Remove ${t}`}>
        ×
      </button>
    )}
  </span>
);
const ago = (ms) => {
  if (!ms) return "never";
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1
    ? "just now"
    : m < 60
      ? `${m} min ago`
      : m < 1440
        ? `${Math.round(m / 60)} h ago`
        : `${Math.round(m / 1440)} d ago`;
};

export default function Emails() {
  const [emails, setEmails] = useState(null),
    [docs, setDocs] = useState([]),
    [batches, setBatches] = useState([]),
    [cfg, setCfg] = useState({ tz: "Asia/Shanghai", followUpDays: 7 });
  const [batch, setBatch] = useState(""),
    [status, setStatus] = useState(""),
    [q, setQ] = useState(""),
    [tag, setTag] = useState(""),
    [quick, setQuick] = useState("");
  const [sel, setSel] = useState(new Set()),
    [modal, setModal] = useState(null),
    [inbox, setInbox] = useState({}),
    [syncing, setSyncing] = useState(false);
  const toast = useToast();
  const tz = cfg.tz;

  const load = async (silent) => {
    try {
      const [e, d, b, s, ib] = await Promise.all([
        api.get("/api/emails"),
        api.get("/api/documents"),
        api.get("/api/batches"),
        api.get("/api/settings"),
        api.get("/api/inbox/status"),
      ]);
      setEmails(e.filter((x) => x.kind !== "reply"));
      setDocs(d);
      setBatches(b);
      setCfg(s);
      setInbox(ib);
    } catch (x) {
      if (!silent) toast(x.message, "err");
    }
  };
  // live view: statuses change by themselves while emails are being sent, so refresh every few seconds
  useEffect(() => {
    load();
    const t = setInterval(
      () => document.visibilityState === "visible" && load(true),
      5000,
    );
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  const kids = useMemo(() => {
    const m = new Map();
    (emails || []).forEach((e) => {
      if (e.parentId)
        (m.get(e.parentId) || m.set(e.parentId, []).get(e.parentId)).push(e);
    });
    return m;
  }, [emails]);
  const isDue = (e) => {
    if (e.status !== "sent" || e.parentId || e.replyCount || e.noFollowUp)
      return false;
    const ks = kids.get(e.id) || [];
    if (ks.some((k) => ["draft", "scheduled", "sending"].includes(k.status)))
      return false;
    return (
      Date.now() - Math.max(e.sentAt || 0, ...ks.map((k) => k.sentAt || 0)) >
      cfg.followUpDays * DAY
    );
  };
  const allTags = useMemo(() => {
    const m = new Map();
    (emails || []).forEach((e) =>
      (e.tags || []).forEach((t) => m.set(t, (m.get(t) || 0) + 1)),
    );
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [emails]);

  // "base" = everything that matches batch / tag / search, so the counts on the tabs follow those filters
  const base = useMemo(
    () =>
      (emails || []).filter(
        (e) =>
          (!batch || e.batchId === batch) &&
          (!tag || (e.tags || []).includes(tag)) &&
          (!q ||
            `${e.to} ${e.toName} ${e.subject} ${(e.tags || []).join(" ")}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [emails, batch, tag, q],
  );
  const quickOf = (e, k) =>
    k === "due"
      ? isDue(e)
      : k === "unread"
        ? !!e.unread
        : k === "noreply"
          ? ["sent"].includes(e.status) && !e.replyCount && !e.parentId
          : true;
  const shown = useMemo(
    () =>
      base.filter(
        (e) =>
          (!status || e.status === status) && (!quick || quickOf(e, quick)),
      ),
    [base, status, quick, kids, cfg],
  ); // eslint-disable-line
  const counts = useMemo(() => {
    const c = {};
    base.forEach((e) => {
      c[e.status] = (c[e.status] || 0) + 1;
    });
    return c;
  }, [base]);
  const qc = useMemo(
    () => ({
      due: base.filter((e) => isDue(e)).length,
      unread: base.filter((e) => e.unread).length,
      noreply: base.filter((e) => quickOf(e, "noreply")).length,
    }),
    [base, kids, cfg],
  ); // eslint-disable-line
  const filtered = !!(batch || tag || q || status || quick);
  const allSel = shown.length > 0 && shown.every((e) => sel.has(e.id));
  const toggle = (id) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const ids = [...sel],
    selRows = (emails || []).filter((e) => sel.has(e.id));

  const run = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      setSel(new Set());
      setModal(null);
      load(true);
    } catch (x) {
      toast(x.message, "err");
    }
  };
  const del = () =>
    confirm(`Delete ${ids.length} email(s)?`) &&
    run(() => api.post("/api/emails/bulk-delete", { ids }), "Deleted");
  const unschedule = () =>
    run(() => api.post("/api/unschedule", { ids }), "Moved back to drafts");
  const delBatch = () =>
    batch &&
    confirm("Delete this whole batch and all its emails?") &&
    run(() => api.del(`/api/batches/${batch}`), "Batch deleted").then(() =>
      setBatch(""),
    );
  const check = async () => {
    setSyncing(true);
    try {
      const r = await api.post("/api/inbox/sync");
      toast(
        r.newReplies
          ? `${r.newReplies} new repl${r.newReplies > 1 ? "ies" : "y"}`
          : "No new replies",
      );
    } catch (x) {
      toast(x.message, "err");
    }
    setSyncing(false);
    load(true);
  };
  const clearFilters = () => {
    setBatch("");
    setStatus("");
    setQ("");
    setTag("");
    setQuick("");
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Emails</h1>
          <p className="muted">
            {emails ? `${emails.length} emails` : "Loading…"} · times in {tz} ·
            updates live
          </p>
        </div>
        <div className="btn-row">
          <button
            className="btn primary"
            onClick={() => setModal({ type: "compose" })}
          >
            <Pencil size={16} /> Compose
          </button>
          <button
            className="btn"
            onClick={check}
            disabled={syncing}
            title={inbox.error || "Look in your mailbox for replies"}
          >
            <Inbox size={16} className={syncing ? "spin" : ""} />{" "}
            {syncing ? "Checking…" : "Check replies"}
          </button>
          <button className="btn" onClick={() => load()}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>
      {inbox.error && <div className="banner warn">{inbox.error}</div>}

      <div className="status-tabs">
        <button className={!status ? "on" : ""} onClick={() => setStatus("")}>
          All <b>{base.length}</b>
        </button>
        {STATUSES.filter((s) => s !== "missed" || counts.missed).map((s) => (
          <button
            key={s}
            className={status === s ? "on" : ""}
            onClick={() => setStatus(status === s ? "" : s)}
          >
            {s} <b>{counts[s] || 0}</b>
          </button>
        ))}
      </div>

      <div className="quick-row">
        {[
          ["due", `Follow-up due`, BellRing],
          ["unread", "Unread replies", MessageCircle],
          ["noreply", "No reply yet", Mail],
        ].map(([k, l, Icon]) => (
          <button
            key={k}
            className={`qchip ${quick === k ? "on" : ""} ${k}`}
            onClick={() => setQuick(quick === k ? "" : k)}
          >
            <Icon size={14} /> {l} <b>{qc[k]}</b>
          </button>
        ))}
        <span className="muted small qinfo">
          Follow-up is due {cfg.followUpDays} days after sending when nobody
          replied (change in Settings).
        </span>
      </div>

      <div className="toolbar">
        <div className="input-icon grow">
          <Search size={16} />
          <input
            placeholder="Search name, email, subject or tag"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select value={batch} onChange={(e) => setBatch(e.target.value)}>
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.count})
            </option>
          ))}
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map(([t, n]) => (
            <option key={t} value={t}>
              {t} ({n})
            </option>
          ))}
        </select>
        {batch && (
          <button className="btn danger-o" onClick={delBatch}>
            <Trash2 size={16} /> Delete batch
          </button>
        )}
      </div>

      <div className="count-line">
        <span>
          Showing <b>{shown.length}</b> of <b>{emails?.length || 0}</b> emails
          {sel.size > 0 && (
            <>
              {" "}
              · <b>{sel.size}</b> selected
            </>
          )}
        </span>
        {filtered && (
          <button className="linkbtn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {sel.size > 0 && (
        <div className="bulkbar">
          <span>
            <b>{sel.size}</b> selected
          </span>
          <button
            className="btn primary"
            onClick={() => setModal({ type: "schedule" })}
          >
            <CalendarClock size={16} /> Schedule
          </button>
          <button className="btn" onClick={() => setModal({ type: "tags" })}>
            <Tag size={16} /> Tags
          </button>
          {selRows.some(
            (e) => e.status === "sent" && !e.replyCount && !e.parentId,
          ) && (
            <button
              className="btn"
              onClick={() => setModal({ type: "followup" })}
            >
              <CornerUpLeft size={16} /> Follow up
            </button>
          )}
          <button className="btn" onClick={unschedule}>
            <Undo2 size={16} /> Unschedule
          </button>
          <button className="btn" onClick={() => setModal({ type: "attach" })}>
            <Paperclip size={16} /> Attachments
          </button>
          <button className="btn" onClick={() => setModal({ type: "subject" })}>
            <Pencil size={16} /> Subject
          </button>
          <button className="btn danger-o" onClick={del}>
            <Trash2 size={16} /> Delete
          </button>
          <button
            className="icon-btn"
            onClick={() => setSel(new Set())}
            aria-label="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="card table">
        <div className="trow thead">
          <input
            type="checkbox"
            checked={allSel}
            onChange={() =>
              setSel(allSel ? new Set() : new Set(shown.map((e) => e.id)))
            }
            aria-label="Select all"
          />
          <span>Recipient</span>
          <span>Subject</span>
          <span>Attachments</span>
          <span>Status</span>
          <span>Send time</span>
        </div>
        {!emails ? (
          <div className="spinner" />
        ) : shown.length === 0 ? (
          <Empty icon={<Mail size={28} />} title="No emails here">
            {filtered
              ? "Nothing matches these filters."
              : "Import a sheet to create drafts."}
            {filtered && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            )}
          </Empty>
        ) : (
          shown.map((e) => (
            <div
              key={e.id}
              className={`trow ${sel.has(e.id) ? "sel" : ""} ${e.unread ? "unread" : ""}`}
              onClick={() => setModal({ type: "edit", id: e.id })}
            >
              <input
                type="checkbox"
                checked={sel.has(e.id)}
                onClick={(ev) => ev.stopPropagation()}
                onChange={() => toggle(e.id)}
                aria-label="Select"
              />
              <span className="cell-main">
                <strong>{e.toName || e.to}</strong>
                <small>{e.to}</small>
                {(e.tags?.length > 0 || e.kind === "followup") && (
                  <span className="tagrow">
                    {e.kind === "followup" && (
                      <span className="kindchip">Follow-up</span>
                    )}
                    {(e.tags || [])
                      .filter(
                        (t) => !(e.kind === "followup" && t === "Follow-up"),
                      )
                      .slice(0, 3)
                      .map((t) => (
                        <TagChip key={t} t={t} />
                      ))}
                    {(e.tags || []).length > 3 && (
                      <span className="muted small">+{e.tags.length - 3}</span>
                    )}
                  </span>
                )}
              </span>
              <span className="cell-sub">{e.subject}</span>
              <span className="cell-att">
                {e.attachments?.length ? (
                  <>
                    <Paperclip size={14} /> {e.attachments.length}
                  </>
                ) : (
                  <span className="muted">none</span>
                )}
              </span>
              <span className="cell-status">
                <Badge status={e.status} />
                {e.replyCount > 0 && (
                  <span
                    className={`reply-pill ${e.unread ? "new" : ""}`}
                    title="Replies in this conversation"
                  >
                    <MessageCircle size={12} /> {e.replyCount}
                  </span>
                )}
                {isDue(e) && (
                  <span
                    className="due-pill"
                    title={`No reply for ${cfg.followUpDays}+ days`}
                  >
                    Follow up
                  </span>
                )}
                {e.status === "failed" && e.error && (
                  <small className="err-line" title={e.error}>
                    {e.error}
                  </small>
                )}
              </span>
              <span className="cell-time">
                {e.status === "sent" || e.status === "replied"
                  ? fmtTime(e.sentAt, tz)
                  : e.sendAt
                    ? fmtTime(e.sendAt, tz)
                    : "-"}
              </span>
            </div>
          ))
        )}
      </section>

      {modal?.type === "schedule" && (
        <ScheduleModal
          ids={ids}
          tz={tz}
          onClose={() => setModal(null)}
          onDone={(m) => {
            toast(m);
            setSel(new Set());
            setModal(null);
            load(true);
          }}
        />
      )}
      {modal?.type === "edit" && emails.find((e) => e.id === modal.id) && (
        <EditModal
          email={emails.find((e) => e.id === modal.id)}
          docs={docs}
          tz={tz}
          cfg={cfg}
          onClose={() => setModal(null)}
          onChanged={() => load(true)}
          onDone={(m) => {
            toast(m);
            setModal(null);
            load(true);
          }}
          onFollowUp={(id) => setModal({ type: "followup", only: [id] })}
        />
      )}
      {modal?.type === "attach" && (
        <AttachModal
          docs={docs}
          count={ids.length}
          onClose={() => setModal(null)}
          onSave={(attachments) =>
            run(
              () =>
                api.post("/api/emails/bulk", { ids, patch: { attachments } }),
              "Attachments updated",
            )
          }
        />
      )}
      {modal?.type === "subject" && (
        <SubjectModal
          count={ids.length}
          onClose={() => setModal(null)}
          onSave={(subject) =>
            run(
              () => api.post("/api/emails/bulk", { ids, patch: { subject } }),
              "Subject updated",
            )
          }
        />
      )}
      {modal?.type === "tags" && (
        <TagModal
          rows={selRows}
          all={allTags}
          onClose={() => setModal(null)}
          onApply={(add, remove) =>
            run(
              () => api.post("/api/emails/bulk-tags", { ids, add, remove }),
              "Tags updated",
            )
          }
        />
      )}
      {modal?.type === "followup" && (
        <FollowUpModal
          docs={docs}
          rows={
            modal.only
              ? (emails || []).filter((e) => modal.only.includes(e.id))
              : selRows.filter(
                  (e) => e.status === "sent" && !e.replyCount && !e.parentId,
                )
          }
          onClose={() => setModal(null)}
          onCreate={(p) =>
            run(async () => {
              const r = await api.post("/api/followups", {
                ids: modal.only || ids,
                ...p,
              });
              if (r.created) setStatus("");
            }, "Follow-up drafts created: schedule them like any email")
          }
        />
      )}
      {modal?.type === "compose" && (
        <ComposeModal
          docs={docs}
          onClose={() => setModal(null)}
          onDone={(m) => {
            toast(m);
            setModal(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}

export function ScheduleModal({ ids, tz, onClose, onDone }) {
  const tomorrow = new Date(Date.now() + 86400000);
  const at = (d, h) => {
    const x = new Date(d);
    x.setHours(h, 0, 0, 0);
    return localInput(x);
  };
  const [f, setF] = useState({
    mode: "range",
    at: at(tomorrow, 9),
    start: at(tomorrow, 8),
    end: at(new Date(Date.now() + 4 * 86400000), 18),
    useWindow: true,
    windowStart: "08:00",
    windowEnd: "11:00",
    skipWeekends: true,
    minGapMin: 10,
    shuffle: false,
  });
  const [prev, setPrev] = useState(null),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (k, v) => {
    setF((x) => ({ ...x, [k]: v }));
    setPrev(null);
    setErr("");
  };
  const body = (preview) => ({
    ids,
    preview,
    tz,
    mode: f.mode,
    at: f.at,
    start: f.start,
    end: f.end,
    shuffle: f.shuffle,
    skipWeekends: f.skipWeekends,
    minGapMin: Number(f.minGapMin) || 0,
    ...(f.useWindow
      ? { windowStart: f.windowStart, windowEnd: f.windowEnd }
      : {}),
  });
  const doPreview = async () => {
    setBusy(true);
    setErr("");
    try {
      setPrev(await api.post("/api/schedule", body(true)));
    } catch (e) {
      setErr(e.message);
      setPrev(null);
    }
    setBusy(false);
  };
  const confirm_ = async () => {
    setBusy(true);
    try {
      const r = await api.post("/api/schedule", body(false));
      onDone(`Scheduled ${r.count} emails`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Schedule ${ids.length} email(s)`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {f.mode === "now" || prev ? (
            <button className="btn primary" disabled={busy} onClick={confirm_}>
              <Send size={16} />{" "}
              {f.mode === "now" ? "Send now" : "Confirm schedule"}
            </button>
          ) : (
            <button className="btn primary" disabled={busy} onClick={doPreview}>
              Preview times
            </button>
          )}
        </>
      }
    >
      <div className="seg">
        {[
          ["range", "Random in a date range"],
          ["at", "Specific time"],
          ["now", "Send now"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={f.mode === k ? "on" : ""}
            onClick={() => set("mode", k)}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="hint">
        All times are in <b>{tz}</b>. Emails are sent one by one with a short
        pause between them.
      </p>
      {f.mode === "at" && (
        <Field label="Send at">
          <input
            type="datetime-local"
            value={f.at}
            onChange={(e) => set("at", e.target.value)}
          />
        </Field>
      )}
      {f.mode === "range" && (
        <>
          <div className="form-grid">
            <Field label="Range start">
              <input
                type="datetime-local"
                value={f.start}
                onChange={(e) => set("start", e.target.value)}
              />
            </Field>
            <Field label="Range end">
              <input
                type="datetime-local"
                value={f.end}
                onChange={(e) => set("end", e.target.value)}
              />
            </Field>
            <Field label="Minimum gap between emails (min)">
              <input
                type="number"
                min="0"
                value={f.minGapMin}
                onChange={(e) => set("minGapMin", e.target.value)}
              />
            </Field>
          </div>
          <Toggle
            checked={f.useWindow}
            onChange={(v) => set("useWindow", v)}
            label="Only send inside a daily time window"
          />
          {f.useWindow && (
            <div className="form-grid">
              <Field label="Window start">
                <input
                  type="time"
                  value={f.windowStart}
                  onChange={(e) => set("windowStart", e.target.value)}
                />
              </Field>
              <Field label="Window end">
                <input
                  type="time"
                  value={f.windowEnd}
                  onChange={(e) => set("windowEnd", e.target.value)}
                />
              </Field>
            </div>
          )}
          <Toggle
            checked={f.skipWeekends}
            onChange={(v) => set("skipWeekends", v)}
            label="Skip Saturdays and Sundays"
          />
          <Toggle
            checked={f.shuffle}
            onChange={(v) => set("shuffle", v)}
            label={
              <span className="inline">
                <Shuffle size={14} /> Shuffle order (otherwise top rows go
                first)
              </span>
            }
          />
        </>
      )}
      {err && <div className="form-err">{err}</div>}
      {prev && (
        <div className="preview-times">
          <p>
            <CheckCheck size={16} /> <b>{prev.count}</b> emails from{" "}
            <b>{fmtTime(prev.first, tz)}</b> to <b>{fmtTime(prev.last, tz)}</b>
          </p>
          <ul>
            {prev.plan.map((p) => (
              <li key={p.id}>
                <span>{p.toName || p.to}</span>
                <b>{fmtTime(p.sendAt, tz)}</b>
              </li>
            ))}
          </ul>
          {prev.count > prev.plan.length && (
            <p className="muted small">
              …and {prev.count - prev.plan.length} more
            </p>
          )}
          <button className="btn small" onClick={doPreview}>
            <Shuffle size={14} /> Re-roll times
          </button>
        </div>
      )}
    </Modal>
  );
}

function TagModal({ rows, all, onClose, onApply }) {
  const [add, setAdd] = useState([]),
    [rem, setRem] = useState([]),
    [txt, setTxt] = useState("");
  const present = [...new Set(rows.flatMap((e) => e.tags || []))];
  const push = (t) => {
    t = t.trim().slice(0, 30);
    if (t && !add.includes(t)) setAdd([...add, t]);
    setTxt("");
  };
  return (
    <Modal
      title={`Tags for ${rows.length} email(s)`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!add.length && !rem.length}
            onClick={() => onApply(add, rem)}
          >
            Apply
          </button>
        </>
      }
    >
      <Field label="Add a tag">
        <input
          autoFocus
          value={txt}
          placeholder="Type a tag and press Enter"
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              push(txt);
            }
          }}
        />
      </Field>
      <div className="tagrow">
        {add.map((t) => (
          <TagChip
            key={t}
            t={t}
            onX={() => setAdd(add.filter((x) => x !== t))}
          />
        ))}
      </div>
      <p className="hint">Suggestions</p>
      <div className="tagrow">
        {[...new Set([...SUGGEST, ...all.map(([t]) => t)])]
          .filter((t) => !add.includes(t))
          .map((t) => (
            <button
              key={t}
              className="tagchip btn-like"
              style={{ "--tc": tagColor(t) }}
              onClick={() => push(t)}
            >
              + {t}
            </button>
          ))}
      </div>
      {present.length > 0 && (
        <>
          <h4>Remove from the selected emails</h4>
          <div className="tagrow">
            {present.map((t) => (
              <button
                key={t}
                className={`tagchip btn-like ${rem.includes(t) ? "off" : ""}`}
                style={{ "--tc": tagColor(t) }}
                onClick={() =>
                  setRem(
                    rem.includes(t) ? rem.filter((x) => x !== t) : [...rem, t],
                  )
                }
              >
                {rem.includes(t) ? "✕ " : ""}
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

const FOLLOW_TXT =
  "Dear Professor,\n\nI hope you are doing well. I am following up on my previous email below, in case it was missed. I would be very grateful if you could let me know whether you are able to supervise my bachelor thesis.\n\nThank you very much for your time.\n\nBest regards,\nMuhammad Hamim";
function FollowUpModal({ rows, docs, onClose, onCreate }) {
  const [body, setBody] = useState(FOLLOW_TXT),
    [quote, setQuote] = useState(true),
    [att, setAtt] = useState(new Set()),
    [sig, setSig] = useState(null);
  return (
    <Modal
      title={`Follow up with ${rows.length} ${rows.length === 1 ? "person" : "people"}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!rows.length || !body.trim()}
            onClick={() =>
              onCreate({ body, quote, attachments: [...att], sigHtml: sig?.html || "" })
            }
          >
            <CornerUpLeft size={16} /> Create {rows.length} draft
            {rows.length === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <p className="muted">
        Creates a <b>reply in the same conversation</b> (subject “Re: …”) for
        each sent email without a reply. You can edit every draft, then schedule
        them like any other email. Use <code>{"{{name}}"}</code> for the
        person's name.
      </p>
      <Field label="Follow-up message">
        <textarea
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <Toggle
        checked={quote}
        onChange={setQuote}
        label="Quote my original email below the message"
      />
      <SignaturePicker sig={sig} onChange={setSig} />
      {docs.length > 0 && (
        <>
          <span className="lbl">Attach again (optional)</span>
          <div className="chips">
            {docs.map((d) => (
              <label key={d.id} className={`chip ${att.has(d.id) ? "on" : ""}`}>
                <input
                  type="checkbox"
                  hidden
                  checked={att.has(d.id)}
                  onChange={() =>
                    setAtt((s) => {
                      const n = new Set(s);
                      n.has(d.id) ? n.delete(d.id) : n.add(d.id);
                      return n;
                    })
                  }
                />
                <Paperclip size={13} /> {d.name}
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function Thread({ email, tz, onFollowUp, onChanged, docs = [] }) {
  const [data, setData] = useState(null),
    [open, setOpen] = useState({});
  const toast = useToast();
  const load = () =>
    api
      .get(`/api/emails/${email.id}/thread`)
      .then(setData)
      .catch((e) => toast(e.message, "err"));
  useEffect(() => {
    load();
    if (email.unread)
      api
        .post(`/api/emails/${email.id}/read`)
        .then(onChanged)
        .catch(() => {});
  }, [email.id]); // eslint-disable-line
  if (!data) return <div className="spinner" />;
  const hasReply = data.items.some((i) => i.type === "in");
  return (
    <div className="thread">
      {data.items.map((i) => (
        <div key={i.id} className={`bubble ${i.type}`}>
          <div className="bhead">
            <b>
              {i.type === "in"
                ? i.fromName || i.from
                : i.kind === "original"
                  ? "You · first email"
                  : i.kind === "reply"
                    ? "You · reply"
                    : "You · follow-up"}
            </b>
            <span className="muted small">
              {i.status && i.status !== "sent" && i.status !== "replied"
                ? `${i.status} · `
                : ""}
              {fmtTime(i.at, tz)}
              {i.auto ? " · automatic reply" : ""}
            </span>
          </div>
          <div className="bsub small muted">{i.subject}</div>
          {i.html ? (
            <div
              className="bhtml"
              style={{ whiteSpace: "normal" }}
              dangerouslySetInnerHTML={{ __html: i.html }}
              onClick={(ev) => {
                const a = ev.target.closest && ev.target.closest("a");
                if (a) {
                  ev.preventDefault();
                  window.open(a.href, "_blank");
                }
              }}
            />
          ) : (
            <div className="btext">
              {i.text || <span className="muted">(empty)</span>}
            </div>
          )}
          {i.quoted && (
            <>
              <button
                className="linkbtn small"
                onClick={() => setOpen({ ...open, [i.id]: !open[i.id] })}
              >
                {open[i.id] ? "Hide" : "Show"} quoted text
              </button>
              {open[i.id] && <pre className="quoted">{i.quoted}</pre>}
            </>
          )}
          {i.attachments?.length > 0 && Array.isArray(i.attachments) && (
            <div className="small muted">
              <Paperclip size={12} />{" "}
              {i.attachments.map((a) => a.filename).join(", ")}
            </div>
          )}
          {i.error && <div className="form-err">{i.error}</div>}
        </div>
      ))}
      {!hasReply && (
        <div className="banner info">
          <BellRing size={16} />
          <span>
            No reply yet.{" "}
            <button className="linkbtn" onClick={() => onFollowUp(email.id)}>
              Create a follow-up
            </button>
          </span>
        </div>
      )}
      {["sent", "replied"].includes(email.status) && (
        <ReplyComposer
          emailId={email.id}
          docs={docs}
          onSent={async () => {
            await load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  email,
  docs,
  tz,
  cfg,
  onClose,
  onChanged,
  onDone,
  onFollowUp,
}) {
  const [f, setF] = useState({
    to: email.to,
    toName: email.toName,
    subject: email.subject,
    body: email.body,
    attachments: email.attachments || [],
  });
  const [tags, setTags] = useState(email.tags || []),
    [tagTxt, setTagTxt] = useState("");
  const sentLike = ["sent", "replied"].includes(email.status);
  const [tab, setTab] = useState(
    sentLike && (email.replyCount || email.unread) ? "thread" : "email",
  );
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const locked = ["sent", "replied", "sending"].includes(email.status);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const act = async (fn, msg, close) => {
    setBusy(true);
    try {
      await fn();
      close ? onDone(msg) : (toast(msg), onChanged());
    } catch (e) {
      toast(e.message, "err");
    }
    setBusy(false);
  };
  const saveTags = (t) => {
    setTags(t);
    api
      .patch(`/api/emails/${email.id}`, { tags: t })
      .then(onChanged)
      .catch((e) => toast(e.message, "err"));
  };
  const addTag = (t) => {
    t = t.trim().slice(0, 30);
    if (t && !tags.includes(t)) saveTags([...tags, t]);
    setTagTxt("");
  };
  const save = () =>
    act(() => api.patch(`/api/emails/${email.id}`, f), "Saved", true);
  return (
    <Modal
      title={email.kind === "followup" ? "Follow-up" : "Email details"}
      onClose={onClose}
      wide
      footer={
        tab === "email" ? (
          <>
            {!locked && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api.patch(`/api/emails/${email.id}`, f);
                    await api.post(`/api/emails/${email.id}/test`);
                  }, "Test sent to your own inbox")
                }
              >
                Send test to me
              </button>
            )}
            {!locked && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  act(
                    async () => {
                      await api.patch(`/api/emails/${email.id}`, f);
                      await api.post("/api/schedule", {
                        ids: [email.id],
                        mode: "now",
                      });
                    },
                    "Queued to send now",
                    true,
                  )
                }
              >
                <Send size={16} /> Send now
              </button>
            )}
            {email.status === "sent" && (
              <button
                className="btn"
                onClick={() =>
                  act(
                    () =>
                      api.patch(`/api/emails/${email.id}`, {
                        status: "replied",
                      }),
                    "Marked as replied",
                    true,
                  )
                }
              >
                Mark replied
              </button>
            )}
            {email.status === "replied" && (
              <button
                className="btn"
                onClick={() =>
                  act(
                    () =>
                      api.patch(`/api/emails/${email.id}`, { status: "sent" }),
                    "Marked as sent",
                    true,
                  )
                }
              >
                Unmark replied
              </button>
            )}
            {!locked && (
              <button className="btn primary" disabled={busy} onClick={save}>
                Save
              </button>
            )}
          </>
        ) : (
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <div className="row-between">
        <div className="btn-row">
          <Badge status={email.status} />
          {email.replyCount > 0 && (
            <span className="reply-pill">
              <MessageCircle size={12} /> {email.replyCount}
            </span>
          )}
        </div>
        <span className="muted small">
          {email.batchName}
          {email.sendAt && !email.sentAt
            ? ` · scheduled ${fmtTime(email.sendAt, tz)}`
            : ""}
          {email.sentAt ? ` · sent ${fmtTime(email.sentAt, tz)}` : ""}
        </span>
      </div>
      {sentLike && (
        <div className="seg">
          <button
            className={tab === "email" ? "on" : ""}
            onClick={() => setTab("email")}
          >
            Email
          </button>
          <button
            className={tab === "thread" ? "on" : ""}
            onClick={() => setTab("thread")}
          >
            Conversation{email.replyCount ? ` (${email.replyCount})` : ""}
          </button>
        </div>
      )}
      <div className="taged">
        <Tag size={14} />
        {tags.map((t) => (
          <TagChip
            key={t}
            t={t}
            onX={() => saveTags(tags.filter((x) => x !== t))}
          />
        ))}
        <input
          className="taginput"
          placeholder="Add tag…"
          value={tagTxt}
          list="tag-suggest"
          onChange={(e) => setTagTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(tagTxt);
            }
          }}
          onBlur={() => tagTxt && addTag(tagTxt)}
        />
        <datalist id="tag-suggest">
          {SUGGEST.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      {tab === "thread" ? (
        <Thread
          email={email}
          tz={tz}
          docs={docs}
          onFollowUp={onFollowUp}
          onChanged={onChanged}
        />
      ) : (
        <>
          {email.status === "failed" && (
            <div className="form-err">{email.error}</div>
          )}
          <div className="form-grid">
            <Field label="To">
              <input
                value={f.to}
                disabled={locked}
                onChange={(e) => set("to", e.target.value)}
              />
            </Field>
            <Field label="Name">
              <input
                value={f.toName}
                disabled={locked}
                onChange={(e) => set("toName", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Subject">
            <input
              value={f.subject}
              disabled={locked}
              onChange={(e) => set("subject", e.target.value)}
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={13}
              value={f.body}
              disabled={locked}
              onChange={(e) => set("body", e.target.value)}
            />
          </Field>
          <span className="lbl">Attachments</span>
          {docs.length === 0 ? (
            <p className="muted small">No documents uploaded yet.</p>
          ) : (
            <div className="chips">
              {docs.map((d) => (
                <label
                  key={d.id}
                  className={`chip ${f.attachments.includes(d.id) ? "on" : ""}`}
                >
                  <input
                    type="checkbox"
                    hidden
                    disabled={locked}
                    checked={f.attachments.includes(d.id)}
                    onChange={() =>
                      set(
                        "attachments",
                        f.attachments.includes(d.id)
                          ? f.attachments.filter((a) => a !== d.id)
                          : [...f.attachments, d.id],
                      )
                    }
                  />
                  <Paperclip size={13} /> {d.name}
                </label>
              ))}
            </div>
          )}
          {email.status === "sent" && !email.replyCount && !email.parentId && (
            <div className="followbar">
              <span className="muted small">
                No reply yet. Follow-up is due {cfg.followUpDays} days after
                sending.
              </span>
              <div className="btn-row">
                <button
                  className="btn small"
                  onClick={() => onFollowUp(email.id)}
                >
                  <CornerUpLeft size={14} /> Create follow-up
                </button>
                <button
                  className="btn small"
                  onClick={() =>
                    act(
                      () =>
                        api.patch(`/api/emails/${email.id}`, {
                          noFollowUp: !email.noFollowUp,
                        }),
                      email.noFollowUp
                        ? "Follow-up reminders back on"
                        : "Will not remind about this one",
                    )
                  }
                >
                  {email.noFollowUp ? "Remind me again" : "No follow-up needed"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function AttachModal({ docs, count, onClose, onSave }) {
  const [pick, setPick] = useState(new Set(docs.map((d) => d.id)));
  return (
    <Modal
      title={`Attachments for ${count} email(s)`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onSave([...pick])}>
            Apply
          </button>
        </>
      }
    >
      <p className="muted">
        This replaces the attachments on every selected email (sent ones are
        left alone).
      </p>
      {docs.length === 0 ? (
        <p className="muted">Upload documents first.</p>
      ) : (
        <div className="chips">
          {docs.map((d) => (
            <label key={d.id} className={`chip ${pick.has(d.id) ? "on" : ""}`}>
              <input
                type="checkbox"
                hidden
                checked={pick.has(d.id)}
                onChange={() =>
                  setPick((s) => {
                    const n = new Set(s);
                    n.has(d.id) ? n.delete(d.id) : n.add(d.id);
                    return n;
                  })
                }
              />
              <Paperclip size={13} /> {d.name}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

function SubjectModal({ count, onClose, onSave }) {
  const [s, setS] = useState("");
  return (
    <Modal
      title={`Subject for ${count} email(s)`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!s.trim()}
            onClick={() => onSave(s.trim())}
          >
            Apply
          </button>
        </>
      }
    >
      <Field label="New subject">
        <input autoFocus value={s} onChange={(e) => setS(e.target.value)} />
      </Field>
    </Modal>
  );
}
