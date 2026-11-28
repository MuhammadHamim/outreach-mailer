// Professor Finder: finds profile links on a faculty-directory page, visits each profile and extracts
// name, title, university/department, email, research interests, links. Public pages only, polite by design:
// obeys robots.txt, max 3 parallel requests, per-host delay, blocks private/internal addresses.
import dns from "node:dns/promises";
import net from "node:net";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import * as db from "./db.js";
import { newId } from "./db.js";
import { renderPage, renderInteractive } from "./render.js";

const UA =
  "OutreachMailer-ProfessorFinder/1.0 (personal admissions research; polite crawler; obeys robots.txt)";
const TIMEOUT_MS = 15000;
const MAX_BYTES = 2_000_000;
const HOST_GAP_MS = 400;
const CONCURRENCY = 3;
const MAX_URLS_PER_JOB = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// ---------- safety: only public http(s) hosts ----------
const isPrivateIp = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) {
    const rest = v.slice(7);
    return net.isIPv4(rest) ? isPrivateIp(rest) : true;
  }
  return (
    v === "::1" ||
    v === "::" ||
    /^f[cd]/.test(v) ||
    /^fe[89ab]/.test(v)
  );
};

async function assertPublic(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) links are allowed");
  if (process.env.SCRAPER_ALLOW_PRIVATE === "1") return u; // testing only
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal"))
    throw new Error("Local addresses are not allowed");
  const ips = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) throw new Error(`Could not resolve ${host}`);
  if (ips.some(isPrivateIp)) throw new Error("Private/internal addresses are not allowed");
  return u;
}

// ---------- polite fetching ----------
const hostNext = new Map();
async function throttle(host) {
  const now = Date.now();
  const at = Math.max(now, hostNext.get(host) || 0);
  hostNext.set(host, at + HOST_GAP_MS);
  if (at > now) await sleep(at - now);
}

function decode(buf, type) {
  let cs = /charset=([\w-]+)/i.exec(type || "")?.[1];
  if (!cs) cs = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 3000).toString("latin1"))?.[1];
  try {
    return new TextDecoder(cs || "utf-8").decode(buf); // handles GBK / GB2312 used by many Chinese sites
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

async function rawFetch(url, { maxBytes = MAX_BYTES } = {}) {
  let cur = url;
  for (let hop = 0; hop < 6; hop++) {
    const u = await assertPublic(cur);
    await throttle(u.hostname);
    const res = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        "accept-language": "en,zh-CN;q=0.8",
      },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      res.body?.cancel?.();
      cur = new URL(loc, u).href;
      continue;
    }
    const chunks = [];
    let n = 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        n += value.length;
        if (n > maxBytes) {
          reader.cancel();
          throw new Error("Page is too large");
        }
        chunks.push(value);
      }
    }
    const type = res.headers.get("content-type") || "";
    return { status: res.status, url: u.href, type, text: decode(Buffer.concat(chunks), type) };
  }
  throw new Error("Too many redirects");
}

// ---------- robots.txt ----------
const robotsCache = new Map();
function parseRobots(text) {
  const rules = [];
  let applies = false,
    lastWasUA = false;
  for (const line of text.split(/\r?\n/)) {
    const m = line.replace(/#.*/, "").match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const k = m[1].toLowerCase(),
      v = m[2];
    if (k === "user-agent") {
      if (!lastWasUA) applies = false;
      if (v === "*") applies = true;
      lastWasUA = true;
    } else {
      lastWasUA = false;
      if (applies && (k === "disallow" || k === "allow") && v) rules.push({ allow: k === "allow", path: v });
    }
  }
  return rules;
}
async function robotsAllows(u) {
  const origin = u.origin;
  if (!robotsCache.has(origin)) {
    let rules = [];
    try {
      const r = await rawFetch(`${origin}/robots.txt`, { maxBytes: 200_000 });
      if (r.status === 200 && !/html/i.test(r.type)) rules = parseRobots(r.text);
    } catch {
      /* no robots.txt reachable: nothing is disallowed */
    }
    robotsCache.set(origin, rules);
  }
  const target = u.pathname + u.search;
  let best = null;
  for (const r of robotsCache.get(origin)) {
    const re = new RegExp(
      "^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
    );
    if (re.test(target) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)))
      best = r;
  }
  return !best || best.allow;
}

class BlockedError extends Error {
  constructor(message, html = "") {
    super(message);
    this.blocked = true;
    this.html = html;
  }
}

async function fetchHtml(url) {
  const u = await assertPublic(url);
  if (!(await robotsAllows(u))) throw new Error("Blocked by the site's robots.txt");
  const r = await rawFetch(u.href);
  if (r.status < 200 || r.status >= 300) {
    if ([401, 403, 429, 503].includes(r.status)) throw new BlockedError(`HTTP ${r.status}`, r.text);
    throw new Error(`HTTP ${r.status}`);
  }
  if (r.type && !/html|xml|text/i.test(r.type)) throw new Error("Not an HTML page");
  return { html: r.text, url: r.url };
}

