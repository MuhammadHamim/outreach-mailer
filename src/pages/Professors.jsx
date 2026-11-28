import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  GraduationCap,
  Search,
  Download,
  Trash2,
  ExternalLink,
  Copy,
  Square,
  ShieldAlert,
} from "lucide-react";
import { api } from "../api.js";
import { Empty, Field, useLoad, useToast } from "../ui.jsx";

const STATUS = [
  ["new", "New"],
  ["shortlist", "Shortlisted"],
  ["contacted", "Contacted"],
  ["skip", "Skip"],
];
const KW_KEY = "prof-keywords";

// How well does a professor's research text match my keywords? (phrase = 1 point, all words present = half)
function scoreOf(p, kws) {
  if (!kws.length) return { score: 0, hits: [] };
  const hay = `${p.research || ""} ${(p.domains || []).join(" ")} ${(p.topics || []).join(" ")} ${p.discipline || ""} ${p.title || ""}`.toLowerCase();
  const hits = [];
  let pts = 0;
  for (const k of kws) {
    if (hay.includes(k)) {
      pts += 1;
      hits.push(k);
    } else {
      const ws = k.split(/\s+/).filter((w) => w.length > 2);
      if (ws.length > 1 && ws.every((w) => hay.includes(w))) {
        pts += 0.5;
        hits.push(`${k} (partial)`);
      }
    }
  }
  return { score: Math.round((100 * pts) / kws.length), hits };
}

