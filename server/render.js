// Optional headless-browser rendering for JavaScript-built pages (React/Vue/Next.js sites, "load more" lists).
// Uses playwright-core with the Chrome or Edge that is already installed on your computer (no extra download).
// Override with BROWSER_PATH=/path/to/chrome if needed.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";

const UA =
  "OutreachMailer-ProfessorFinder/1.0 (personal admissions research; polite crawler; obeys robots.txt)";
const MAX_PAGES = 2; // parallel browser tabs
const IDLE_CLOSE_MS = 60_000;
const INTERACTIVE_IDLE_MS = 180_000; // the visible window stays open a bit longer so a running job does not reopen it
const VERIFY_TIMEOUT_MS = 5 * 60_000; // how long we wait for you to finish a captcha / login

export const NEED_BROWSER =
  "This page builds its content with JavaScript and needs a browser to read it. Install the optional helper with `npm install playwright-core` (it uses your installed Chrome or Edge), restart the app and try again.";

let browserP = null,
  idleTimer = null,
  interTimer = null,
  running = 0;
const waiters = [];

// Starts Chrome / Edge / bundled Chromium, whichever works first. `launch(chromium, options)` does the actual launch.
async function launchChromium(launch) {
  let pw;
  try {
    pw = await import("playwright-core");
  } catch {
    throw new Error(NEED_BROWSER);
  }
  const chromium = pw.chromium || pw.default?.chromium;
  const attempts = process.env.BROWSER_PATH
    ? [{ executablePath: process.env.BROWSER_PATH }]
    : [{ channel: "chrome" }, { channel: "msedge" }, {}];
  const errs = [];
  for (const opt of attempts) {
    try {
      return await launch(chromium, opt);
    } catch (e) {
      errs.push(String(e.message).split("\n")[0]);
    }
  }
  throw new Error(
    `No Chrome or Edge browser could be started (${errs.at(-1)}). Install Google Chrome or set BROWSER_PATH to its executable.`,
  );
}

async function getBrowser() {
  if (browserP) return browserP;
  browserP = launchChromium((chromium, opt) => chromium.launch({ headless: true, ...opt })).catch((e) => {
    browserP = null;
    throw e;
  });
  return browserP;
}

// ---------- visible Chrome for captchas / logins (a person finishes the check) ----------
// Cloudflare and similar services detect browsers that are *controlled* by automation and then reject even a real human click
// ("Verification failed"). So the window is a completely normal Chrome started by the app with its own saved profile.
// While you solve the check nothing is attached to it; the app only looks at the tab titles. When the page opens,
// it attaches briefly (DevTools protocol), reads the page, and lets go again.
// One saved profile per browser brand (a Chrome profile must not be opened by Edge or the other way round).
const profileDir = (exe = "") =>
  process.env.SCRAPER_PROFILE_DIR ||
  path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), /msedge|edge/i.test(exe) ? "edge-profile" : "chrome-profile");

export function chromePath() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const e = process.env,
    list = [];
  if (process.platform === "win32") {
    const bases = [e.PROGRAMFILES, e["PROGRAMFILES(X86)"], e.LOCALAPPDATA].filter(Boolean);
    // 1) Google Chrome: the registry knows where it is installed (system-wide or just for this user)
    for (const hive of ["HKCU", "HKLM"]) {
      try {
        const out = execFileSync("reg", ["query", `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe`, "/ve"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 4_000,
        });
        const m = out.match(/REG_SZ\s+(.+)/);
        if (m) list.push(m[1].trim());
      } catch {
        /* not installed for this hive */
      }
    }
    // 2) the usual Chrome folders, 3) only then Edge
    for (const base of bases) list.push(path.join(base, "Google", "Chrome", "Application", "chrome.exe"));
    for (const base of bases) list.push(path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"));
  } else if (process.platform === "darwin") {
    list.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    list.push("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge");
  }
  return list.find((x) => fs.existsSync(x)) || null;
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });

async function cdp(port, p, method = "GET") {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, { method, signal: AbortSignal.timeout(4_000) });
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function pwChromium() {
  let pw;
  try {
    pw = await import("playwright-core");
  } catch {
    throw new Error(NEED_BROWSER);
  }
  return pw.chromium || pw.default?.chromium;
}