// ---------- captcha / "verify you are human" / login walls ----------
// Returns "challenge", "login" or "" for a page that is a normal page. Only small pages are judged by their wording,
// so a real profile that merely mentions "captcha" in a contact form is not mistaken for a check.
export function detectBlock(html) {
  const raw = String(html || "");
  if (/_cf_chl_opt|cf-challenge-running|id=["']challenge-form["']|id=["']cf-challenge/i.test(raw)) return "challenge";
  const $ = cheerio.load(raw);
  const title = clean($("title").first().text());
  const anchors = $("a[href]").length;
  const mailto = $("a[href^='mailto:' i]").length;
  const password = $("input[type=password]").length;
  $("script,style,noscript").remove();
  const text = clean($("body").text());
  const small = text.length < 2500 && anchors < 25;
  if (
    small &&
    (/^(just a moment|attention required|access denied|security check|are you (a )?(human|robot)|human verification|verifying|one more step|pardon our interruption|robot or human|请稍候|安全验证|人机验证)/i.test(title) ||
      /(verify (that )?you are (a )?human|verifying you are human|prove you are (a )?human|checking (if the site connection is secure|your browser)|enable javascript and cookies to continue|complete the (security )?check|unusual traffic|access denied|are you a robot|i['’]m not a robot|请完成安全验证|人机验证|安全验证)/i.test(text))
  )
    return "challenge";
  if (text.length < 600 && /captcha|验证码/i.test(text)) return "challenge";
  if (password && small && !mailto) return "login";
  return "";
}

const BLOCKED_MSG =
  "This site is asking for a human check or a login (Cloudflare, captcha or similar). Set Render JavaScript to Auto and tick “Let me finish captchas / logins in a browser window”, then try again.";
const verifiedHosts = new Set(); // sites where you already finished a check: later pages go straight through the visible browser

// Static fetch first; fall back to a real browser only when the plain HTML is not usable (JavaScript-built pages).
// If the site blocks the app (captcha, Cloudflare, login) and `assist` is on, a visible browser window opens and
// the app waits for you to finish the check. mode: "auto" | "always" | "never". `usable(result)` says whether the plain HTML was good enough.
async function loadParsed(url, mode, usable, { assist = false } = {}) {
  const u = await assertPublic(url);
  if (!(await robotsAllows(u))) throw new Error("Blocked by the site's robots.txt");
  // A link like site/#/people?school=CS keeps its filter after the "#", which plain downloads never send to the server:
  // such a link must be opened in a browser or you would get the unfiltered base page.
  if (mode === "auto" && /[=&/?]/.test(u.hash.slice(1))) mode = "always";
  const canAsk = assist && mode !== "never";
  const viaPerson = async () => {
    verifiedHosts.add(u.hostname);
    return { ...(await renderInteractive(u.href, { guard: assertPublic, isBlocked: detectBlock })), rendered: true, verified: true };
  };
  if (canAsk && verifiedHosts.has(u.hostname)) return viaPerson();

  let r;
  try {
    r =
      mode === "always"
        ? { ...(await renderPage(u.href, { guard: assertPublic })), rendered: true }
        : { ...(await fetchHtml(u.href)), rendered: false };
  } catch (e) {
    if (!e.blocked) throw e;
    r = { html: e.html || "", url: u.href, rendered: false, blocked: true };
  }
  if (r.blocked || detectBlock(r.html)) {
    if (!canAsk) throw new Error(BLOCKED_MSG);
    return viaPerson();
  }
  if (mode === "always" || mode === "never" || usable(r)) return r;
  try {
    const rr = { ...(await renderPage(r.url, { guard: assertPublic })), rendered: true };
    if (detectBlock(rr.html)) {
      if (!canAsk) throw new Error(BLOCKED_MSG);
      return await viaPerson();
    }
    return rr;
  } catch (e) {
    return { ...r, rendered: false, renderError: e.message };
  }
}

const normalizeUrl = (s) => {
  let t = String(s || "").trim();
  if (!t) throw new Error("Enter a link first");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) && !/^https?:\/\//i.test(t)) throw new Error("Only http(s) links are allowed");
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  try {
    return new URL(t).href;
  } catch {
    throw new Error("That does not look like a valid link");
  }
};

// ---------- finding profile links on a directory page ----------
const BANNED_WORDS = new Set(
  "home about news contact more read view profile profiles faculty staff people research teaching login search next previous prev back top page us our department school university college institute center centre lab laboratory group publications courses students alumni events admissions programs program directory list all click here details website homepage email phone office apply give visit tour library career careers jobs privacy sitemap copyright english chinese menu skip content main".split(
    " ",
  ),
);
const BANNED_CJK = /^(首页|更多|详情|详细|下一页|上一页|末页|尾页|返回|查看|English|中文|联系我们|登录|搜索|个人主页|主页)$/;
const PARTICLES = new Set(["van", "von", "de", "der", "den", "da", "di", "del", "la", "le", "bin", "al", "el", "ten", "ter"]);

export function looksLikeName(raw) {
  let t = clean(raw);
  for (;;) {
    const n = t.replace(/^(prof(essor)?|dr|mr|ms|mrs|assoc(iate)?|asst|assistant|emeritus)\.?\s+/i, "");
    if (n === t) break;
    t = n;
  }
  t = clean(t.replace(/,/g, " "));
  if (!t || t.length > 60 || BANNED_CJK.test(t)) return false;
  if (/^[\u4e00-\u9fff·]{2,5}$/.test(t)) return true;
  const w = t.split(" ");
  if (w.length < 2 || w.length > 5) return false;
  if (w.some((x) => BANNED_WORDS.has(x.toLowerCase()))) return false;
  return w.every(
    (x, i) => (i > 0 && i < w.length - 1 && PARTICLES.has(x.toLowerCase())) || /^\p{Lu}[\p{L}'’.-]*$/u.test(x),
  );
}

const baseDomain = (h) => {
  const p = h.split(".");
  const n = p.length >= 3 && ["ac", "edu", "co", "com", "gov", "org", "net"].includes(p.at(-2)) ? 3 : 2;
  return p.slice(-n).join(".");
};
const SKIP_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|jpe?g|png|gif|svg|webp|mp[34]|avi|css|js)$/i;
const LOOSE_PATH = /(people|person|faculty|staff|profile|teacher|member|\/~|szdw|jsjs|szll|jiaoshi|laoshi)/i;

const anchorText = ($, a) =>
  clean($(a).text()) || clean($(a).attr("title")) || clean($(a).find("img").attr("alt")) || "";

export function findCandidates($, pageUrl, { selector = "" } = {}) {
  const base = new URL(pageUrl);
  const here = base.href.split("#")[0].replace(/\/$/, "");
  const bd = baseDomain(base.hostname);
  const out = new Map();
  let anchors;
  if (selector) {
    anchors = $(selector)
      .toArray()
      .flatMap((el) => (el.name === "a" ? [el] : $(el).find("a[href]").toArray()));
  } else anchors = $("a[href]").toArray();
  for (const a of anchors) {
    const raw = ($(a).attr("href") || "").trim();
    if (!raw || /^(#|mailto:|tel:|javascript:)/i.test(raw)) continue;
    let u;
    try {
      u = new URL(raw, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = "";
    if (SKIP_EXT.test(u.pathname)) continue;
    if (!selector && baseDomain(u.hostname) !== bd) continue;
    const href = u.href;
    if (href.replace(/\/$/, "") === here) continue;
    const text = anchorText($, a);
    let confidence = "";
    if (selector || looksLikeName(text)) confidence = "high";
    else if (
      LOOSE_PATH.test(u.pathname) &&
      text.length >= 2 &&
      text.length <= 60 &&
      !text.split(/\s+/).some((w) => BANNED_WORDS.has(w.toLowerCase())) &&
      !BANNED_CJK.test(text)
    )
      confidence = "low";
    if (!confidence) continue;
    const old = out.get(href);
    if (!old || (confidence === "high" && old.confidence !== "high") || (!old.text && text))
      out.set(href, { url: href, text, confidence });
  }
  return [...out.values()];
}

const PAGE_KEYS = ["page", "p", "pg", "pageno", "pagenum", "pagenumber", "paged", "currentpage", "pn"];
const NEXT_TEXT = /^(next( page)?|older( posts?)?|下一页|下页|后一页|下一頁|›|»|>|>>|→|▶)(\s*(page|›|»|>|→|▶))?$/i;
const PREV_HINT = /prev|previous|back|older|上一|前一/i;

// Finds the link to the next page of a listing. Tries, in order: rel="next"; a "Next" link (text, aria-label, title or class);
// then numbered pagers (current page number + 1). Works for 0-based (?page=1 is the 2nd page) and 1-based pagers.
export function findNext($, pageUrl) {
  const cur = new URL(pageUrl);
  const curHref = cur.href.split("#")[0].replace(/\/$/, "");
  const abs = (href) => {
    if (!href || /^(#|javascript:|mailto:|tel:)/i.test(String(href).trim())) return null;
    try {
      const u = new URL(href, pageUrl);
      u.hash = "";
      return /^https?:$/.test(u.protocol) ? u.href : null;
    } catch {
      return null;
    }
  };
  const take = (href) => {
    const u = abs(href);
    return u && u.replace(/\/$/, "") !== curHref ? u : null;
  };

  // 1) explicit markers
  for (const h of [$('a[rel~="next"]').first().attr("href"), $('link[rel="next"]').first().attr("href")]) {
    const u = take(h);
    if (u) return u;
  }
  // 2) a "Next" link: by its text, aria-label / title, or class name (also on the <li> around it)
  let found = null;
  $("a[href]").each((_, a) => {
    const el = $(a);
    const text = clean(el.text());
    const label = `${el.attr("aria-label") || ""} ${el.attr("title") || ""}`;
    const cls = `${el.attr("class") || ""} ${el.parent().attr("class") || ""}`;
    if (PREV_HINT.test(`${label} ${cls}`) && !/\bnext\b/i.test(`${label} ${cls}`)) return;
    if (/^(prev|previous|back|上一页|上页|‹|«|<|←)/i.test(text)) return;
    const hit = NEXT_TEXT.test(text) || /\bnext\b|下一页/i.test(label) || /(^|[^a-z])next([^a-z]|$)/i.test(cls);
    if (!hit) return;
    const u = take(el.attr("href"));
    if (u) {
      found = u;
      return false;
    }
  });
  if (found) return found;

  // 3) numbered pager: find the current number, then the link whose text is current + 1
  const links = [];
  $("a[href]").each((_, a) => {
    const t = clean($(a).text());
    if (!/^\d{1,4}$/.test(t)) return;
    const u = abs($(a).attr("href"));
    if (!u) return;
    const x = new URL(u);
    if (x.origin === cur.origin && (x.pathname === cur.pathname || /(^|\/)(page|p)[/-]?\d+/i.test(x.pathname))) links.push({ n: Number(t), href: u, a });
  });
  if (!links.length) return null;
  const nums = new Set(links.map((l) => l.n));
  const keyOf = (href) => {
    const sp = new URL(href).searchParams;
    return PAGE_KEYS.find((k) => sp.has(k));
  };
  let curN = null;
  // (a) a number in the pager that is not a link is the page we are on
  const box = $(links[0].a).closest("nav, ul, ol");
  if (box.length) {
    // read element by element: minified pagers have no spaces between items ("1234")
    const tokens = box
      .find("*")
      .toArray()
      .filter((el) => !$(el).children().length)
      .map((el) => clean($(el).text()))
      .filter((t) => /^\d{1,4}$/.test(t))
      .map(Number)
      .filter((n) => !nums.has(n));
    if (tokens.length === 1) curN = tokens[0];
  }
  // (b) otherwise from the address: the link text and its ?page= value tell whether the pager is 0- or 1-based
  if (curN === null) {
    const k = keyOf(links[0].href);
    const kv = k && cur.searchParams.get(k);
    if (k && kv !== null && /^\d+$/.test(kv)) {
      const off = Number(new URL(links[0].href).searchParams.get(k)) - links[0].n;
      curN = Number(kv) - off;
    } else curN = 1; // no page parameter: this is the first page
  }
  const nxt = links.find((l) => l.n === curN + 1);
  return nxt ? take(nxt.href) : null;
}

export async function discover(input, { selector = "", pages = 1, render = "auto", assist = true } = {}) {
  const list = [
    ...new Set((Array.isArray(input) ? input : String(input || "").split(/\s+/)).map((x) => String(x).trim()).filter(Boolean)),
  ];
  if (!list.length) throw new Error("Enter a link first");
  if (list.length > 30) throw new Error("Please add at most 30 links at a time");
  const mode = ["auto", "always", "never"].includes(render) ? render : "auto";
  const limit = Math.min(Math.max(Number(pages) || 1, 1), 15);
  const sources = [];
  const all = new Map();
  const add = (c) => {
    const old = all.get(c.key);
    if (!old || (c.confidence === "high" && old.confidence !== "high")) all.set(c.key, c);
  };
  for (const raw of list) {
    const src = { url: raw, kind: "error", title: "", count: 0, pages: 1, rendered: false, verified: false, pageUrls: [], error: "" };
    sources.push(src);
    try {
      const start = normalizeUrl(raw);
      src.url = start;
      const page = await loadParsed(start, mode, (r) => classify(r, { selector }).kind !== "unknown", { assist });
      src.rendered = page.rendered;
      src.verified = !!page.verified;
      const cls = classify(page, { selector });
      src.title = clean(cls.$("title").first().text());
      const base = { sourceUrl: start, sourceTitle: src.title, render: page.rendered };
      if (cls.kind === "profile") {
        src.kind = "profile";
        src.count = 1;
        add({ ...base, key: page.url, url: page.url, text: cls.prof.name, confidence: "high", direct: true });
      } else if (cls.kind === "cards") {
        src.kind = "cards";
        for (const c of cls.cards) {
          if (!c.name && !c.email) continue;
          src.count++;
          add({ ...base, key: c.url, url: start, card: c.i, text: c.name || c.email, confidence: "high" });
        }
      } else if (cls.kind === "directory" || cls.kind === "unknown") {
        let cands = cls.hi;
        if (cls.kind === "unknown") {
          cands = findCandidates(cls.$, page.url, { selector });
          if (!cands.length) {
            src.error =
              page.renderError ||
              (mode === "never"
                ? "No professors recognised on this page. Try “Render JavaScript: Auto”."
                : "No professors or profile links recognised on this page.");
            continue;
          }
        }
        src.kind = "directory";
        const visited = new Set([page.url]);
        const seenKeys = new Set();
        src.pageUrls = [page.url];
        let cur = page,
          $ = cls.$;
        for (let i = 1; ; i++) {
          for (const c of cands) {
            if (seenKeys.has(c.url)) continue;
            seenKeys.add(c.url);
            src.count++;
            add({ ...base, key: c.url, url: c.url, text: c.text, confidence: c.confidence });
          }
          const next = i < limit ? findNext($, cur.url) : null;
          if (!next || visited.has(next)) break;
          visited.add(next);
          const nextPage = await loadParsed(next, page.rendered ? "always" : mode, () => true, { assist });
          const nextCands = findCandidates(cheerio.load(nextPage.html), nextPage.url, { selector });
          if (!nextCands.some((c) => !seenKeys.has(c.url))) break; // nothing new on that page: stop
          cur = nextPage;
          $ = cheerio.load(cur.html);
          cands = nextCands;
          src.pages++;
          src.pageUrls.push(cur.url);
        }
      }
    } catch (e) {
      src.error = e.message || "Failed";
    }
  }
  return { sources, candidates: [...all.values()].slice(0, 500) };
}

// ---------- extracting one profile ----------
const GENERIC_LOCAL = /^(info|admin|office|contact|webmaster|noreply|no-reply|dept|department|enquiries|inquiries|admissions|support|hello|mail|secretary|service)$/i;
const BAD_TLD = /\.(png|jpe?g|gif|svg|webp|css|js|ico)$/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;

const cfDecode = (hex) => {
  const k = parseInt(hex.slice(0, 2), 16);
  let o = "";
  for (let i = 2; i < hex.length; i += 2) o += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
  return o;
};

export function deobfuscate(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\s*[[({]\s*at\s*[\])}]\s*/gi, "@")
    .replace(/\s*[[({]\s*dot\s*[\])}]\s*/gi, ".")
    .replace(/([\w.+-]+)\s+AT\s+([\w-]+(?:\s*(?:\.|DOT)\s*[\w-]+)+)/g, (_, a, b) => `${a}@${b.replace(/\s*(?:DOT)\s*/g, ".").replace(/\s+/g, "")}`)
    .replace(/([\w.+-]+)\s+at\s+((?:[\w-]+\.)+(?:edu(?:\.\w+)?|ac\.\w+))\b/g, "$1@$2");
}

function extractEmails($, pageUrl) {
  const pageBase = baseDomain(new URL(pageUrl).hostname);
  const found = new Map(); // email -> score
  const add = (e, bonus) => {
    e = e.trim().replace(/[.,;:)>\]]+$/, "").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) || BAD_TLD.test(e)) return;
    let s = bonus - found.size * 0.01;
    if (GENERIC_LOCAL.test(e.split("@")[0])) s -= 5;
    const d = e.split("@")[1];
    if (baseDomain(d) === pageBase) s += 3;
    else if (/\.(edu|ac)(\.|$)/.test(d)) s += 2;
    if (!found.has(e) || found.get(e) < s) found.set(e, s);
  };
  $("a[href^='mailto:' i]").each((_, a) => {
    const h = decodeURIComponent($(a).attr("href").slice(7)).split("?")[0];
    h.split(/[,;]/).forEach((x) => add(x, 4));
  });
  $("[data-cfemail]").each((_, el) => add(cfDecode($(el).attr("data-cfemail")), 4));
  $("a[href*='email-protection#']").each((_, a) => add(cfDecode($(a).attr("href").split("#")[1] || ""), 4));
  const body = $("body").clone();
  body.find("script,style,noscript").remove();
  const text = deobfuscate(linesOf($, body).join("\n"));
  for (const m of text.matchAll(EMAIL_RE)) add(m[0], 1);
  return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
}

const BLOCKS = "p,div,li,tr,h1,h2,h3,h4,h5,h6,dt,dd,section,article,header,footer,table,ul,ol,td,th,blockquote";
function linesOf($, c) {
  c.find("br").replaceWith("\n");
  c.find(BLOCKS).each((_, el) => {
    $(el).append("\n");
  });
  return c
    .text()
    .split("\n")
    .map(clean)
    .filter(Boolean);
}
function pageLinesRaw($) {
  const root = $("main, article, [role=main], #content, .content").filter((_, el) => $(el).text().length > 300).first();
  const c = (root.length ? root : $("body")).clone();
  c.find("script,style,noscript,svg,iframe,form,select,option,nav,footer,aside").remove();
  return linesOf($, c);
}
// Text that is page furniture, not information about the person: charts ("Research output 2013: 2 …"), counters, portal boilerplate.
const NOISE_LINE =
  /research output\s*\d{4}\s*:|research activity per year|calculated based on number of publications|dive into the research topics|these topic labels come from|together they form a unique fingerprint|^(?:\d[\d,]*\s*)?(?:citations?|h-index)$|collaborations and top research areas|recent external collaboration|^[\d\s.,:;()%\-–]+$/i;
const pageLines = ($) => pageLinesRaw($).filter((l) => !NOISE_LINE.test(l));

const SPECIFIC =
  "research\\s+(?:interests?|areas?|fields?|focus|topics?|directions?|themes?)|(?:areas?|fields?)\\s+of\\s+(?:research|interest|expertise|specialization)|interests?|expertise|specializations?|研究方向|研究领域|研究兴趣|主要研究方向|主要研究领域|研究内容|科研方向|学术方向|研究专长";
const GENERIC = "research|research\\s+summary|current\\s+research|研究简介|科研情况";
const lblRe = (src) => ({
  inline: new RegExp(`^(?:${src})\\s*[:：]\\s*(\\S.*)$`, "i"),
  block: new RegExp(`^(?:${src})\\s*[:：]?$`, "i"),
});
const SECTION =
  /^(?:education|publications?|selected publications?|recent publications?|teaching|courses?|awards?|honou?rs|biography|bio|contact|experience|positions?|professional (?:experience|activities|service)|academic (?:background|positions?)|students?|news|projects?|grants?|funding|links?|cv|office|address|phone|e-?mail|教育背景|教育经历|工作经历|代表性?论文|发表论文|论文|荣誉|获奖|联系方式|个人简介|招生|教学|学术兼职|科研项目|项目|主讲课程|社会兼职|电子邮件|邮箱|办公室|电话|地址|research achievements?|research output|fingerprint|network|similar profiles|personal profile|scientific research awards?|expertise related to .*|discipline|overview)\s*[:：]?$/i;

// Dates / degrees / jobs: that is a CV, not a research direction (some profiles paste their education under "Research Interests").
const YEAR = /\b(?:19|20)\d{2}\b/g;
const BIO_WORDS =
  /\b(?:bachelor|master['’]?s|ph\.?d|doctorate|postdoc(?:toral)?|lecturer|studied|graduated|obtained (?:his|her|a)|(?:associate|assistant) professor|teacher)\b|学士|硕士|博士|毕业/i;
export const isBiographical = (t) => {
  const years = (String(t).match(YEAR) || []).length;
  return years >= 2 || (years >= 1 && BIO_WORDS.test(t));
};
const AWARD_WORDS = /\b(?:award|prize|won|honou?rs?|scholarship|medal|distinguished|winner)\b|获奖|奖/i;
const stripNo = (p) => p.replace(/^\s*[(（]?\d{1,2}\s*[.,、)）]\s*/, "").trim(); // "1. radar" / "3, radar" / "2、雷达"

function grabLabelled(lines, src, accept = () => true) {
  const { inline, block } = lblRe(src);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(inline);
    if (m) {
      if (accept(m[1])) return [m[1]];
      continue;
    }
    if (lines[i].length <= 40 && block.test(lines[i])) {
      const parts = [];
      let len = 0;
      for (let j = i + 1; j < lines.length && parts.length < 10 && len < 900; j++) {
        if (SECTION.test(lines[j]) || (lines[j].length <= 30 && /[:：]$/.test(lines[j]))) break;
        parts.push(lines[j]);
        len += lines[j].length;
      }
      if (parts.length && accept(parts.join(" "))) return parts;
    }
  }
  return null;
}
const joinParts = (parts) => {
  const ps = parts.map(stripNo).filter(Boolean);
  return (ps.length > 1 && ps.every((p) => p.length < 90) ? ps.join("; ") : ps.join(" ")).slice(0, 1000);
};

// ---------- working domains: short phrases from the research text, the discipline, and publication titles ----------
export function domainsFrom(text) {
  const out = [];
  for (const raw of String(text || "").split(/[;；\n、，,]|\s\/\s|\.\s+(?=[A-Z])/)) {
    const t = stripNo(raw)
      .replace(/^(?:research|main|mainly)\s+(?:interests?|directions?|areas?|fields?)\s*[:：-]?\s*/i, "")
      .replace(/[.。:：\s]+$/, "")
      .trim();
    if (t.length < 3 || t.length > 70 || /^\d+$/.test(t) || isBiographical(t)) continue;
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}

const STOP = new Set(
  "a an the of for and or in on to with by from at as is are be via using based use used new novel study studies analysis method methods approach approaches towards toward under over into its their our two three one case effect effects research application applications model models performance improved improving enhanced enhancement design designed development developing technique techniques results result high low large small".split(" "),
);
// Most frequent phrases in a person's paper titles = what they actually work on.
export function keywordsFromTitles(titles, max = 8) {
  const uni = new Map(),
    bi = new Map();
  for (const t of titles) {
    const w = String(t).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
    const seenU = new Set(),
      seenB = new Set();
    for (let i = 0; i < w.length; i++) {
      if (w[i].length > 2 && !STOP.has(w[i]) && !/^\d+$/.test(w[i])) seenU.add(w[i]);
      if (i + 1 < w.length && !STOP.has(w[i]) && !STOP.has(w[i + 1]) && w[i].length > 2 && w[i + 1].length > 2) seenB.add(`${w[i]} ${w[i + 1]}`);
    }
    seenU.forEach((x) => uni.set(x, (uni.get(x) || 0) + 1));
    seenB.forEach((x) => bi.set(x, (bi.get(x) || 0) + 1));
  }
  const min = Math.max(2, Math.ceil(titles.length * 0.12));
  const out = [];
  for (const [k] of [...bi].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1])) {
    if (!out.some((o) => o.includes(k) || k.includes(o))) out.push(k);
    if (out.length >= max) break;
  }
  for (const [k] of [...uni].filter(([, n]) => n >= min + 1).sort((a, b) => b[1] - a[1])) {
    if (out.length >= max) break;
    if (!out.some((o) => o.split(" ").includes(k))) out.push(k);
  }
  return out.map((x) => x.replace(/\b\w/g, (c) => c.toUpperCase()));
}

// Topic chips of a Pure "Fingerprint" block (Elsevier's labels drawn from the person's papers)
const SUBJECT_AREA =
  /^(?:engineering|materials science|computer science|physics and astronomy|chemistry|mathematics|earth and planetary sciences|chemical engineering|energy|environmental science|social sciences|medicine and dentistry|agricultural and biological sciences|biochemistry,? genetics and molecular biology|decision sciences|business,? management and accounting|economics,? econometrics and finance|arts and humanities|neuroscience|psychology|immunology and microbiology|pharmacology,? toxicology and pharmaceutics|nursing|health professions|veterinary|multidisciplinary|engineering\s*&\s*materials science)$/i;
function fingerprintTopics($, raw) {
  const out = [];
  const add = (t) => {
    const x = clean(String(t).replace(/\s*\d{1,3}\s*%$/, ""));
    if (x.length >= 3 && x.length <= 60 && !SUBJECT_AREA.test(x) && !out.some((o) => o.toLowerCase() === x.toLowerCase())) out.push(x);
  };
  $(".concept, .concept-badge-large .textual, .fingerprint .concept").each((_, el) => {
    add($(el).children().length ? clean($(el).children().first().text()) : clean($(el).text()));
  });
  if (!out.length) {
    const i = raw.findIndex((l) => /dive into the research topics/i.test(l));
    if (i >= 0)
      for (const l of raw.slice(i + 1, i + 60)) {
        if (/^(?:network|similar profiles|collaborations|research output|recent|profiles|overview|\d+\s+similar)/i.test(l)) break;
        add(l);
      }
  }
  return out.slice(0, 12);
}

const POSITION =
  /((?:distinguished|associate|assistant|adjunct|emeritus|research|visiting|clinical|senior|full|chair)\s+)?(professor|lecturer|reader|researcher|scientist|principal investigator)|教授|副教授|助理教授|讲师|研究员|副研究员|助理研究员|博士生导师|特聘教授|长聘教授/i;
const RECRUIT_POS =
  /(prospective (?:phd |graduate |master'?s )?students|(?:looking|seeking) for (?:\w+ ){0,3}(?:students|phd|postdocs?|interns?)|(?:i am|we are) (?:currently )?(?:recruiting|hiring|accepting)|openings?|open positions?|accepting (?:new )?(?:phd |graduate )?students|recruit(?:ing|s)?|招收|招生|欢迎.{0,12}(?:报考|加入|联系|申请)|诚招)/i;
const RECRUIT_NEG =
  /(not (?:currently )?(?:accepting|taking|recruiting|looking|hiring)|no (?:new )?(?:openings|positions|students)|unable to (?:accept|take)|不招|暂不招|不再招)/i;

const UNI_RE = /universit|大学|\bETH\b|polytechnic|institute of technology|學院大學/i;
const DEPT_RE = /department|dept\.|school of|faculty of|division of|center for|centre for|laborator|college of|institute|系|学院|研究所|研究院|中心|实验室/i;
export function parseOrg(title) {
  const segs = String(title || "")
    .split(/\s*[|｜\-–—_·»›]\s*|\s{2,}/)
    .map(clean)
    .filter(Boolean);
  let university = "",
    department = "";
  for (const s of segs) {
    if (!university && UNI_RE.test(s)) university = s;
    else if (!department && DEPT_RE.test(s) && !/^(faculty|people|staff|home|directory)$/i.test(s)) department = s;
  }
  return { university, department };
}

const cleanName = (s) => {
  let n = clean(s)
    .replace(/^(?:(?:prof(?:essor)?|dr|mr|ms|mrs|assoc(?:iate)?|asst|assistant)\.?\s+)+/i, "")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/\s*(教授|副教授|助理教授|讲师|研究员|副研究员|老师|博导|博士生导师)\s*$/, "");
  const first = n.split(/[,，|｜]/)[0];
  if (first && looksLikeName(first)) n = first;
  n = clean(n);
  return /^[\u4e00-\u9fff\s·]+$/.test(n) ? n.replace(/\s+/g, "") : n;
};

export function extractProfile(html, url, { hintName = "", sourceTitle = "" } = {}) {
  const $ = cheerio.load(html);
  const emails = extractEmails($, url);

  // name: link text from the directory is usually the cleanest; fall back to <h1>, then <title>
  const h1 = clean($("h1").first().text());
  const titleTag = clean($("title").first().text());
  const titleParts = titleTag.split(/\s*[|｜\-–—_·]\s*/).map(clean);
  const cands = [hintName, h1, ...titleParts].map(cleanName);
  const name = cands.find((c) => looksLikeName(c)) || cleanName(hintName) || cleanName(h1);

  const raw = pageLinesRaw($);
  const lines = raw.filter((l) => !NOISE_LINE.test(l));

  // title / position
  let title = "";
  for (const l of lines.slice(0, 45)) {
    if (l.length <= 120 && POSITION.test(l)) {
      const t = l.replace(/^(?:title|position|职称|职务)\s*[:：]\s*/i, "");
      title = (name && t.includes(name) ? t.match(POSITION)[0] : t).slice(0, 90);
      break;
    }
  }

  // research interests: a "Research Interests" block that is really research (not a CV pasted by mistake) ...
  const okInterest = (t) => t.trim().length >= 3 && !isBiographical(t);
  const parts = grabLabelled(lines, SPECIFIC, okInterest) || grabLabelled(lines, GENERIC, okInterest);
  let research = parts ? joinParts(parts) : "";
  let researchSource = research ? "labeled" : "";
  // ... otherwise the "Research Achievement" paragraph (when it is not just a list of awards) ...
  if (!research) {
    const ra = grabLabelled(
      lines,
      "research\\s+achievements?|research\\s+summary|research\\s+experience",
      (t) => okInterest(t) && !AWARD_WORDS.test(t) && !/^none\b/i.test(t.trim()),
    );
    if (ra) {
      research = joinParts(ra);
      researchSource = "profile";
    }
  }
  // ... otherwise the page description / a long paragraph about research
  if (!research) {
    const meta = clean($('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content"));
    const para = lines.find((l) => l.length >= 100 && /research|interest|work on|focus|研究/i.test(l) && !isBiographical(l));
    research = (meta.length > 40 && !NOISE_LINE.test(meta) ? meta : para || "").slice(0, 700);
    if (research) researchSource = "summary";
  }
  const disc = lines.map((l) => l.match(/^discipline\s*[:：]\s*(.{3,80})$/i)).find(Boolean);
  const discipline = disc ? clean(disc[1]) : "";
  const topics = fingerprintTopics($, raw);
  const dom = domainsFrom(researchSource === "labeled" || researchSource === "structured" ? research : "");

  // recruiting hint
  let recruiting = "",
    recruitNote = "";
  const rl = lines.find((l) => l.length <= 400 && RECRUIT_POS.test(l));
  if (rl) {
    recruitNote = rl.slice(0, 200);
    recruiting = RECRUIT_NEG.test(rl) ? "no" : "yes";
  }

  // organisation
  const siteName = clean($('meta[property="og:site_name"]').attr("content"));
  let { university, department } = parseOrg(titleTag);
  const fb = parseOrg(sourceTitle);
  if (!university) university = fb.university || siteName;
  if (!department) {
    const dl = lines
      .slice(0, 20)
      .find(
        (l) =>
          (l.length <= 90 && /^(?:department|school|faculty|college|institute|division|cent(?:er|re)|laboratory)\s+of\s+\S/i.test(l)) ||
          (l.length <= 25 && /(学院|系|研究所|研究院|实验室)$/.test(l)),
      );
    department = dl || fb.department;
  }
  const ld = fromJsonLd($);
  if (!university) university = ld.university;
  if (!university) university = new URL(url).hostname.replace(/^www\./, "");

  // links
  let homepage = "",
    scholar = "",
    dblp = "",
    orcid = "";
  const pageHost = new URL(url).hostname;
  $("a[href]").each((_, a) => {
    let u;
    try {
      u = new URL($(a).attr("href"), url);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    if (!scholar && /scholar\.google\./.test(u.hostname)) scholar = u.href;
    else if (!dblp && /dblp\.(org|uni-trier\.de)/.test(u.hostname)) dblp = u.href;
    else if (!orcid && /orcid\.org/.test(u.hostname)) orcid = u.href;
    else if (
      !homepage &&
      u.hostname !== pageHost &&
      /home\s?page|personal\s+(?:web\s?)?(?:site|page)|website|个人主页|个人网站|个人网页|主页/i.test(clean($(a).text()))
    )
      homepage = u.href;
  });

  const finalName = !looksLikeName(name) && looksLikeName(ld.name) ? ld.name : name;
  if (!research && ld.research) {
    research = ld.research;
    researchSource = "structured";
  }
  if (!homepage) homepage = ld.homepage;
  if (!scholar) scholar = ld.scholar;
  if (!orcid) orcid = ld.orcid;
  return {
    url,
    name: finalName,
    title: title || ld.title,
    university,
    department: department || "",
    email: emails[0] || ld.email || "",
    otherEmails: emails.slice(1, 4).join(", "),
    research,
    researchSource,
    discipline,
    topics,
    domains: dom.length ? dom : topics.slice(0, 6),
    recruiting,
    recruitNote,
    homepage,
    scholar,
    dblp,
    orcid,
  };
}

// schema.org <script type="application/ld+json"> Person data (many JavaScript-built sites embed it)
function fromJsonLd($) {
  const out = { name: "", email: "", title: "", university: "", research: "", homepage: "", scholar: "", orcid: "" };
  const nodes = [];
  const walk = (x) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      nodes.push(x);
      if (x["@graph"]) walk(x["@graph"]);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      walk(JSON.parse($(el).contents().text()));
    } catch {
      /* ignore bad JSON */
    }
  });
  const person = nodes.find((n) => [].concat(n["@type"] || []).includes("Person"));
  if (!person) return out;
  const str = (v) => clean(typeof v === "string" ? v : v?.name || "");
  out.name = str(person.name);
  out.email = clean(String(person.email || "")).replace(/^mailto:/i, "");
  out.title = str(person.jobTitle);
  const aff = [].concat(person.affiliation || person.worksFor || [])[0];
  out.university = str(aff);
  const ka = person.knowsAbout;
  out.research = Array.isArray(ka) ? ka.map(str).filter(Boolean).join("; ") : str(ka);
  for (const l of [].concat(person.sameAs || [], person.url || [])) {
    if (typeof l !== "string") continue;
    if (/scholar\.google\./.test(l)) out.scholar ||= l;
    else if (/orcid\.org/.test(l)) out.orcid ||= l;
    else if (!out.homepage && /^https?:/.test(l)) out.homepage = l;
  }
  return out;
}

// Lists where every professor's details sit right on the page (no click-through): one "card" per mailto link.
const mailOf = ($, el) => decodeURIComponent(($(el).attr("href") || "").slice(7)).split("?")[0].trim().toLowerCase();
function cardNodes($) {
  const count = (n) => new Set($(n).find("a[href^='mailto:' i]").toArray().map((e) => mailOf($, e)).filter(Boolean)).size;
  const seen = new Set();
  const nodes = [];
  for (const a of $("a[href^='mailto:' i]").toArray()) {
    let n = a;
    while (n.parent?.name && !["body", "html"].includes(n.parent.name) && count(n.parent) <= 1) n = n.parent;
    if (seen.has(n) || $(n).text().length > 3000) continue;
    seen.add(n);
    nodes.push(n);
  }
  return nodes;
}
export function extractCards($, pageUrl, { sourceTitle = "" } = {}) {
  const base = pageUrl.split("#")[0];
  return cardNodes($).map((n, i) => {
    let hint = "";
    for (const el of $(n).find("h1,h2,h3,h4,h5,h6,strong,b,a,p,span,div").toArray()) {
      const t = cleanName($(el).text());
      if (t.length <= 60 && !$(el).is("a[href^='mailto:' i]") && looksLikeName(t)) {
        hint = t;
        break;
      }
    }
    const p = extractProfile(`<html><body>${$.html(n)}</body></html>`, base, { hintName: hint, sourceTitle });
    return { ...p, i, url: `${base}#card-${i}` };
  });
}

// Is this page a single profile, a directory with profile links, a list with inline details, or unknown?
function classify(page, { selector = "" } = {}) {
  const $ = cheerio.load(page.html);
  const hi = findCandidates($, page.url, { selector }).filter((c) => c.confidence === "high");
  const prof = extractProfile(page.html, page.url);
  const signal =
    looksLikeName(prof.name) && !!(prof.email || prof.researchSource === "labeled" || prof.researchSource === "structured" || prof.title);
  if (selector && hi.length) return { kind: "directory", $, hi, prof };
  // One person's own page (their name is the heading and the last part of the address), even when it lists many
  // other people in a "Network" / "Related profiles" block: that is one profile, not a directory.
  const h1 = cleanName(clean($("h1").first().text()));
  const nm = looksLikeName(h1) ? h1 : looksLikeName(prof.name) ? prof.name : "";
  const onePerson = (page.html.match(/"@type"\s*:\s*"Person"/g) || []).length === 1 && looksLikeName(h1);
  if (!selector && nm && (slugMatchesName(page.url, nm) || onePerson)) return { kind: "profile", $, hi, prof };
  if (signal && hi.length < 12) return { kind: "profile", $, hi, prof };
  if (hi.length >= 3) return { kind: "directory", $, hi, prof };
  if (cardNodes($).length >= 3)
    return { kind: "cards", $, hi, prof, cards: extractCards($, page.url, { sourceTitle: clean($("title").first().text()) }) };
  if (signal) return { kind: "profile", $, hi, prof };
  return { kind: "unknown", $, hi, prof };
}
const PERSON_PATH = /(person|people|profile|faculty|staff|member|teacher|researcher|expert|academic|team|bio|\/~)/i;
const nameTokens = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
// /en/persons/aiqin-luo  <->  "Aiqin Luo" (also "Luo, Aiqin", and slugs like jane-doe-2)
export function slugMatchesName(url, name) {
  let seg, path;
  try {
    const u = new URL(url);
    path = u.pathname;
    seg = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "").replace(/-\d+$/, "");
  } catch {
    return false;
  }
  if (!PERSON_PATH.test(path)) return false;
  const a = nameTokens(seg),
    b = nameTokens(name);
  if (!a.length || !b.length || a.length + b.length < 3) return false;
  const sa = new Set(a),
    sb = new Set(b);
  return a.join("") === b.join("") || [...a].sort().join("") === [...b].sort().join("") || b.every((x) => sa.has(x)) || a.every((x) => sb.has(x));
}
const hasData = (p) => !!(p.email || p.research || p.title || p.discipline || p.topics?.length);

// ---------- jobs ----------
const jobs = new Map();
const pub = (j) => ({
  id: j.id,
  status: j.status,
  total: j.total,
  done: j.done,
  saved: j.saved,
  last: j.last,
  errors: j.errors,
});

async function saveProfessor(p, key) {
  const id = createHash("sha1").update(key).digest("hex").slice(0, 20);
  const old = await db.get("professors", id);
  if (old) await db.update("professors", id, { ...p, scrapedAt: Date.now() }); // keeps your status & notes
  else await db.set("professors", id, { ...p, status: "new", notes: "", createdAt: Date.now(), scrapedAt: Date.now() });
}

// ---------- when a profile states no research direction: read what the person publishes ----------
const isPureProfile = (u) => /\/persons\/[^/]+\/?$/.test(new URL(u).pathname);
export function publicationTitles($, pageUrl) {
  const out = [];
  $('a[href*="/publications/"]').each((_, a) => {
    const t = clean($(a).text());
    let path;
    try {
      path = new URL($(a).attr("href"), pageUrl).pathname;
    } catch {
      return;
    }
    if (/\/publications\/?$/.test(path)) return; // the "Research output" tab link itself
    if (t.length < 20 || t.length > 300 || t.split(" ").length < 3) return;
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  });
  return out.slice(0, 40);
}
async function enrichFromPublications(p, pageUrl, mode, assist) {
  if (p.researchSource === "labeled" || p.researchSource === "structured") return p; // the person already states it
  try {
    if (!isPureProfile(pageUrl)) return p;
    const u = new URL(pageUrl);
    const pub = await loadParsed(`${u.origin}${u.pathname.replace(/\/$/, "")}/publications/`, mode, () => true, { assist });
    const titles = publicationTitles(cheerio.load(pub.html), pub.url);
    if (titles.length < 3) return p;
    const kws = keywordsFromTitles(titles);
    const out = { ...p, recentPapers: titles.slice(0, 5) };
    if (kws.length) {
      out.topics = [...new Set([...(p.topics || []), ...kws])].slice(0, 14);
      if (!out.research || out.researchSource === "summary") {
        out.research = `Recurring topics in publications: ${kws.join(", ")}`;
        out.researchSource = "publications";
      }
      if (!out.domains?.length) out.domains = kws;
    }
    return out;
  } catch {
    return p; // best effort only
  }
}

export function startJob({ urls, sourceUrl = "", sourceTitle = "", render = "auto", assist = true } = {}) {
  if (!Array.isArray(urls) || !urls.length) throw new Error("Pick at least one profile link");
  const mode0 = ["auto", "always", "never"].includes(render) ? render : "auto";
  const seen = new Set();
  const items = [];
  for (const it of urls) {
    const o = typeof it === "string" ? { url: it } : it || {};
    const key = String(o.key || o.url || "");
    if (!o.url || seen.has(key)) continue;
    try {
      new URL(o.url);
    } catch {
      continue;
    }
    seen.add(key);
    items.push({
      key,
      url: String(o.url),
      name: clean(o.name || o.text),
      card: Number.isInteger(o.card) ? o.card : null,
      render: !!o.render,
      sourceUrl: String(o.sourceUrl || sourceUrl || ""),
      sourceTitle: String(o.sourceTitle || sourceTitle || ""),
    });
  }
  if (!items.length) throw new Error("No valid links to scrape");
  if (items.length > MAX_URLS_PER_JOB) throw new Error(`Please scrape at most ${MAX_URLS_PER_JOB} profiles at a time`);
  const job = { id: newId(), status: "running", total: items.length, done: 0, saved: 0, last: "", errors: [], cancelled: false };
  jobs.set(job.id, job);
  for (const k of [...jobs.keys()].slice(0, Math.max(0, jobs.size - 20))) jobs.delete(k);

  const cardsCache = new Map();
  const cardsFor = (it, mode) => {
    if (!cardsCache.has(it.url))
      cardsCache.set(
        it.url,
        (async () => {
          const page = await loadParsed(it.url, mode, (r) => cardNodes(cheerio.load(r.html)).length >= 3, { assist });
          return extractCards(cheerio.load(page.html), page.url, { sourceTitle: it.sourceTitle });
        })(),
      );
    return cardsCache.get(it.url);
  };
  let i = 0;
  const worker = async () => {
    while (!job.cancelled) {
      const it = items[i++];
      if (!it) return;
      try {
        const mode = it.render && mode0 !== "never" ? "always" : mode0;
        const opts = { hintName: it.name, sourceTitle: it.sourceTitle };
        let p;
        if (it.card !== null) {
          p = (await cardsFor(it, mode)).find((c) => c.i === it.card);
          if (!p) throw new Error("This entry was no longer found on the list page");
        } else {
          const page = await loadParsed(it.url, mode, (r) => hasData(extractProfile(r.html, r.url, opts)), { assist });
          p = extractProfile(page.html, page.url, opts);
          p = await enrichFromPublications(p, page.url, mode, assist);
          if (!hasData(p))
            throw new Error(
              page.renderError ||
                (mode === "never"
                  ? "No profile data found. If the site uses JavaScript, set Render JavaScript to Auto."
                  : "No profile data found on this page"),
            );
        }
        const { i: _i, ...rest } = p;
        await saveProfessor({ ...rest, sourceUrl: it.sourceUrl }, it.key);
        job.saved++;
        job.last = p.name || it.url;
      } catch (e) {
        if (job.errors.length < 200) job.errors.push({ url: it.key, error: e.message || "Failed" });
      } finally {
        job.done++;
      }
    }
  };
  Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
    .catch((e) => console.error("[scraper]", e))
    .finally(() => {
      job.status = job.cancelled ? "cancelled" : "done";
    });
  return pub(job);
}
export const getJob = (id) => (jobs.has(id) ? pub(jobs.get(id)) : null);
export const cancelJob = (id) => {
  const j = jobs.get(id);
  if (!j) return null;
  j.cancelled = true;
  return pub(j);
};
