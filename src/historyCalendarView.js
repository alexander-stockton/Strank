/**
 * Feature 4 — Weekly Ranking (History ranking contract UI)
 * Feature 6 — Custom Ranks (badgePath images on calendar)
 * Spec: features/feature-4-Weekly-Ranking.md FR-013–FR-020
 * Spec: features/feature-6-Custom-Ranks.md FR-009
 *
 * Calendar chrome aligned with Feature 9; ranking math from `ranking`.
 */

const ranking = require('./ranking');
const ranks = require('./ranks');
const storage = require('./storage');
const { formatLocalDate } = require('./appDate');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function recordedDatesSet() {
  const read = storage.readStore();
  const set = new Set();
  if (read.ok) {
    for (const e of read.data.entries || []) set.add(e.localDate);
  }
  return set;
}

/**
 * Mount Workout History calendar (month default / years / day).
 */
function tierBadge(tierName, ranksMod) {
  return ranksMod.renderBadgeHtml(tierName, 'cal-tier-badge-img');
}

function mountHistoryCalendarView(root, options = {}) {
  const svc = options.ranking || ranking;
  const ranksMod = options.ranks || ranks;
  let destroyed = false;
  const today = options.today || svc.currentLocalDate();
  let viewYear = options.year || parseInt(today.slice(0, 4), 10);
  let viewMonth = options.month || parseInt(today.slice(5, 7), 10);
  /** 'month' | 'years' | 'day' */
  let zoom = 'month';
  let dayDate = null;
  let priorMonth = { year: viewYear, month: viewMonth };

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function openDay(localDate) {
    dayDate = localDate;
    zoom = 'day';
    render();
  }

  function openYears() {
    priorMonth = { year: viewYear, month: viewMonth };
    zoom = 'years';
    render();
  }

  function openMonth(year, month) {
    viewYear = year;
    viewMonth = month;
    zoom = 'month';
    render();
  }

  function renderYears() {
    const yearsResult = svc.listActiveYears({ today });
    const years = yearsResult.ok ? yearsResult.data : [viewYear];
    const rows = years
      .map((y) => {
        const prog = svc.getYearProgression(y, { today });
        const p = prog.ok ? prog.data : { startTierName: 'UNRANKED', endTierName: 'UNRANKED' };
        return `<li class="year-row" data-year="${y}">
          <button type="button" class="year-select" data-year="${y}">${y}</button>
          <span class="progression" data-year-progression="${y}">
            <span class="badge-start" data-start-tier="${escapeHtml(p.startTierName)}">${tierBadge(
              p.startTierName,
              ranksMod
            )}</span>
            <span class="progression-arrow" aria-hidden="true">→</span>
            <span class="badge-end" data-end-tier="${escapeHtml(p.endTierName)}">${tierBadge(
              p.endTierName,
              ranksMod
            )}</span>
          </span>
        </li>`;
      })
      .join('');

    root.innerHTML = `
      <section class="panel history-calendar" data-view="historyYears">
        <header class="cal-header">
          <h1>Years</h1>
          <button type="button" class="ghost" data-action="back">Back</button>
        </header>
        <ul class="years-list" data-years-list>${rows}</ul>
      </section>
    `;

    root.querySelector('[data-action="back"]').addEventListener('click', () => {
      openMonth(priorMonth.year, priorMonth.month);
    });
    root.querySelectorAll('.year-select').forEach((btn) => {
      btn.addEventListener('click', () => {
        const y = parseInt(btn.getAttribute('data-year'), 10);
        const todayY = parseInt(today.slice(0, 4), 10);
        const m = y === todayY ? parseInt(today.slice(5, 7), 10) : 12;
        openMonth(y, m);
      });
    });
  }

  function renderDay() {
    const dayRank = svc.compareDay(dayDate, { today });
    const tier = dayRank.ok ? dayRank.data.overallTierName : 'UNRANKED';
    const read = storage.readStore();
    const entries = read.ok ? read.data.entries.filter((e) => e.localDate === dayDate) : [];
    const list =
      entries.length === 0
        ? `<p class="empty-state">No exercises recorded.</p>`
        : `<ul class="entry-list">${entries
            .map(
              (e) =>
                `<li class="entry-row" data-entry-id="${escapeHtml(e.entryId)}">
                  <span class="entry-name">${escapeHtml(e.exerciseId)}</span>
                </li>`
            )
            .join('')}</ul>`;

    root.innerHTML = `
      <section class="panel history-calendar" data-view="historyDay">
        <header class="cal-header">
          <h1 data-day-heading>${escapeHtml(dayDate)}</h1>
          <span class="day-rank-badge" data-day-rank="${escapeHtml(tier)}">${tierBadge(tier, ranksMod)}</span>
          <button type="button" class="ghost" data-action="back">Back</button>
        </header>
        ${list}
      </section>
    `;
    root.querySelector('[data-action="back"]').addEventListener('click', () => {
      zoom = 'month';
      render();
    });
  }

  function renderMonth() {
    const recorded = recordedDatesSet();
    const prog = svc.getMonthProgression(viewYear, viewMonth, { today });
    const p = prog.ok ? prog.data : { startTierName: 'UNRANKED', endTierName: 'UNRANKED' };

    const firstDow = (() => {
      const d = new Date(viewYear, viewMonth - 1, 1);
      const day = d.getDay();
      return day === 0 ? 6 : day - 1; // Mon=0
    })();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push(`${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weekRows = [];
    for (let i = 0; i < cells.length; i += 7) {
      const slice = cells.slice(i, i + 7);
      const any = slice.find((c) => c);
      const weekStart = any ? svc.mondayOf(any) : null;

      const badge = weekStart ? svc.compareToRanks(weekStart, { today }) : null;
      const tierName = badge && badge.ok ? badge.data.overallTierName : 'UNRANKED';

      const dayCells = slice
        .map((iso) => {
          if (!iso) return `<td class="cal-empty"></td>`;
          const dayNum = parseInt(iso.slice(8, 10), 10);
          const isRec = recorded.has(iso);
          const cls = isRec ? 'cal-day recorded' : 'cal-day unrecorded';
          return `<td class="${cls}" data-date="${escapeHtml(iso)}" data-recorded="${isRec ? 'true' : 'false'}">
            <button type="button" class="cal-day-btn" data-date="${escapeHtml(iso)}">${dayNum}</button>
          </td>`;
        })
        .join('');

      weekRows.push(`<tr class="cal-week" data-week-start="${escapeHtml(weekStart || '')}">
        ${dayCells}
        <td class="cal-week-badge" data-week-badge="${escapeHtml(tierName)}">${tierBadge(
          tierName,
          ranksMod
        )}</td>
      </tr>`);
    }

    root.innerHTML = `
      <section class="panel history-calendar" data-view="workoutHistory">
        <header class="cal-header">
          <div class="cal-nav">
            <button type="button" class="ghost" data-action="prev-year" title="Previous year">⟵ Y</button>
            <button type="button" class="ghost" data-action="prev-month" title="Previous month">⟵ M</button>
          </div>
          <div class="cal-title-block">
            <h1 class="cal-title">
              <span data-month-name>${escapeHtml(MONTH_NAMES[viewMonth - 1])}</span>
              <button type="button" class="cal-year-btn" data-action="zoom-year" data-year="${viewYear}">${viewYear}</button>
            </h1>
            <div class="progression month-progression" data-month-progression>
              <span class="badge-start" data-start-tier="${escapeHtml(p.startTierName)}">${tierBadge(
                p.startTierName,
                ranksMod
              )}</span>
              <span class="progression-arrow" aria-hidden="true">→</span>
              <span class="badge-end" data-end-tier="${escapeHtml(p.endTierName)}">${tierBadge(
                p.endTierName,
                ranksMod
              )}</span>
            </div>
          </div>
          <div class="cal-nav">
            <button type="button" class="ghost" data-action="next-month" title="Next month">M ⟶</button>
            <button type="button" class="ghost" data-action="next-year" title="Next year">Y ⟶</button>
          </div>
        </header>
        <table class="cal-grid" data-cal-grid>
          <thead>
            <tr><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th><th>S</th><th>Rank</th></tr>
          </thead>
          <tbody>${weekRows.join('')}</tbody>
        </table>
        <button type="button" class="ghost" data-action="back-landing">Back</button>
      </section>
    `;

    root.querySelector('[data-action="zoom-year"]').addEventListener('click', openYears);
    root.querySelectorAll('.cal-day-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDay(btn.getAttribute('data-date')));
    });
    root.querySelector('[data-action="prev-month"]').addEventListener('click', () => {
      let m = viewMonth - 1;
      let y = viewYear;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      openMonth(y, m);
    });
    root.querySelector('[data-action="next-month"]').addEventListener('click', () => {
      let m = viewMonth + 1;
      let y = viewYear;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      openMonth(y, m);
    });
    root.querySelector('[data-action="prev-year"]').addEventListener('click', () => openMonth(viewYear - 1, viewMonth));
    root.querySelector('[data-action="next-year"]').addEventListener('click', () => openMonth(viewYear + 1, viewMonth));
    const back = root.querySelector('[data-action="back-landing"]');
    if (back && options.onBack) back.addEventListener('click', options.onBack);
  }

  function render() {
    if (destroyed) return;
    if (zoom === 'years') renderYears();
    else if (zoom === 'day') renderDay();
    else renderMonth();
  }

  render();

  return {
    refresh,
    destroy,
    getRoot: () => root,
    getZoom: () => zoom,
    openDay,
    openYears,
    openMonth,
  };
}

module.exports = {
  mountHistoryCalendarView,
  MONTH_NAMES,
};
