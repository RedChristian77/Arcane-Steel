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
        // Show "On This Page" sub-nav for active page
        if (active && pageCache[page.id]) {
          const headings = pageCache[page.id].content.filter(function(c) { return c.type === 'heading'; });
          if (headings.length > 1) {
            html += '<div class="sec-subnav">';
            html += '<div class="sec-subnav-label">On This Page</div>';
            headings.forEach(function(h) {
              const hText = h.text.replace(/<[^>]*>/g, '');
              const hId = 'h-' + hText.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '');
              html += '<a class="sec-subnav-item" onclick="scrollToHeading(\'' + hId + '\')">'
                + esc(hText) + '</a>';
            });
            html += '</div>';
          }
        }
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

function scrollToHeading(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.style.transition = 'box-shadow 0.3s';
    el.style.boxShadow = '0 0 0 2px var(--accent)';
    setTimeout(function() { el.style.boxShadow = 'none'; }, 1200);
  }
  closeSidebar();
}
