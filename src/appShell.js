/**
 * Feature 7 — Landing Page (shared navbar shell)
 * Spec: features/feature-7-Landing-Page.md
 * Feature 14 — Landing Layout & Day Focus (navbar footer slot)
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const { t, th } = require('./i18n');
const navbarUtilities = require('./navbarUtilities');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const NAV_ITEMS = [
  { route: 'landing', href: '#/', labelKey: 'nav.landing', icon: '⌂' },
  { route: 'history', href: '#/history', labelKey: 'nav.history', icon: '▦' },
  { route: 'ranks', href: '#/ranks', labelKey: 'nav.ranks', icon: '★' },
  { route: 'config', href: '#/config', labelKey: 'nav.config', icon: '⚙' },
];

/**
 * Build shared icon-tab navbar markup (left rail or top bar).
 * @param {string} activeRoute
 * @param {string} alignment
 * @param {{ footerHtml?: string }} [options] — Day Focus / Edit Ranks / Privacy (rail bottom or top-right)
 */
function renderAppNavbar(activeRoute, alignment, options = {}) {
  const align = alignment === 'top' ? 'top' : 'left';
  const links = NAV_ITEMS.map((item) => {
    const active = item.route === activeRoute ? ' active' : '';
    const label = escapeHtml(t(item.labelKey));
    return `<a class="nav-icon-tab${active}" href="${item.href}" data-route="${escapeHtml(
      item.route
    )}" title="${label}" aria-label="${label}" ${
      item.route === activeRoute ? 'aria-current="page"' : ''
    }><span class="nav-icon" aria-hidden="true">${item.icon}</span><span class="nav-label">${label}</span></a>`;
  }).join('');

  // Left: bottom of rail. Top: trailing end of bar (mirrors left placement).
  // Always visible opposite the nav tabs (Day Focus, Edit Ranks, Privacy).
  const footerHtml =
    typeof options.footerHtml === 'string' ? options.footerHtml : navbarUtilities.renderUtilitiesHtml();
  const menuHost = `<div class="app-navbar-end" data-landing-menu-host="navbar">${footerHtml}</div>`;

  return `<nav class="app-navbar app-navbar-${align}" data-navbar-alignment="${align}" aria-label="${th('nav.main')}">
    <div class="app-navbar-links">${links}</div>
    ${menuHost}
  </nav>`;
}

module.exports = {
  renderAppNavbar,
  NAV_ITEMS,
  escapeHtml,
};
