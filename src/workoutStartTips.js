/**
 * Feature 15 — App Animations (workout start tips)
 * Spec: features/feature-15-App-Animations.md
 */

const TIPS = [
  {
    id: 'breaks',
    text:
      'Take breaks; around 30% of muscle training injuries come from tiny, painless injuries built up from overwork (Kawa O, Zywiec W, Czyzewski B, et al. Most Common Injuries in Resistance Training; 2025 Oct 7)',
  },
  {
    id: 'hydration',
    text:
      "You're responsible for your own hydration. Water heals, nurtures, and lubricates everything in your body (some guy online)",
  },
  {
    id: 'sleep',
    text: 'Sleep is the Swiss Army Knife of health. (Dr. Matthew Walker)',
  },
  {
    id: 'food',
    text: 'Food is more than just taste, it is fuel. Crappy fuel makes a crappy day. (Dr. Fang Li)',
  },
];

const WELCOME = { id: 'welcome', text: 'Welcome back! (me)' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/** Whole local calendar days between two ISO dates (today - last). */
function daysSinceLastEntry(today, lastEntryLocalDate) {
  if (lastEntryLocalDate == null || lastEntryLocalDate === '') return Infinity;
  const a = parseLocalDate(today);
  const b = parseLocalDate(lastEntryLocalDate);
  if (!a || !b) return Infinity;
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function lastEntryLocalDateFromStore(store) {
  const entries = (store && store.entries) || [];
  let best = null;
  for (const e of entries) {
    const d = e && e.localDate;
    if (typeof d === 'string' && DATE_RE.test(d)) {
      if (!best || d > best) best = d;
    }
  }
  return best;
}

/**
 * @param {{ today: string, lastEntryLocalDate?: string|null, random?: () => number }} opts
 */
function selectTip(opts = {}) {
  const today = opts.today;
  const last = opts.lastEntryLocalDate;
  const days = daysSinceLastEntry(today, last);
  if (!Number.isFinite(days) || days >= 14) {
    return { ...WELCOME };
  }
  const rnd = typeof opts.random === 'function' ? opts.random() : Math.random();
  const idx = Math.min(TIPS.length - 1, Math.max(0, Math.floor(rnd * TIPS.length)));
  return { ...TIPS[idx] };
}

module.exports = {
  TIPS,
  WELCOME,
  daysSinceLastEntry,
  lastEntryLocalDateFromStore,
  selectTip,
};