let chromeP = null;
function getChrome() {
  if (chromeP) return chromeP;
  const p = (async () => {
    const exe = chromePath();
    if (!exe) throw new Error("Chrome or Edge was not found. Install Google Chrome or set BROWSER_PATH to its executable.");
    const dir = profileDir(exe);
    fs.mkdirSync(dir, { recursive: true });
    const port = await freePort();
    const proc = spawn(
      exe,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-first-run", "--no-default-browser-check", "about:blank"],
      { stdio: "ignore" },
    );
    let failed = null;
    proc.on("error", (e) => (failed = e));
    proc.on("exit", () => {
      if (chromeP === p) chromeP = null;
    });
    for (let i = 0; i < 80; i++) {
      if (failed || proc.exitCode !== null) break;
      try {
        await cdp(port, "/json/version");
        return { proc, port }; // the first about:blank tab stays open so the window does not close between pages
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    try {
      proc.kill();
    } catch {
      /* already gone */
    }
    throw new Error(
      `Could not start Chrome${failed ? ` (${failed.message})` : ""}. If a Chrome window opened by this app is still open, close it and try again.`,
    );
  })().catch((e) => {
    if (chromeP === p) chromeP = null;
    throw e;
  });
  chromeP = p;
  return p;
}

async function closeChrome() {
  const c = await chromeP?.catch(() => null);
  chromeP = null;
  if (!c) return;
  try {
    const browser = await (await pwChromium()).connectOverCDP(`http://127.0.0.1:${c.port}`, { timeout: 5_000 });
    await (await browser.newBrowserCDPSession()).send("Browser.close"); // graceful, so cookies are written to disk
  } catch {
    /* fall through to kill */
  }
  setTimeout(() => {
    try {
      c.proc.kill();
    } catch {
      /* already closed */
    }
  }, 3_000).unref?.();
}

// What the screen shows while the app is waiting for you: { host, url, since } or null.
let verifyState = null,
  verifyChoice = null; // "continue" | "cancel" (buttons in the app)
export const getVerifyState = () => verifyState;
export function verifyAction(action) {
  if (!verifyState || !["continue", "cancel"].includes(action)) return false;
  verifyChoice = action;
  return true;
}
// Only one person-check per site at a time: other tabs for the same site wait for the same check.
const gates = new Map();
const gate = (host, fn) => {
  let p = gates.get(host);
  if (!p) {
    p = fn().finally(() => gates.delete(host));
    gates.set(host, p);
  }
  return p;
};

const scheduleClose = () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (running || !browserP) return;
    const b = await browserP.catch(() => null);
    browserP = null;
    b?.close().catch(() => {});
  }, IDLE_CLOSE_MS);
  idleTimer.unref?.();
  clearTimeout(interTimer);
  interTimer = setTimeout(() => {
    if (running || !chromeP || verifyState) return;
    closeChrome();
  }, INTERACTIVE_IDLE_MS);
  interTimer.unref?.();
};

const acquire = async () => {
  if (running >= MAX_PAGES) await new Promise((r) => waiters.push(r));
  running++;
};
const release = () => {
  running--;
  waiters.shift()?.();
  scheduleClose();
};

export async function browserStatus() {
  try {
    await import("playwright-core");
    return { installed: true };
  } catch {
    return { installed: false, help: NEED_BROWSER };
  }
}

const LOAD_MORE = /^\s*(load more|show more|view more|see more|more results|加载更多|查看更多|点击加载更多)\s*$/i;

// Scrolls to the bottom and presses "Load more" style buttons so lazy lists are fully loaded.
async function expand(page) {
  let clicks = 0;
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(500);
    if (clicks < 5) {
      const btn = page.locator("button, a, [role=button]").filter({ hasText: LOAD_MORE }).first();
      if ((await btn.count().catch(() => 0)) && (await btn.isVisible().catch(() => false))) {
        await btn.click({ timeout: 2_000 }).catch(() => {});
        clicks++;
        await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => {});
      }
    }
  }
}

