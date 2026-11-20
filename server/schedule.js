// Picks random send times inside a date range, optionally limited to a daily window / weekdays.
import { DateTime } from 'luxon';

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export function computeTimes({ n, mode, at, start, end, tz = 'Asia/Shanghai', windowStart = '00:00', windowEnd = '23:59',
  skipWeekends = false, minGapMin = 0, now = Date.now(), graceMs = 3600000 }) {
  if (n <= 0) return [];
  if (mode === 'now') return Array(n).fill({ at: now, until: now + graceMs });
  if (mode === 'at') {
    const t = DateTime.fromISO(at, { zone: tz });
    if (!t.isValid) throw new Error('Invalid date/time');
    const at = Math.max(t.toMillis(), now); return Array(n).fill({ at, until: at + graceMs });
  }
  if (mode !== 'range') throw new Error('Unknown schedule mode');

  let s = DateTime.fromISO(start, { zone: tz }), e = DateTime.fromISO(end, { zone: tz });
  if (!s.isValid || !e.isValid) throw new Error('Invalid start or end');
  s = DateTime.max(s, DateTime.fromMillis(now + 30000, { zone: tz }));
  if (e <= s) throw new Error('End must be after start (and in the future)');
  if (toMin(windowEnd) <= toMin(windowStart)) throw new Error('Daily window end must be after its start');

  // allowed intervals, day by day
  const hasWindow = windowStart !== '00:00' || windowEnd !== '23:59';
  const intervals = [];
  for (let day = s.startOf('day'); day <= e; day = day.plus({ days: 1 })) {
    if (skipWeekends && day.weekday >= 6) continue;
    const a = DateTime.max(s, day.plus({ minutes: toMin(windowStart) }));
    const b = DateTime.min(e, day.plus({ minutes: toMin(windowEnd) }));
    if (b > a) intervals.push([a.toMillis(), b.toMillis()]);
  }
  const total = intervals.reduce((sum, [a, b]) => sum + (b - a), 0);
  const gap = Math.max(0, minGapMin) * 60000;
  if (total <= 0) throw new Error('No allowed time in that range (check window / weekends)');
  if (total < (n - 1) * gap) throw new Error(`Range too short: ${n} emails with ${minGapMin} min gaps need at least ${Math.ceil(((n - 1) * gap) / 60000)} min of allowed time`);

  // uniform random points, then add i*gap so neighbours are always >= gap apart
  const span = total - (n - 1) * gap;
  const offs = Array.from({ length: n }, () => Math.random() * span).sort((x, y) => x - y).map((x, i) => x + i * gap);
  // each email also gets "until": the end of its daily window (or of the whole range). Later than that it counts as missed.
  return offs.map((o) => {
    for (const [a, b] of intervals) { const len = b - a; if (o <= len) return { at: Math.round(a + o), until: hasWindow ? b : e.toMillis() }; o -= len; }
    return { at: intervals.at(-1)[1], until: intervals.at(-1)[1] };
  });
}
