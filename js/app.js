/* ============================================================
   APP — Main orchestrator for the v2 page-based structure
   ============================================================ */

window._manifest = null;
window._currentPage = 'home';
let pageCache = {};

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

async function loadManifest() {
  const resp = await fetch('data/manifest.json');
  window._manifest = await resp.json();
  return window._manifest;
}

function findPage(pageId) {
  for (const section of window._manifest.sections) {
    for (const page of section.pages) {
      if (page.id === pageId) return page;
      if (page.children) {
        for (const child of page.children) {
          if (child.id === pageId) return child;
        }
      }
    }
  }
  return null;
}

async function loadPage(pageId) {
  if (pageCache[pageId]) return pageCache[pageId];
  const entry = findPage(pageId);
  if (!entry) return null;
  const resp = await fetch('data/' + entry.file);
  const data = await resp.json();
  pageCache[pageId] = data;
  return data;
}

async function loadAllPagesForSearch() {
  const promises = [];
  window._manifest.sections.forEach(s => {
    s.pages.forEach(p => {
      promises.push(loadPage(p.id));
      if (p.children) p.children.forEach(c => promises.push(loadPage(c.id)));
    });
  });
  await Promise.all(promises);
  buildSearchIndex(pageCache, window._manifest);
}

async function navigateTo(pageId) {
  window._currentPage = pageId;
  const main = document.getElementById('mainContent');

  if (pageId === 'home') {
    main.innerHTML = renderHome(window._manifest);
  } else {
    const data = await loadPage(pageId);
    if (data) {
      main.innerHTML = renderPage(data, window._manifest);
    } else {
      main.innerHTML = '<div class="container"><p>Page not found: ' + esc(pageId) + '</p></div>';
    }
  }

  renderSidebar(window._manifest, pageId);
  window.scrollTo(0, 0);
  closeSidebar();
  history.replaceState(null, '', '#' + pageId);
  updateProgress();
}

document.addEventListener('DOMContentLoaded', async () => {
  restoreTheme();
  await loadManifest();
  const hash = location.hash.replace('#', '');
  if (hash) window._currentPage = hash;
  await navigateTo(window._currentPage);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === '/' && !e.target.matches('input, textarea')) { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') { closeSearch(); closeSidebar(); }
  });
  window.addEventListener('scroll', updateProgress);
  setTimeout(() => loadAllPagesForSearch(), 800);
});
