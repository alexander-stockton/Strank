/**
 * Feature 4 — Weekly Ranking (History ranking contract UI)
 * Feature 6 — Custom Ranks (badgePath images on calendar)
 * Feature 9 — Workout History Calendar
 * Spec: features/feature-4-Weekly-Ranking.md FR-013–FR-020
 * Spec: features/feature-6-Custom-Ranks.md FR-009
 * Spec: features/feature-9-Workout-History-Calendar.md
 *
 * Calendar chrome aligned with Feature 9; ranking math from `ranking`.
 */

const historyCalendar = require('./historyCalendar');
const ranking = require('./ranking');
const i18n = require('./i18n');
const { mountHistoryDayView } = require('./historyDayView');
const { renderRankBadge } = require('./rankBadge');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Mount Workout History: month (default), years overview, day detail (FR-001–FR-010).
 * Back stack: day → month → landing; years → month.
 */
function tierBadge(tierName, ranksMod) {
  return ranksMod.renderBadgeHtml(tierName, 'cal-tier-badge-img');
}

function mountHistoryCalendarView(root, options = {}) {
  const cal = options.historyCalendar || historyCalendar;
  const rankSvc = options.ranking || ranking;
  const today = options.today || rankSvc.currentLocalDate();
  let destroyed = false;
  let viewYear = options.year || parseInt(today.slice(0, 4), 10);
  let viewMonth = options.month || parseInt(today.slice(5, 7), 10);
  /** 'month' | 'years' | 'day' */
  let zoom = options.zoom || 'month';
  let dayDate = options.dayDate || null;
  let priorMonth = { year: viewYear, month: viewMonth };
  let dayMount = null;

  function destroy() {
    destroyed = true;
    if (dayMount) {
      dayMount.destroy();
      dayMount = null;
    }
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
    dayDate = null;
    render();
  }

  function backFromDay() {
    if (dayDate) {
      viewYear = parseInt(dayDate.slice(0, 4), 10);
      viewMonth = parseInt(dayDate.slice(5, 7), 10);
    }
    zoom = 'month';
    dayDate = null;
    render();
  }

  function backFromYears() {
    openMonth(priorMonth.year, priorMonth.month);
  }

  function backFromMonth() {
    if (typeof options.onBack === 'function') options.onBack();
  }

  /** Navigate to the same calendar month number as "today", in the chosen year. */
  function openYearAtCurrentMonth(year) {
    const m = parseInt(today.slice(5, 7), 10);
    openMonth(year, m);
  }

  function renderYears() {
    if (dayMount) {
      dayMount.destroy();
      dayMount = null;
    }
    const overview = cal.getYearsOverview({ today });
    const years = overview.ok ? overview.data : [];
    const rows = years
      .map((row) => {
        const p = row.progression || { startTierName: 'UNRANKED', endTierName: 'UNRANKED' };
        return `<li class="year-row year-row-clickable" data-year="${row.year}" role="button" tabindex="0">
          <span class="year-label">${row.year}</span>
          <span class="progression" data-year-progression="${row.year}">
            ${renderRankBadge(p.startTierName, { dataAttr: 'data-start-tier', className: 'badge-start' })}
            <span class="progression-arrow" aria-hidden="true">→</span>
            ${renderRankBadge(p.endTierName, { dataAttr: 'data-end-tier', className: 'badge-end' })}
          </span>
        </li>`;
      })
      .join('');

    root.innerHTML = `
      <section class="panel history-calendar" data-view="historyYears">
        <header class="cal-header">
          <h1>${escapeHtml(i18n.t('history.years'))}</h1>
          <button type="button" class="ghost" data-action="back">${escapeHtml(i18n.t('common.back'))}</button>
        </header>
        <ul class="years-list" data-years-list>${rows || `<li class="empty-state">${escapeHtml(i18n.t('history.noYears'))}</li>`}</ul>
      </section>
    `;

    root.querySelector('[data-action="back"]').addEventListener('click', backFromYears);
    root.querySelectorAll('.year-row-clickable').forEach((row) => {
      const go = () => openYearAtCurrentMonth(parseInt(row.getAttribute('data-year'), 10));
      row.addEventListener('click', go);
      row.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          go();
        }
      });
    });
  }

  function renderDay() {
    if (dayMount) {
      dayMount.destroy();
      dayMount = null;
    }
    root.innerHTML = '';
    dayMount = mountHistoryDayView(root, {
      localDate: dayDate,
      today,
      historyCalendar: cal,
      history: options.history,
      catalog: options.catalog,
      confirm: options.confirm,
      onBack: backFromDay,
      onNavigateDay: (next) => {
        dayDate = next;
      },
    });
  }

  function renderMonth() {
    if (dayMount) {
      dayMount.destroy();
      dayMount = null;
    }
    const monthModel = cal.getMonth(viewYear, viewMonth, { today });
    if (!monthModel.ok) {
      root.innerHTML = `
        <section class="panel history-calendar" data-view="workoutHistory">
          <p class="inline-alert" role="alert">${escapeHtml(monthModel.message || i18n.t('history.loadMonthFailed'))}</p>
          <button type="button" class="ghost" data-action="back-landing">${escapeHtml(i18n.t('common.back'))}</button>
        </section>`;
      const back = root.querySelector('[data-action="back-landing"]');
      if (back) back.addEventListener('click', backFromMonth);
      return;
    }

    const { weeks, progression: p } = monthModel.data;
    const monthName = i18n.monthName(viewMonth);

    const weekRows = weeks
      .map((week) => {
        const dayCells = week.days
          .map((cell) => {
            const cls = [
              'cal-day',
              cell.recorded ? 'recorded' : 'unrecorded',
              cell.inMonth ? '' : 'muted',
            ]
              .filter(Boolean)
              .join(' ');
            return `<td class="${cls}" data-date="${escapeHtml(cell.localDate)}" data-recorded="${
              cell.recorded ? 'true' : 'false'
            }" data-in-month="${cell.inMonth ? 'true' : 'false'}">
              <button type="button" class="cal-day-btn" data-date="${escapeHtml(cell.localDate)}">${
              cell.dayNumber
            }</button>
            </td>`;
          })
          .join('');

        return `<tr class="cal-week" data-week-start="${escapeHtml(week.weekStart)}">
          ${dayCells}
          <td class="cal-week-badge-cell">${renderRankBadge(week.tierName, {
            dataAttr: 'data-week-badge',
            className: 'cal-week-badge',
          })}</td>
        </tr>`;
      })
      .join('');

    root.innerHTML = `
      <section class="panel history-calendar" data-view="workoutHistory">
        <header class="cal-header">
          <div class="cal-nav">
            <button type="button" class="ghost" data-action="prev-year" title="${escapeHtml(i18n.t('history.prevYearTitle'))}">${escapeHtml(i18n.t('history.prevYear'))}</button>
            <button type="button" class="ghost" data-action="prev-month" title="${escapeHtml(i18n.t('history.prevMonthTitle'))}">${escapeHtml(i18n.t('history.prevMonth'))}</button>
          </div>
          <div class="cal-title-block">
            <h1 class="cal-title" data-cal-heading>
              <span data-month-name>${escapeHtml(monthName)}</span>
              <button type="button" class="cal-year-btn ghost" data-action="zoom-year" data-year="${viewYear}">${viewYear}</button>
            </h1>
            <div class="progression month-progression" data-month-progression>
              ${renderRankBadge(p.startTierName, { dataAttr: 'data-start-tier', className: 'badge-start' })}
              <span class="progression-arrow" aria-hidden="true">→</span>
              ${renderRankBadge(p.endTierName, { dataAttr: 'data-end-tier', className: 'badge-end' })}
            </div>
          </div>
          <div class="cal-nav">
            <button type="button" class="ghost" data-action="next-month" title="${escapeHtml(i18n.t('history.nextMonthTitle'))}">${escapeHtml(i18n.t('history.nextMonth'))}</button>
            <button type="button" class="ghost" data-action="next-year" title="${escapeHtml(i18n.t('history.nextYearTitle'))}">${escapeHtml(i18n.t('history.nextYear'))}</button>
          </div>
        </header>
        <table class="cal-grid" data-cal-grid>
          <thead>
            <tr><th>${escapeHtml(i18n.calendarWeekday('mon'))}</th><th>${escapeHtml(i18n.calendarWeekday('tue'))}</th><th>${escapeHtml(i18n.calendarWeekday('wed'))}</th><th>${escapeHtml(i18n.calendarWeekday('thu'))}</th><th>${escapeHtml(i18n.calendarWeekday('fri'))}</th><th>${escapeHtml(i18n.calendarWeekday('sat'))}</th><th>${escapeHtml(i18n.calendarWeekday('sun'))}</th><th>${escapeHtml(i18n.t('history.rankColumn'))}</th></tr>
          </thead>
          <tbody>${weekRows}</tbody>
        </table>
        <button type="button" class="ghost" data-action="back-landing">${escapeHtml(i18n.t('common.back'))}</button>
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
    root.querySelector('[data-action="back-landing"]').addEventListener('click', backFromMonth);
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
    getViewMonth: () => ({ year: viewYear, month: viewMonth }),
    openDay,
    openYears,
    openMonth,
  };
}

module.exports = {
  mountHistoryCalendarView,
  MONTH_NAMES: historyCalendar.MONTH_NAMES,
};
