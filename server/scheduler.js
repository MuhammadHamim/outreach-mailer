// In-process scheduler. The queue lives in memory (loaded from the database on boot / after changes)
// so ticking every 10 s costs zero database reads.
import { DateTime } from "luxon";
import * as db from "./db.js";
import { sendEmail, pickAccountId } from "./mailer.js";
import { syncReplies } from "./inbox.js";

const queue = new Map(); // emailId -> { at, until }  (ms)
let busy = false,
  nextAllowed = 0,
  lastTick = 0,
  counter = { date: "", count: 0 };
let settings = {
  paused: false,
  dailyCap: 0,
  tz: "Asia/Shanghai",
  gapMin: 15,
  gapMax: 30,
  missedGraceMin: 60,
  followUpDays: 7,
  checkReplies: true,
};

export const getSettings = () => settings;
export async function saveSettings(patch) {
  const clean = {};
  if ("paused" in patch) clean.paused = !!patch.paused;
  if ("dailyCap" in patch)
    clean.dailyCap = Math.max(0, parseInt(patch.dailyCap) || 0);
  if ("tz" in patch && DateTime.now().setZone(patch.tz).isValid)
    clean.tz = patch.tz;
  if ("gapMin" in patch)
    clean.gapMin = Math.max(5, parseInt(patch.gapMin) || 15);
  if ("gapMax" in patch)
    clean.gapMax = Math.max(
      clean.gapMin ?? settings.gapMin,
      parseInt(patch.gapMax) || 30,
    );
  if ("missedGraceMin" in patch)
    clean.missedGraceMin = Math.max(5, parseInt(patch.missedGraceMin) || 60);
  if ("followUpDays" in patch)
    clean.followUpDays = Math.max(
      1,
      Math.min(90, parseInt(patch.followUpDays) || 7),
    );
  if ("checkReplies" in patch) clean.checkReplies = !!patch.checkReplies;
  settings = { ...settings, ...clean };
  await db.set("settings", "main", settings);
  return settings;
}
export const graceMs = () => settings.missedGraceMin * 60000;
export async function reload() {
  queue.clear();
  for (const r of await db.listWhere("emails", "status", "scheduled"))
    queue.set(r.id, {
      at: r.sendAt,
      until: r.windowEnd || r.sendAt + graceMs(),
    });
}
export const queueSize = () => queue.size;
export const todaySent = () =>
  counter.date === DateTime.now().setZone(settings.tz).toISODate()
    ? counter.count
    : 0;

// After the app/computer was off or asleep: emails whose own window (its daily window, or the end of the range) is over
// are NOT sent late. They are marked "missed" and the user is asked once for all of them. Emails still inside their
// window are simply sent now, one after another.
async function sweepMissed() {
  const now = Date.now();
  const late = [...queue]
    .filter(([, q]) => q.at < now && q.until < now)
    .map(([id]) => id);
  if (!late.length) return;
  late.forEach((id) => queue.delete(id));
  await db.updateMany(
    "emails",
    late.map((id) => [id, { status: "missed", error: null }]),
  );
  console.log(
    `[scheduler] ${late.length} email(s) missed their window and wait for a decision`,
  );
}

async function tick() {
  const now = Date.now();
  if (now - lastTick > 120000) await sweepMissed(); // first tick after start / wake-up from sleep
  lastTick = now;
  if (busy || settings.paused || now < nextAllowed) return;
  const due = [...queue]
    .filter(([, q]) => q.at <= now)
    .sort((a, b) => a[1].at - b[1].at)[0];
  if (!due) return;
  if (settings.dailyCap && todaySent() >= settings.dailyCap) return;
  const [id] = due;
  const accountId = pickAccountId();
  if (accountId === null) return; // every account is at its limit or cooling off: leave the email queued
  busy = true;
  try {
    queue.delete(id);
    if (!(await db.claim("emails", id, "scheduled", { status: "sending" })))
      return; // changed/cancelled meanwhile
    const email = await db.get("emails", id);
    try {
      const messageId = await sendEmail({ ...email, accountId });
      await db.update("emails", id, {
        status: "sent",
        sentAt: Date.now(),
        error: null,
        messageId,
        accountId: accountId || null,
      });
      const today = DateTime.now().setZone(settings.tz).toISODate();
      counter = {
        date: today,
        count: (counter.date === today ? counter.count : 0) + 1,
      };
      await db.set("settings", "counter", counter);
      console.log(`[send] ok -> ${email.to}`);
    } catch (e) {
      await db.update("emails", id, {
        status: "failed",
        error: String(e.message || e).slice(0, 300),
      });
      console.error(`[send] FAILED -> ${email.to}: ${e.message}`);
    }
    nextAllowed =
      Date.now() +
      (settings.gapMin + Math.random() * (settings.gapMax - settings.gapMin)) *
        1000;
  } catch (e) {
    console.error("[tick]", e);
  } finally {
    busy = false;
  }
}

export async function start() {
  const saved = await db.get("settings", "main");
  if (saved) settings = { ...settings, ...saved };
  const c = await db.get("settings", "counter");
  if (c) counter = c;
  // a mail that was mid-send when the server stopped may or may not have gone out: never auto-resend
  const stale = await db.listWhere("emails", "status", "sending");
  await db.updateMany(
    "emails",
    stale.map((e) => [
      e.id,
      {
        status: "failed",
        error:
          "Interrupted while sending - check the Sent folder of your mailbox before retrying",
      },
    ]),
  );
  await reload();
  await sweepMissed();
  lastTick = Date.now();
  setInterval(tick, 10000);
  // look for replies now and then (needs IMAP, quietly skipped when not possible)
  const poll = () => {
    if (settings.checkReplies) syncReplies().catch(() => {});
  };
  setTimeout(poll, 20000);
  setInterval(poll, 10 * 60000);
  console.log(`[scheduler] started, ${queue.size} email(s) queued`);
}