// `guard(url)` must throw for non-public addresses; it is applied to every request the page makes.
export async function renderPage(url, { guard, scroll = true }) {
  await acquire();
  let ctx;
  try {
    const browser = await getBrowser();
    ctx = await browser.newContext({ userAgent: UA, locale: "en-US", serviceWorkers: "block", acceptDownloads: false });
    await ctx.route("**/*", async (route) => {
      const req = route.request();
      if (["image", "media", "font"].includes(req.resourceType())) return route.abort();
      if (/^(data|blob|about):/i.test(req.url())) return route.continue();
      try {
        await guard(req.url());
      } catch {
        return route.abort();
      }
      return route.continue();
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    if (scroll) await expand(page);
    const finalUrl = page.url();
    await guard(finalUrl);
    return { html: await page.content(), url: finalUrl };
  } finally {
    await ctx?.close().catch(() => {});
    release();
  }
}

const sameTarget = (a, b) => {
  try {
    const x = new URL(a),
      y = new URL(b);
    return x.origin + x.pathname.replace(/\/$/, "") + x.search === y.origin + y.pathname.replace(/\/$/, "") + y.search;
  } catch {
    return false;
  }
};

const CHALLENGE_TITLE = /^(just a moment|attention required|checking|verifying|one more step|access denied|pardon our interruption|请稍候|安全验证|人机验证)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GONE = "The browser window was closed before the check was finished.";

// Opens the page in a VISIBLE, normal Chrome window. If the site shows a captcha / "verify you are human" / login page
// (`isBlocked(html)` is true), the app waits while you finish it in that window, then carries on automatically.
export async function renderInteractive(url, { guard, isBlocked, scroll = true }) {
  await acquire();
  let ch, tab;
  try {
    await guard(url);
    ch = await getChrome();
    tab = await cdp(ch.port, `/json/new?${encodeURIComponent(url)}`, "PUT"); // opens a tab without attaching anything to it; encoded so #filters and %-escapes in the link survive
    const host = new URL(url).hostname;
    const info = async () => {
      let list;
      try {
        list = await cdp(ch.port, "/json/list");
      } catch {
        throw new Error(GONE);
      }
      const t = Array.isArray(list) && list.find((x) => x.id === tab.id);
      if (!t) throw new Error(GONE);
      return t;
    };

    // Attach for a moment, read the page (and scroll / press "load more"), detach. Returns null while the page is still a check or login.
    const readTab = async (force, reload = false) => {
      const browser = await (await pwChromium()).connectOverCDP(`http://127.0.0.1:${ch.port}`, { timeout: 10_000 });
      try {
        const t = await info();
        const page = browser.contexts().flatMap((c) => c.pages()).find((x) => x.url() === t.url);
        if (!page) return null;
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        let html = await page.content().catch(() => "");
        if (!force && isBlocked(html) && reload) {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {}); // cookies are shared: this tab may pass now
          html = await page.content().catch(() => "");
        }
        if (!force && isBlocked(html)) return null;
        if (!sameTarget(page.url(), url) && reload) {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {}); // e.g. after a login you land elsewhere
        }
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
        if (scroll) await expand(page);
        const finalUrl = page.url();
        await guard(finalUrl);
        return { html: await page.content(), url: finalUrl };
      } finally {
        await browser.close().catch(() => {}); // only disconnects; the window stays open
      }
    };

    let lastKey = "",
      lastTry = 0;
    // One look: only attach when the tab title no longer says "Just a moment…", and not more than every 6 s for the same page.
    const look = async (force) => {
      const t = await info();
      await guard(t.url).catch(() => {
        throw new Error("The page moved to a non-public address.");
      });
      const isCheck = !t.title || t.title === t.url || CHALLENGE_TITLE.test(t.title) || t.url === "about:blank";
      if (!force) {
        if (isCheck) return { isCheck, res: null };
        const key = `${t.title}|${t.url}`;
        if (key === lastKey && Date.now() - lastTry < 6_000) return { isCheck, res: null };
        lastKey = key;
        lastTry = Date.now();
      }
      return { isCheck, res: await readTab(force) };
    };

    // 1) give the page a few seconds: with a valid saved cookie there is nothing to do and no banner
    let res = null;
    const quick = Date.now() + 8_000;
    while (Date.now() < quick) {
      const r = await look(false);
      if (r.res) {
        res = r.res;
        break;
      }
      if (r.isCheck && Date.now() > quick - 6_500) break; // clearly a check page: ask the person
      await sleep(700);
    }

    // 2) otherwise wait for the person (one check per site, other tabs for it wait for the same one)
    if (!res) {
      let mine = null;
      const how = await gate(host, async () => {
        verifyChoice = null;
        verifyState = { host, url, since: Date.now() };
        try {
          const deadline = Date.now() + VERIFY_TIMEOUT_MS;
          for (;;) {
            if (verifyChoice === "cancel") throw new Error("Verification was cancelled.");
            if (Date.now() > deadline) throw new Error("The check was not finished within 5 minutes.");
            const r = await look(verifyChoice === "continue");
            if (r.res) {
              mine = r.res;
              return verifyChoice === "continue" ? "continue" : "clear";
            }
            await sleep(1_000);
          }
        } finally {
          verifyState = null;
          verifyChoice = null;
        }
      });
      res = mine || (await readTab(how === "continue", true));
      if (!res) throw new Error("The site still shows a check or login page. Try again and finish it in the browser window.");
    }
    return res;
  } finally {
    if (ch && tab) await cdp(ch.port, `/json/close/${tab.id}`).catch(() => {});
    release();
  }
}
