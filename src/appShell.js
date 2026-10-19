/**
 * Feature 7 — Landing Page (shared navbar shell)
 * Spec: features/feature-7-Landing-Page.md
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const NAV_ITEMS = [
  { route: 'landing', href: '#/', label: 'Landing', icon: '⌂' },
  { route: 'history', href: '#/history', label: 'History', icon: '▦' },
  { route: 'ranks', href: '#/ranks', label: 'Ranks', icon: '★' },
  { route: 'config', href: '#/config', label: 'Config', icon: '⚙' },
];

/**
 * Build shared icon-tab navbar markup (left rail or top bar).
 */
function renderAppNavbar(activeRoute, alignment) {
  const align = alignment === 'top' ? 'top' : 'left';
  const links = NAV_ITEMS.map((item) => {
    const active = item.route === activeRoute ? ' active' : '';
    return `<a class="nav-icon-tab${active}" href="${item.href}" data-route="${escapeHtml(
      item.route
    )}" title="${escapeHtml(item.label)}" aria-label="${escapeHtml(item.label)}" ${
      item.route === activeRoute ? 'aria-current="page"' : ''
    }><span class="nav-icon" aria-hidden="true">${item.icon}</span><span class="nav-label">${escapeHtml(
      item.label
    )}</span></a>`;
  }).join('');

  return `<nav class="app-navbar app-navbar-${align}" data-navbar-alignment="${align}" aria-label="Main">${links}</nav>`;
}

module.exports = {
  renderAppNavbar,
  NAV_ITEMS,
  escapeHtml,
};