export default function Professors() {
  const [profs, reload, , setProfs] = useLoad(() => api.get("/api/professors"));
  const toast = useToast();
  const [url, setUrl] = useState(""),
    [selector, setSelector] = useState(""),
    [pages, setPages] = useState(1),
    [render, setRender] = useState("auto"),
    [assist, setAssist] = useState(true),
    [verify, setVerify] = useState(null),
    [caps, setCaps] = useState(null);
  const [found, setFound] = useState(null),
    [picked, setPicked] = useState(new Set()),
    [busy, setBusy] = useState(false),
    [job, setJob] = useState(null);
  const [keywords, setKeywords] = useState(() => {
    try {
      return localStorage.getItem(KW_KEY) || "";
    } catch {
      return "";
    }
  });
  const [q, setQ] = useState(""),
    [statusF, setStatusF] = useState(""),
    [onlyEmail, setOnlyEmail] = useState(false),
    [minMatch, setMinMatch] = useState(0),
    [sort, setSort] = useState("match"),
    [sel, setSel] = useState(new Set()),
    [openRes, setOpenRes] = useState(new Set()); // rows whose research text is expanded

  useEffect(() => {
    try {
      localStorage.setItem(KW_KEY, keywords);
    } catch {
      /* ignore */
    }
  }, [keywords]);

  useEffect(() => {
    api.get("/api/scrape/capabilities").then(setCaps).catch(() => {});
  }, []);

  // while looking or scraping, ask the server whether it is waiting for you to finish a captcha / login in the browser window
  useEffect(() => {
    if (!busy && job?.status !== "running") {
      setVerify(null);
      return;
    }
    const t = setInterval(async () => {
      try {
        setVerify((await api.get("/api/scrape/status")).verify);
      } catch {
        /* keep polling */
      }
    }, 1200);
    return () => clearInterval(t);
  }, [busy, job?.status]);

  // poll the running job
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(async () => {
      try {
        const j = await api.get(`/api/scrape/jobs/${job.id}`);
        setJob(j);
        reload();
        if (j.status !== "running")
          toast(
            `Done: ${j.saved} saved${j.errors.length ? `, ${j.errors.length} failed` : ""}`,
            j.saved ? "ok" : "err",
          );
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]); // eslint-disable-line

  const kws = useMemo(
    () =>
      keywords
        .split(/[,;\n，；]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [keywords],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (profs || [])
      .map((p) => ({ ...p, ...scoreOf(p, kws) }))
      .filter(
        (p) =>
          (!needle ||
            `${p.name} ${p.email} ${p.university} ${p.department} ${p.research} ${p.notes}`
              .toLowerCase()
              .includes(needle)) &&
          (!statusF || p.status === statusF) &&
          (!onlyEmail || p.email) &&
          p.score >= minMatch,
      )
      .sort((a, b) =>
        sort === "match"
          ? b.score - a.score || (a.name || "").localeCompare(b.name || "")
          : sort === "school"
            ? (a.university || "").localeCompare(b.university || "") ||
              (a.name || "").localeCompare(b.name || "")
            : (a.name || "").localeCompare(b.name || ""),
      );
  }, [profs, kws, q, statusF, onlyEmail, minMatch, sort]);

  const find = async () => {
    setBusy(true);
    setFound(null);
    try {
      const r = await api.post("/api/scrape/discover", {
        urls: url.split(/\s+/).filter(Boolean),
        selector: selector.trim(),
        pages: Number(pages) || 1,
        render,
        assist,
      });
      setFound(r);
      const hi = r.candidates.filter((c) => c.confidence === "high");
      setPicked(new Set((hi.length ? hi : r.candidates).map((c) => c.key)));
      if (!r.candidates.length) {
        const why = r.sources.find((x) => x.error)?.error;
        toast(
          why
            ? `No professors found: ${why}`
            : "No professors found. See the messages below, or try a CSS selector under Advanced.",
          "err",
        );
      }
    } catch (e) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const urls = found.candidates.filter((c) => picked.has(c.key));
    try {
      setJob(await api.post("/api/scrape/start", { urls, render, assist }));
      setFound(null);
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const patch = async (p, body) => {
    setProfs((list) => list.map((x) => (x.id === p.id ? { ...x, ...body } : x)));
    try {
      await api.patch(`/api/professors/${p.id}`, body);
    } catch (e) {
      toast(e.message, "err");
      reload();
    }
  };
  const bulkStatus = async (status) => {
    for (const id of sel) await api.patch(`/api/professors/${id}`, { status });
    setSel(new Set());
    reload();
  };
  const remove = async () => {
    if (!confirm(`Delete ${sel.size} professor(s) from this list?`)) return;
    await api.post("/api/professors/delete", { ids: [...sel] });
    setSel(new Set());
    reload();
  };

  const exportXlsx = () => {
    const list = rows.filter((p) => !sel.size || sel.has(p.id));
    const data = list.map((p) => ({
      Name: p.name,
      Email: p.email,
      University: p.university,
      Department: p.department,
      Title: p.title,
      "Research Interests": p.research,
      "Working domains": (p.domains || []).join("; "),
      Discipline: p.discipline,
      "Topics": (p.topics || []).join("; "),
      "Recent papers": (p.recentPapers || []).join(" | "),
      "Match %": kws.length ? p.score : "",
      "Matched Keywords": p.hits.join(", "),
      Recruiting:
        p.recruiting === "yes" ? "mentions recruiting" : p.recruiting === "no" ? "not accepting" : "",
      "Other Emails": p.otherEmails,
      "Profile URL": p.url,
      Homepage: p.homepage,
      "Google Scholar": p.scholar,
      Status: p.status,
      Notes: p.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [22, 30, 28, 28, 22, 60, 9, 28, 18, 28, 40, 30, 30, 11, 30].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Professors");
    XLSX.writeFile(wb, `professors-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const allSel = rows.length > 0 && rows.every((p) => sel.has(p.id));
  const pct = job ? Math.round((100 * job.done) / Math.max(1, job.total)) : 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Professor Finder</h1>
          <p className="muted">
            Paste a faculty-directory link. It visits every profile, collects email, research interests and school, and
            ranks them against your interests. Public pages only; robots.txt is respected.
          </p>
        </div>
      </header>

      <section className="card pad">
        <div className="prof-find">
          <Field
            label="Links (one per line)"
            hint="Mix freely: a professor's own page, a faculty directory, or a list that shows everyone's details on one page"
          >
            <textarea
              rows={3}
              placeholder={"https://cs.example.edu/people/faculty\nhttps://another.edu/~professor"}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field label="Pages to follow" hint="Follows “Next” links on directories">
            <input type="number" min="1" max="15" value={pages} onChange={(e) => setPages(e.target.value)} />
          </Field>
          <Field label="Render JavaScript" hint="Auto = only when needed">
            <select value={render} onChange={(e) => setRender(e.target.value)}>
              <option value="auto">Auto</option>
              <option value="always">Always</option>
              <option value="never">Never</option>
            </select>
          </Field>
          <button className="btn primary" disabled={busy || !url.trim()} onClick={find}>
            <Search size={16} /> {busy ? "Looking…" : "Find professors"}
          </button>
        </div>
        <label className="prof-chk prof-assist">
          <input type="checkbox" checked={assist} onChange={(e) => setAssist(e.target.checked)} />
          Let me finish captchas / logins in a browser window if a site blocks the app
        </label>
        {verify && (
          <div className="prof-verify">
            <ShieldAlert size={18} />
            <div className="grow">
              <strong>Waiting for you in the Chrome window · {verify.host}</strong>
              <div className="muted small">
                Finish the “verify you are human” check or log in there. The app continues by itself as soon as the page
                opens. If the page is already fine, press Continue.
              </div>
            </div>
            <button className="btn small" onClick={() => api.post("/api/scrape/verify/continue").catch(() => {})}>
              Continue
            </button>
            <button className="btn small danger-o" onClick={() => api.post("/api/scrape/verify/cancel").catch(() => {})}>
              Cancel
            </button>
          </div>
        )}
        {caps && !caps.browser?.installed && (
          <p className="muted small prof-cap">
            Sites that build their pages with JavaScript need a browser helper. Install it once with{" "}
            <code>npm install playwright-core</code> (it uses your installed Chrome or Edge), then restart the app.
          </p>
        )}
        <details className="prof-adv">
          <summary>Advanced</summary>
          <Field
            label="CSS selector for profile links (optional)"
            hint="Use only if automatic detection misses people. Example: .faculty-list a"
          >
            <input value={selector} onChange={(e) => setSelector(e.target.value)} placeholder=".faculty-list a" />
          </Field>
        </details>

        {found && (
          <div className="prof-found">
            <ul className="prof-sources">
              {found.sources.map((x) => (
                <li key={x.url} className={x.error ? "bad" : ""}>
                  <span className="prof-src-url">{x.url.replace(/^https?:\/\//, "")}</span>
                  {x.error ? (
                    <span>{x.error}</span>
                  ) : (
                    <span>
                      {x.kind === "profile"
                        ? "single profile page"
                        : x.kind === "cards"
                          ? `list with details on the page · ${x.count} people`
                          : `directory · ${x.count} profile links${x.pages > 1 ? ` on ${x.pages} pages` : ""}`}
                      {x.rendered && <em className="chip-s">browser-rendered</em>}
                      {x.verified && <em className="chip-s ok">verified by you</em>}
                      {x.pageUrls?.length > 0 && (
                        <span className="prof-pages">
                          Read: {x.pageUrls.map((u) => u.replace(/^https?:\/\//, "")).join("  ·  ")}
                        </span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="row-between">
              <strong>{found.candidates.length} professor{found.candidates.length === 1 ? "" : "s"} found</strong>
              <div className="row-actions">
                <button className="btn small" onClick={() => setPicked(new Set(found.candidates.map((c) => c.key)))}>
                  All
                </button>
                <button className="btn small" onClick={() => setPicked(new Set())}>
                  None
                </button>
                <button className="btn primary small" disabled={!picked.size} onClick={start}>
                  Scrape {picked.size} professor{picked.size === 1 ? "" : "s"}
                </button>
              </div>
            </div>
            <div className="prof-links">
              {found.candidates.map((c) => (
                <label key={c.key} className="prof-link">
                  <input
                    type="checkbox"
                    checked={picked.has(c.key)}
                    onChange={() =>
                      setPicked((s) => {
                        const n = new Set(s);
                        n.has(c.key) ? n.delete(c.key) : n.add(c.key);
                        return n;
                      })
                    }
                  />
                  <span>{c.text || "(no text)"}</span>
                  {c.confidence === "low" && <em className="chip-s warn">uncertain</em>}
                  <small className="muted">{c.key.replace(/^https?:\/\//, "")}</small>
                </label>
              ))}
            </div>
          </div>
        )}

        {job && (
          <div className="prof-job">
            <div className="row-between">
              <span>
                {job.status === "running" ? "Scraping…" : job.status === "cancelled" ? "Stopped" : "Finished"} {job.done}/
                {job.total}
                {job.last && <span className="muted"> · last: {job.last}</span>}
              </span>
              {job.status === "running" && (
                <button className="btn small" onClick={() => api.post(`/api/scrape/jobs/${job.id}/cancel`)}>
                  <Square size={14} /> Stop
                </button>
              )}
            </div>
            <div className="prof-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            {job.errors.length > 0 && (
              <details>
                <summary className="muted small">{job.errors.length} page(s) could not be read</summary>
                <ul className="prof-errs">
                  {job.errors.map((e) => (
                    <li key={e.url}>
                      <a href={e.url} target="_blank" rel="noreferrer">
                        {e.url}
                      </a>{" "}
                      <span className="muted">{e.error}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="card pad prof-kw">
        <Field
          label="My research interests"
          hint="Comma separated. Used to rank professors by match (saved on this device). Example: machine learning, computer vision, 机器人"
        >
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="machine learning, NLP, robotics" />
        </Field>
      </section>

      <div className="toolbar">
        <div className="input-icon grow">
          <Search size={16} />
          <input placeholder="Search name, email, school, research or notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} disabled={!kws.length}>
          <option value={0}>Any match</option>
          <option value={1}>Match ≥ 1%</option>
          <option value={30}>Match ≥ 30%</option>
          <option value={60}>Match ≥ 60%</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="match">Sort: best match</option>
          <option value="name">Sort: name</option>
          <option value="school">Sort: university</option>
        </select>
        <label className="prof-chk">
          <input type="checkbox" checked={onlyEmail} onChange={(e) => setOnlyEmail(e.target.checked)} /> Has email
        </label>
      </div>

      {sel.size > 0 && (
        <div className="bulkbar">
          <span>{sel.size} selected</span>
          {STATUS.map(([v, l]) => (
            <button key={v} className="btn small" onClick={() => bulkStatus(v)}>
              {l}
            </button>
          ))}
          <button className="btn small danger-o" onClick={remove}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      <section className="card table">
        {!profs ? (
          <div className="spinner" />
        ) : profs.length === 0 ? (
          <Empty icon={<GraduationCap size={28} />} title="No professors yet">
            Paste a faculty-directory link above to build your list.
          </Empty>
        ) : (
          <>
            <div className="prof-row thead">
              <input
                type="checkbox"
                checked={allSel}
                onChange={() => setSel(allSel ? new Set() : new Set(rows.map((p) => p.id)))}
              />
              <span>Professor</span>
              <span>University</span>
              <span>Email</span>
              <span>Research</span>
              <span>Match</span>
              <span>Status</span>
            </div>
            {rows.map((p) => (
              <div key={p.id} className={`prof-row ${sel.has(p.id) ? "sel" : ""}`}>
                <input
                  type="checkbox"
                  checked={sel.has(p.id)}
                  onChange={() =>
                    setSel((s) => {
                      const n = new Set(s);
                      n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                      return n;
                    })
                  }
                />
                <div className="cell-main">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <strong>{p.name || "(unknown)"}</strong> <ExternalLink size={12} />
                  </a>
                  <small>{p.title}</small>
                  <span className="prof-links-mini">
                    {p.homepage && (
                      <a href={p.homepage} target="_blank" rel="noreferrer">
                        homepage
                      </a>
                    )}
                    {p.scholar && (
                      <a href={p.scholar} target="_blank" rel="noreferrer">
                        scholar
                      </a>
                    )}
                    {p.recruiting && (
                      <em className={`chip-s ${p.recruiting === "yes" ? "ok" : "warn"}`} title={p.recruitNote}>
                        {p.recruiting === "yes" ? "mentions recruiting" : "not accepting"}
                      </em>
                    )}
                  </span>
                </div>
                <div className="cell-main">
                  <span>{p.university}</span>
                  <small>{p.department}</small>
                </div>
                <div className="cell-main">
                  {p.email ? (
                    <button
                      className="prof-mail"
                      title="Copy email"
                      onClick={() => {
                        navigator.clipboard?.writeText(p.email);
                        toast("Copied");
                      }}
                    >
                      {p.email} <Copy size={12} />
                    </button>
                  ) : (
                    <span className="muted">not found</span>
                  )}
                  {p.otherEmails && <small>{p.otherEmails}</small>}
                </div>
                <div className="cell-main">
                  {p.discipline && <small className="prof-disc">{p.discipline}</small>}
                  {p.domains?.length > 0 && (
                    <span className="prof-domains">
                      {(openRes.has(p.id) ? p.domains : p.domains.slice(0, 4)).map((d) => (
                        <em key={d} className="chip-s">
                          {d}
                        </em>
                      ))}
                      {!openRes.has(p.id) && p.domains.length > 4 && <em className="chip-s more">+{p.domains.length - 4}</em>}
                    </span>
                  )}
                  <span className={`prof-research ${openRes.has(p.id) ? "open" : ""}`}>
                    {p.research || <span className="muted">not found</span>}
                  </span>
                  {openRes.has(p.id) && p.topics?.length > 0 && (
                    <div className="prof-detail">
                      <strong>Topics</strong>
                      <span className="prof-domains">
                        {p.topics.map((d) => (
                          <em key={d} className="chip-s">
                            {d}
                          </em>
                        ))}
                      </span>
                    </div>
                  )}
                  {openRes.has(p.id) && p.recentPapers?.length > 0 && (
                    <div className="prof-detail">
                      <strong>Recent papers</strong>
                      <ul>
                        {p.recentPapers.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {((p.research || "").length > 150 || p.domains?.length > 4 || p.topics?.length > 0 || p.recentPapers?.length > 0) && (
                    <button
                      className="prof-more"
                      onClick={() =>
                        setOpenRes((s) => {
                          const n = new Set(s);
                          n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                          return n;
                        })
                      }
                    >
                      {openRes.has(p.id) ? "Show less" : "Show more"}
                    </button>
                  )}
                  {p.hits.length > 0 && (
                    <span className="prof-hits">
                      {p.hits.map((h) => (
                        <em key={h} className="chip-s ok">
                          {h}
                        </em>
                      ))}
                    </span>
                  )}
                </div>
                <strong className="prof-score">{kws.length ? `${p.score}%` : "–"}</strong>
                <div className="cell-main">
                  <select value={p.status || "new"} onChange={(e) => patch(p, { status: e.target.value })}>
                    {STATUS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input
                    className="prof-note"
                    placeholder="note"
                    defaultValue={p.notes}
                    onBlur={(e) => e.target.value !== (p.notes || "") && patch(p, { notes: e.target.value })}
                  />
                </div>
              </div>
            ))}
            {rows.length === 0 && <p className="muted pad">No professors match these filters.</p>}
          </>
        )}
      </section>

      {profs?.length > 0 && (
        <div className="prof-foot">
          <span className="muted">
            {rows.length} shown. The Excel file works on the <Link to="/import">Import</Link> page (Name and Email are
            auto-mapped).
          </span>
          <button className="btn primary" onClick={exportXlsx}>
            <Download size={16} /> Export {sel.size ? `${sel.size} selected` : `${rows.length} shown`} to Excel
          </button>
        </div>
      )}
    </div>
  );
}
