/* ============================================================
   SIDEBAR — Collapsible section groups with page links
   ============================================================ */

// Track which sidebar sections are expanded
let sidebarState = {};

function renderSidebar(manifest, currentPageId) {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;

  let html = '<a class="nav-item' + (currentPageId === 'home' ? ' active' : '') + '" '
    + 'onclick="navigateTo(\'home\')">'
    + '<span class="nav-ico">⌂</span> Home</a>';

  manifest.sections.forEach((section, sIdx) => {
    const isActive = section.pages.some(p => p.id === currentPageId);
    const isOpen = sidebarState[sIdx] !== undefined ? sidebarState[sIdx] : isActive;

    html += '<div class="nav-group' + (isOpen ? ' open' : '') + '">'
      + '<div class="nav-group-hdr" onclick="toggleNavGroup(' + sIdx + ')">'
      + '<span class="nav-group-ico">' + section.icon + '</span>'
      + '<span class="nav-group-title">' + esc(section.title) + '</span>'
      + '<span class="nav-group-arrow">' + (isOpen ? '▾' : '▸') + '</span>'
      + '</div>';

    if (isOpen) {
      html += '<div class="nav-group-pages">';
      section.pages.forEach(page => {
        const active = page.id === currentPageId;
        html += '<a class="nav-page' + (active ? ' active' : '') + '" '
          + 'onclick="navigateTo(\'' + page.id + '\')">'
          + esc(page.title) + '</a>';
      });
      html += '</div>';
    }

    html += '</div>';
  });

  // Builder link
  html += '<a class="nav-item builder" href="builder.html">'
    + '<span class="nav-ico">⚙</span> Character Builder</a>';

  nav.innerHTML = html;
}

function toggleNavGroup(idx) {
  sidebarState[idx] = !sidebarState[idx];
  renderSidebar(window._manifest, window._currentPage);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
