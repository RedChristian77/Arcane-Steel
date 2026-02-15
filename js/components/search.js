/* ============================================================
   SEARCH — Full-text search across all pages
   ============================================================ */
let searchIndex = null;

function buildSearchIndex(pageCache, manifest) {
  searchIndex = [];
  function indexEntry(entry, sectionTitle) {
    const page = pageCache[entry.id];
    if (!page) return;
    const texts = [];
    page.content.forEach(item => {
      if (item.text) texts.push(stripHtml(item.text));
      if (item.rows) item.rows.forEach(r => r.forEach(c => texts.push(stripHtml(c))));
      if (item.headers) item.headers.forEach(h => texts.push(stripHtml(h)));
    });
    const full = texts.join(' ');
    if (full.trim()) {
      searchIndex.push({
        pageId: entry.id,
        pageTitle: entry.title,
        sectionTitle: sectionTitle,
        text: full,
        lower: full.toLowerCase()
      });
    }
  }
  manifest.sections.forEach(section => {
    section.pages.forEach(entry => {
      indexEntry(entry, section.title);
      if (entry.children) entry.children.forEach(c => indexEntry(c, section.title));
    });
  });
}

function doSearch(query) {
  const el = document.getElementById('searchResults');
  if (!query || query.length < 2) {
    el.innerHTML = '<div class="search-empty">Type to search…</div>';
    return;
  }
  if (!searchIndex && typeof loadAllPagesForSearch === 'function') {
    loadAllPagesForSearch();
  }
  if (!searchIndex) {
    el.innerHTML = '<div class="search-empty">Loading…</div>';
    return;
  }
  const q = query.toLowerCase();
  const hits = [];
  searchIndex.forEach(entry => {
    const idx = entry.lower.indexOf(q);
    if (idx === -1) return;
    const start = Math.max(0, idx - 40);
    const end = Math.min(entry.text.length, idx + query.length + 60);
    let snip = (start > 0 ? '…' : '') + entry.text.substring(start, end) + (end < entry.text.length ? '…' : '');
    const re = new RegExp('(' + escRegex(query) + ')', 'gi');
    snip = esc(snip).replace(re, '<mark>$1</mark>');
    hits.push({ ...entry, snip });
  });
  if (!hits.length) {
    el.innerHTML = '<div class="search-empty">No results for "' + esc(query) + '"</div>';
    return;
  }
  el.innerHTML = hits.slice(0, 25).map(h =>
    '<div class="search-hit" onclick="closeSearch();navigateTo(\'' + h.pageId + '\')">'
    + '<div class="search-hit-ch">' + esc(h.sectionTitle) + '</div>'
    + '<div class="search-hit-title">' + esc(h.pageTitle) + '</div>'
    + '<div class="search-hit-snip">' + h.snip + '</div></div>'
  ).join('') + (hits.length > 25 ? '<div class="search-empty">' + (hits.length-25) + ' more…</div>' : '');
}

function openSearch() {
  document.getElementById('searchOverlay').classList.add('open');
  const inp = document.getElementById('searchInput');
  inp.focus(); inp.value = '';
  document.getElementById('searchResults').innerHTML = '<div class="search-empty">Type to search…</div>';
}
function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('open');
}
function stripHtml(h) { const d = document.createElement('div'); d.innerHTML = h; return d.textContent || ''; }
function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
