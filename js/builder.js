/* ============================================================
   BUILDER — Contractor Intake & THE DOSSIER
   Replaces the legacy React builder entirely. Vanilla JS, no build step.

   The character sheet is THE CORP'S FILE ON YOU. A new character's
   dossier renders its EMPTY fields — scar count 0, licenses NONE,
   obligations NONE, an augment manifest with one lonely entry.
   The empty fields are the character arc, printed as paperwork.

   ONE-PLACE LAW: this file owns ZERO catalog numbers. Résumés, traits,
   kits, techniques, weapons, armor, species and tree entry augments are
   all PARSED FROM THE BOOK at runtime. The only rules hard-coded here
   are the four creation rulings + derived block from
   design/rebuild-2026-06/arcane-steel-creation-rulings-v1.md, which are
   the builder's binding spec (array 8/7/6/5/4, point-buy 30 / min 3 /
   max 8, the canonical bonus table, HP = 16 + 2×Grit bonus, etc.).

   Part 1 (parsers) is pure and shared with tools/test-builder-catalogs.js
   via module.exports; the browser app begins after the node guard.
   ============================================================ */
(function (root) {
'use strict';

/* ==================================================================
   PART 1 — CATALOG PARSERS (pure functions; no DOM)
   ================================================================== */

function stripTags(html) {
  return String(html == null ? '' : html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); });
}
function clean(html) { return decodeEntities(stripTags(html)); }
function slug(name) {
  return clean(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function parseCr(s) {
  var m = String(s).replace(/,/g, '').match(/(\d+)\s*cr/i);
  return m ? parseInt(m[1], 10) : null;
}

/* The canonical bonus table — creation-rulings-v1:
   2–3:+0 · 4–5:+1 · 6–7:+2 · 8–9:+3 · 10:+4 · 11–12:+5 · 13–14:+6 · 15–16:+7 · 17–19:+8 · 20:+9 */
function bonusOf(v) {
  if (v == null || isNaN(v)) return null;
  v = Number(v);
  if (v <= 3) return 0;
  if (v <= 5) return 1;
  if (v <= 7) return 2;
  if (v <= 9) return 3;
  if (v === 10) return 4;
  if (v <= 12) return 5;
  if (v <= 14) return 6;
  if (v <= 16) return 7;
  if (v <= 19) return 8;
  return 9;
}

function findTables(page) {
  return (page && page.content || []).filter(function (b) { return b.type === 'table'; });
}
function findTable(page, firstHeader) {
  var t = findTables(page).filter(function (b) {
    return b.headers && clean(b.headers[0]).toLowerCase().indexOf(firstHeader.toLowerCase()) === 0;
  });
  return t.length ? t[0] : null;
}

/* --- pc-creation-resumes.json: table "Résumé | Skill Tier 1s | Standing | Credits" --- */
function parseResumes(page) {
  var t = findTable(page, 'Résumé') || findTable(page, 'Resume');
  if (!t) return [];
  return t.rows.map(function (r) {
    return {
      id: slug(r[0]),
      name: clean(r[0]),
      skills: clean(r[1]).split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      standing: clean(r[2]),
      credits: parseCr(r[3])
    };
  });
}

/* --- pc-creation-traits.json: table "Trait | The gift | The ledger line" --- */
function parseTraits(page) {
  var t = findTable(page, 'Trait');
  if (!t) return [];
  return t.rows.map(function (r) {
    return { id: slug(r[0]), name: clean(r[0]), gift: clean(r[1]), ledger: clean(r[2]) };
  });
}

/* Kit tree name -> tree page id ("Sin Eater" -> pc-trees-sineater) */
function treeIdForKit(treeName) {
  return 'pc-trees-' + String(treeName).toLowerCase().replace(/[^a-z]/g, '');
}

/* --- pc-creation-kits.json: kit-grid block + Custom budget paragraph --- */
function parseKits(page) {
  var grid = (page && page.content || []).filter(function (b) { return b.type === 'kit-grid'; })[0];
  var kits = (grid && grid.kits || []).map(function (k) {
    return {
      id: slug(k.name),
      name: k.name,
      icon: k.icon || '',
      lean: k.lean || '',
      desc: k.desc || '',
      tree: k.tree,
      treeId: treeIdForKit(k.tree),
      augName: clean(String(k.aug || '').replace(/\s*\(free\)\s*/i, '')),
      gear: k.gear || ''
    };
  });
  var customBudget = null;
  (page && page.content || []).forEach(function (b) {
    if (b.type === 'paragraph' && /<strong>\s*Custom:\s*<\/strong>/i.test(b.text || '')) {
      var m = String(b.text).replace(/,/g, '').match(/(\d+)\s*cr of any legal/i);
      if (m) customBudget = parseInt(m[1], 10);
    }
  });
  return { kits: kits, customBudget: customBudget };
}

/* --- pc-techniques.json: ability paragraphs
   pattern: <strong>Name (Passive|Active, X AP):</strong> effect
   under "Trained/Advanced/Master Techniques" headings --- */
function parseTechniques(page) {
  var rung = null, out = [];
  var re = /^<strong>\s*([^<(]+?)\s*\(\s*(Passive|Active)\s*(?:,\s*(\d+)\s*AP\s*)?\)\s*:\s*<\/strong>\s*([\s\S]*)$/i;
  (page && page.content || []).forEach(function (b) {
    if (b.type === 'heading') {
      var h = clean(b.text);
      var m = h.match(/^(Trained|Advanced|Master)\s+Techniques/i);
      rung = m ? m[1].toLowerCase() : null;
      return;
    }
    if (rung && b.type === 'paragraph' && b.text) {
      var mm = String(b.text).match(re);
      if (mm) {
        out.push({
          id: slug(mm[1]),
          name: clean(mm[1]),
          kind: mm[2].charAt(0).toUpperCase() + mm[2].slice(1).toLowerCase(),
          ap: mm[3] ? parseInt(mm[3], 10) : null,
          rung: rung,
          effect: clean(mm[4])
        });
      }
    }
  });
  return out;
}

/* --- pc-equipment-weapons.json: the attack-stat-by-class table + the catalog table --- */
function statKeyFromCell(html) {
  var m = clean(html).match(/\b(Chrome|Reflex|Grit|Interface|Edge)\b/i);
  return m ? m[1].toLowerCase() : null;
}
/* RULING 4 (also printed as the page's own table): light melee (wt 1) -> Reflex;
   standard & heavy melee (wt 2–3) -> Chrome; all guns -> Reflex. */
function attackStatFor(weapon) {
  if (/^Adjacent$/i.test(String(weapon.range).trim())) {
    return weapon.weight <= 1 ? 'reflex' : 'chrome';
  }
  return 'reflex';
}
function parseWeapons(page) {
  var statT = findTable(page, 'Weapon class');
  var attackStats = statT ? statT.rows.map(function (r) {
    return { cls: clean(r[0]), statText: clean(r[1]), stat: statKeyFromCell(r[1]) };
  }) : [];
  var catT = null;
  findTables(page).forEach(function (t) {
    if (clean(t.headers[0]).toLowerCase() === 'weapon' && t.headers.length >= 6) catT = catT || t;
  });
  var weapons = catT ? catT.rows.map(function (r) {
    var notesHtml = String(r[6] == null ? '' : r[6]);
    var tags = [];
    var tagRe = /<strong>([^<]+)<\/strong>/g, m;
    while ((m = tagRe.exec(notesHtml)) !== null) tags.push(clean(m[1]));
    if (/two-handed/i.test(notesHtml)) tags.push('two-handed');
    var w = {
      id: slug(r[0]),
      name: clean(r[0]),
      acc_die: clean(r[1]),
      damage_dice: clean(r[2]),
      ap: parseInt(clean(r[3]), 10),
      weight: parseInt(clean(r[4]), 10),
      range: clean(r[5]),
      tags: tags,
      note: clean(notesHtml)
    };
    w.attack_stat = attackStatFor(w);
    return w;
  }) : [];
  return { attackStats: attackStats, weapons: weapons };
}

/* --- pc-equipment-armor.json: "Armor | Value | Absorb | Armor HP | Evasion cap | Price" --- */
function parseArmor(page) {
  var t = findTable(page, 'Armor');
  if (!t) return [];
  return t.rows.map(function (r) {
    var cap = clean(r[4]);
    return {
      id: slug(r[0]),
      name: clean(r[0]),
      value: parseInt(clean(r[1]), 10),
      absorb: parseInt(clean(r[2]), 10),
      armor_hp: parseInt(clean(r[3]), 10),
      ev_cap: /^\d+$/.test(cap) ? parseInt(cap, 10) : null,
      price: parseCr(r[5])
    };
  });
}

/* --- races-overview.json: "Species at a Glance" table — name + 1-line summary.
   NOTE: the registry prints SEVEN playable species. --- */
function parseSpecies(page) {
  var t = findTable(page, 'Species');
  if (!t) return [];
  return t.rows.map(function (r) {
    var cell = clean(r[0]);
    var parts = cell.split(/\s+/);
    var icon = /^[A-Za-z]/.test(parts[0]) ? '' : parts.shift();
    var name = parts.join(' ');
    return {
      id: slug(name),
      name: name,
      icon: icon,
      headline: clean(r[1]),
      bill: clean(r[2]),
      pageId: 'races-' + slug(name)
    };
  });
}

/* --- pc-trees-*.json: first tree-tier block with req "Entry" is the tree's
   shared entry — the augment every kit installs free. --- */
function parseTreeEntry(page) {
  var blocks = (page && page.content || []).filter(function (b) {
    return b.type === 'tree-tier' && /^entry/i.test(String(b.req || '').trim());
  });
  if (!blocks.length || !blocks[0].augments || !blocks[0].augments.length) return null;
  var a = blocks[0].augments[0];
  return {
    treeId: page.id,
    treeName: clean(page.title),
    augment: { id: slug(a.name), name: clean(a.name), cost: a.cost || '', effect: clean(a.effect || '') }
  };
}
/* resolve a kit-named augment anywhere in its tree page (cross-check) */
function resolveAugmentInTree(page, augName) {
  var want = slug(augName), found = null;
  (page && page.content || []).forEach(function (b) {
    if (b.type === 'tree-tier' && b.augments) {
      b.augments.forEach(function (a) {
        if (slug(a.name) === want) found = found || { id: slug(a.name), name: clean(a.name), cost: a.cost || '', effect: clean(a.effect || ''), req: b.req };
      });
    }
  });
  return found;
}

var TREE_PAGE_IDS = ['pc-trees-channeler', 'pc-trees-dancer', 'pc-trees-fortress', 'pc-trees-fury',
  'pc-trees-influence', 'pc-trees-leech', 'pc-trees-precision', 'pc-trees-shadow',
  'pc-trees-sineater', 'pc-trees-systems'];

/* Defensive expectations. If a parse yields unexpected counts the page shows a
   CATALOG PARSE NOTICE instead of failing silently. The registry prints seven
   playable species (races-overview), so seven is the expected species count. */
function validateCatalogs(cat) {
  var issues = [];
  function expect(label, got, want) { if (got !== want) issues.push(label + ': expected ' + want + ', parsed ' + got); }
  expect('résumés', cat.resumes.length, 10);
  expect('traits', cat.traits.length, 10);
  expect('kits', cat.kits.length, 10);
  if (cat.customBudget == null) issues.push('Custom kit budget: not found on Kits page');
  var trained = cat.techniques.filter(function (t) { return t.rung === 'trained'; });
  if (trained.length < 8) issues.push('Trained techniques: expected ≥8, parsed ' + trained.length);
  expect('weapons', cat.weapons.length, 11);
  cat.weapons.forEach(function (w) {
    if (!w.attack_stat) issues.push('weapon "' + w.name + '": no attack stat resolved');
    if (!/^d\d+$/.test(w.acc_die)) issues.push('weapon "' + w.name + '": bad accuracy die "' + w.acc_die + '"');
  });
  if (cat.attackStats.length < 4) issues.push('attack-stat table: expected ≥4 classes, parsed ' + cat.attackStats.length);
  expect('armor tiers', cat.armor.length, 7);
  expect('tree entry augments', Object.keys(cat.treeEntries).length, 10);
  expect('species (registry prints seven)', cat.species.length, 7);
  cat.kits.forEach(function (k) {
    var entry = cat.treeEntries[k.treeId];
    if (!entry) { issues.push('kit "' + k.name + '": tree page ' + k.treeId + ' missing'); return; }
    if (entry.augment.id !== slug(k.augName)) {
      issues.push('kit "' + k.name + '": names entry augment "' + k.augName + '" but tree entry is "' + entry.augment.name + '"');
    }
  });
  return issues;
}

function indexBy(list) {
  var m = {};
  (list || []).forEach(function (x) { m[x.id] = x; });
  return m;
}

/* Assemble all catalogs from a map of pageId -> page JSON (pure; node-testable). */
function buildCatalogs(byId) {
  var kitsParsed = parseKits(byId['pc-creation-kits']);
  var weaponsParsed = parseWeapons(byId['pc-equipment-weapons']);
  var treeEntries = {}, treePages = {};
  TREE_PAGE_IDS.forEach(function (tid) {
    if (byId[tid]) {
      treePages[tid] = byId[tid];
      var e = parseTreeEntry(byId[tid]);
      if (e) treeEntries[tid] = e;
    }
  });
  var cat = {
    resumes: parseResumes(byId['pc-creation-resumes']),
    traits: parseTraits(byId['pc-creation-traits']),
    kits: kitsParsed.kits,
    customBudget: kitsParsed.customBudget,
    techniques: parseTechniques(byId['pc-techniques']),
    weapons: weaponsParsed.weapons,
    attackStats: weaponsParsed.attackStats,
    armor: parseArmor(byId['pc-equipment-armor']),
    species: parseSpecies(byId['races-overview']),
    treeEntries: treeEntries,
    treePages: treePages,
    loadErrors: []
  };
  cat.resumesById = indexBy(cat.resumes);
  cat.traitsById = indexBy(cat.traits);
  cat.kitsById = indexBy(cat.kits);
  cat.techniquesById = indexBy(cat.techniques);
  cat.weaponsById = indexBy(cat.weapons);
  cat.armorById = indexBy(cat.armor);
  cat.speciesById = indexBy(cat.species);
  return cat;
}

var Parsers = {
  stripTags: stripTags, clean: clean, slug: slug, parseCr: parseCr, bonusOf: bonusOf,
  parseResumes: parseResumes, parseTraits: parseTraits, parseKits: parseKits,
  parseTechniques: parseTechniques, parseWeapons: parseWeapons, parseArmor: parseArmor,
  parseSpecies: parseSpecies, parseTreeEntry: parseTreeEntry,
  resolveAugmentInTree: resolveAugmentInTree, attackStatFor: attackStatFor,
  treeIdForKit: treeIdForKit, validateCatalogs: validateCatalogs, TREE_PAGE_IDS: TREE_PAGE_IDS,
  buildCatalogs: buildCatalogs, indexBy: indexBy
};
if (typeof module !== 'undefined' && module.exports) module.exports = Parsers;
root.ASBuilderParsers = Parsers;

/* node? parsers only — the app below needs a browser. */
if (typeof window === 'undefined' || typeof document === 'undefined') return;

/* ==================================================================
   PART 2 — THE INTAKE APP (browser only)
   ================================================================== */

var STAT_KEYS = ['chrome', 'reflex', 'grit', 'interface', 'edge'];
var STAT_LABELS = { chrome: 'Chrome', reflex: 'Reflex', grit: 'Grit', interface: 'Interface', edge: 'Edge' };
var ARRAY_VALUES = [8, 7, 6, 5, 4];          /* RULING 1 */
var PB_BUDGET = 30, PB_MIN = 3, PB_MAX = 8;  /* RULING 1, point-buy variant */
var AUTOSAVE_KEY = 'as-builder-v2-autosave';
var SLOTS_KEY = 'as-builder-v2-slots';

var CAT = null;        /* parsed catalogs */
var state = defaultState();

function defaultState() {
  return {
    name: '', notes: '',
    resume: null, species: null, trait: null,
    statMode: 'array',
    stats: { chrome: null, reflex: null, grit: null, interface: null, edge: null },
    pb: { chrome: 3, reflex: 3, grit: 3, interface: 3, edge: 3 },
    kit: null, technique: null, techniqueOldHands: null,
    customTree: null, customWeapons: [], customArmor: null,
    creditsOverride: null
  };
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}
function fmtBonus(b) { return b == null ? '—' : (b >= 0 ? '+' + b : '' + b); }
function fmtCr(n) { return n == null ? '—' : n.toLocaleString('en-US') + ' cr'; }

/* ---------------- catalog loader (fetch, bundle fallback like index.html) ---------------- */
var _fileById = null;
function loadManifest() {
  return fetch('data/manifest.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .catch(function (e) {
      if (window._BUNDLE && window._BUNDLE.manifest) return window._BUNDLE.manifest;
      throw e;
    })
    .then(function (manifest) {
      _fileById = {};
      (manifest.sections || []).forEach(function (s) {
        (s.pages || []).forEach(function (p) {
          _fileById[p.id] = p.file;
          (p.children || []).forEach(function (c) { _fileById[c.id] = c.file; });
        });
      });
    })
    .catch(function () { _fileById = {}; });
}
function loadPage(id) {
  var file = (_fileById && _fileById[id]) || ('pages/' + id + '.json');
  return fetch('data/' + file, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .catch(function (e) {
      if (window._BUNDLE && window._BUNDLE.pages && window._BUNDLE.pages[id]) return window._BUNDLE.pages[id];
      throw new Error('page ' + id + ' unavailable: ' + e.message);
    });
}

function loadCatalogs() {
  var coreIds = ['pc-creation-resumes', 'pc-creation-traits', 'pc-creation-kits', 'pc-techniques',
    'pc-equipment-weapons', 'pc-equipment-armor', 'races-overview'];
  var loadErrors = [];
  function safe(id) { return loadPage(id).catch(function (e) { loadErrors.push(e.message); return null; }); }
  return loadManifest().then(function () {
    return Promise.all(coreIds.concat(TREE_PAGE_IDS).map(safe));
  }).then(function (pages) {
    var byId = {};
    pages.forEach(function (p) { if (p && p.id) byId[p.id] = p; });
    var cat = buildCatalogs(byId);
    cat.loadErrors = loadErrors;
    return cat;
  });
}

/* ---------------- gear resolution (kit gear strings -> catalog entries) ---------------- */
function gearTokens(gearStr) {
  var out = [];
  String(gearStr || '').split(',').forEach(function (part) {
    part.split(/\s+and\s+/i).forEach(function (t) { t = t.trim(); if (t) out.push(t); });
  });
  return out;
}
function matchWeapon(token) {
  var s = slug(token);
  return CAT.weapons.filter(function (w) { return w.id === s; })[0] || null;
}
function matchArmor(token) {
  var s = slug(token).replace(/-std$/, '-standard');
  return CAT.armor.filter(function (a) { return a.id === s; })[0] || null;
}
function resolveGear(gearStr) {
  var weapons = [], armor = null, notes = [];
  gearTokens(gearStr).forEach(function (t) {
    var w = matchWeapon(t);
    if (w) { weapons.push(w); return; }
    var a = matchArmor(t);
    if (a && !armor) { armor = a; return; }
    notes.push(t);
  });
  return { weapons: weapons, armor: armor, notes: notes };
}

/* ---------------- recompute pipeline — the derived block, exactly as ruled ---------------- */
function currentStats() {
  var src = state.statMode === 'array' ? state.stats : state.pb;
  var o = {};
  STAT_KEYS.forEach(function (k) { o[k] = src[k]; });
  return o;
}
function customSpent() {
  var spent = 0;
  state.customWeapons.forEach(function (cw) { spent += Number(cw.price) || 0; });
  if (state.customArmor && CAT.armorById[state.customArmor]) spent += CAT.armorById[state.customArmor].price || 0;
  return spent;
}

function derive() {
  var s = currentStats();
  var b = {};
  STAT_KEYS.forEach(function (k) { b[k] = bonusOf(s[k]); });

  var resume = state.resume ? CAT.resumesById[state.resume] : null;
  var species = state.species ? CAT.speciesById[state.species] : null;
  var trait = state.trait ? CAT.traitsById[state.trait] : null;
  var isCustom = state.kit === 'custom';
  var kit = (state.kit && !isCustom) ? CAT.kitsById[state.kit] : null;

  /* gear */
  var weapons = [], armor = null, gearNotes = [];
  if (kit) {
    var g = resolveGear(kit.gear);
    weapons = g.weapons; armor = g.armor; gearNotes = g.notes;
  } else if (isCustom) {
    state.customWeapons.forEach(function (cw) {
      var w = CAT.weaponsById[cw.id];
      if (w) weapons.push(w);
    });
    armor = state.customArmor ? (CAT.armorById[state.customArmor] || null) : null;
  }

  /* tree entry augment — the manifest's one lonely entry */
  var treeId = kit ? kit.treeId : (isCustom ? state.customTree : null);
  var entry = treeId ? CAT.treeEntries[treeId] : null;
  var augment = entry ? entry.augment : null;
  var treeName = entry ? entry.treeName : null;

  /* Evasion = 3 + Edge bonus + Reflex bonus, capped by worn armor */
  var evRaw = (b.edge != null && b.reflex != null) ? 3 + b.edge + b.reflex : null;
  var evCap = armor ? armor.ev_cap : null;
  if (evCap != null && trait && trait.id === 'heavy-frame') evCap -= 1; /* trait ledger: EV cap −1 */
  var evasion = evRaw == null ? null : (evCap != null ? Math.min(evRaw, evCap) : evRaw);

  /* Max Flesh HP = 16 + 2 × Grit bonus, then race/trait modifiers */
  var hp = null, hpMods = [];
  if (b.grit != null) {
    hp = 16 + 2 * b.grit;
    if (trait && trait.id === 'heavy-frame') { hp += 2; hpMods.push('+2 Heavy Frame'); }
    if (species && species.id === 'flicker') { hp -= 2; hpMods.push('−2 Flicker'); }
  }

  /* Free vent = Grit bonus (Human −1 min 1; Vael +1; vent bonuses cap at +2 total) */
  var vent = null, ventNote = '';
  if (b.grit != null) {
    var delta = 0;
    if (species && species.id === 'human') { delta = -1; ventNote = 'Human −1, min 1'; }
    if (species && species.id === 'vael') { delta = Math.min(1, 2); ventNote = 'Vael +1 (bonus cap +2)'; }
    vent = b.grit + delta;
    if (species && species.id === 'human') vent = Math.max(1, vent);
  }

  /* Starting state: scars 0 (Survivor: 1, no debuff); Saturation 0 (Rift-Touched: floor 5) */
  var scars = (trait && trait.id === 'survivor') ? 1 : 0;
  var satFloor = (trait && trait.id === 'rift-touched') ? 5 : 0;
  var saturation = satFloor; /* starts at its floor */

  /* Fate Roll = d20 + 2×Grit bonus vs 10 + 2×untreated scars */
  var fate = (b.grit != null) ? { mod: 2 * b.grit, dc: 10 + 2 * scars } : null;

  /* Starting credits = résumé line + unspent Custom-kit budget */
  var credits = null, unspent = null, overBudget = false;
  if (resume) {
    credits = resume.credits;
    if (isCustom && CAT.customBudget != null) {
      unspent = CAT.customBudget - customSpent();
      if (unspent < 0) overBudget = true;
      credits += Math.max(unspent, 0);
    }
    if (state.creditsOverride != null) credits = state.creditsOverride;
  }

  /* conditional capacities, keyed off the installed entry augment */
  var roundCap = (augment && augment.id === 'rift-conduit' && b.interface != null) ? 4 + b.interface : null;
  var prepSlots = (augment && augment.id === 'field-harness') ? 3 : null;
  var sinCap = (augment && augment.id === 'open-gullet' && b.grit != null) ? b.grit + 2 : null;

  /* Accuracy Ratings — the attack-stat table, with this subject's bonuses */
  var accuracy = CAT.attackStats.map(function (row) {
    return { cls: row.cls, statText: row.statText, stat: row.stat, bonus: row.stat ? b[row.stat] : null };
  });

  return {
    stats: s, bonuses: b, resume: resume, species: species, trait: trait,
    kit: kit, isCustom: isCustom, treeName: treeName, augment: augment,
    weapons: weapons, armor: armor, gearNotes: gearNotes,
    evasion: evasion, evRaw: evRaw, evCap: evCap,
    hp: hp, hpMods: hpMods, ap: 5, rp: 2, vent: vent, ventNote: ventNote,
    fate: fate, scars: scars, saturation: saturation, satFloor: satFloor,
    credits: credits, unspent: unspent, overBudget: overBudget,
    roundCap: roundCap, prepSlots: prepSlots, sinCap: sinCap,
    accuracy: accuracy
  };
}

/* ---------------- persistence ---------------- */
function autosave() {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
function restoreAutosave() {
  try {
    var raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) state = mergeState(JSON.parse(raw));
  } catch (e) {}
}
function mergeState(loaded) {
  var st = defaultState();
  Object.keys(st).forEach(function (k) {
    if (loaded && loaded[k] !== undefined) st[k] = loaded[k];
  });
  /* sanity for nested objects */
  ['stats', 'pb'].forEach(function (g) {
    var src = (loaded && loaded[g]) || {};
    var out = {};
    STAT_KEYS.forEach(function (k) { out[k] = (src[k] === undefined ? (g === 'pb' ? PB_MIN : null) : src[k]); });
    st[g] = out;
  });
  if (!Array.isArray(st.customWeapons)) st.customWeapons = [];
  return st;
}
function getSlots() {
  try { return JSON.parse(localStorage.getItem(SLOTS_KEY) || '{}'); } catch (e) { return {}; }
}
function setSlots(slots) {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch (e) {}
}

/* ---------------- export / import (Foundry note: derived values are NEVER stored) ---------------- */
function buildExport() {
  var d = derive();
  var out = {
    schema: 'arcane-steel-character@1',
    name: state.name || '',
    stats: currentStats(),
    resume: state.resume, trait: state.trait, species: state.species,
    kit: state.kit, technique: state.technique,
    augment: d.augment ? d.augment.id : null,
    weapons: d.weapons.map(function (w) {
      return { id: w.id, name: w.name, acc_die: w.acc_die, damage_dice: w.damage_dice, ap: w.ap, weight: w.weight, tags: w.tags.slice(), attack_stat: w.attack_stat };
    }),
    armor: d.armor ? { id: d.armor.id, name: d.armor.name, value: d.armor.value, absorb: d.armor.absorb, armor_hp: d.armor.armor_hp, ev_cap: d.armor.ev_cap } : null,
    credits: d.credits,
    state: { scars: d.scars, saturation: d.saturation, charge: 0, pp: 0, lp: 0 },
    notes: state.notes || ''
  };
  if (state.techniqueOldHands) out.technique_old_hands = state.techniqueOldHands; /* additive: Old Hands' free pick */
  if (d.gearNotes.length) out.gear_notes = d.gearNotes.slice();                   /* additive: unstatted issue items */
  return out;
}
function doExport() {
  var data = buildExport();
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (slug(state.name || '') || 'contractor') + '.arcane-steel.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
}
function doImport(data) {
  if (!data || data.schema !== 'arcane-steel-character@1') {
    alert('Not an arcane-steel-character@1 file. The Bureau rejects unfamiliar paperwork.');
    return;
  }
  var st = defaultState();
  st.name = String(data.name || '');
  st.notes = String(data.notes || '');
  st.resume = data.resume && CAT.resumesById[data.resume] ? data.resume : null;
  st.species = data.species && CAT.speciesById[data.species] ? data.species : null;
  st.trait = data.trait && CAT.traitsById[data.trait] ? data.trait : null;
  /* stats: raw in, bonuses recomputed — detect the array multiset, else point-buy */
  var vals = STAT_KEYS.map(function (k) { return data.stats ? data.stats[k] : null; });
  var isArray = vals.slice().sort(function (a, z) { return z - a; }).join(',') === ARRAY_VALUES.join(',');
  st.statMode = isArray ? 'array' : 'pointbuy';
  STAT_KEYS.forEach(function (k, i) {
    if (isArray) st.stats[k] = vals[i];
    else st.pb[k] = (vals[i] == null ? PB_MIN : vals[i]);
  });
  if (data.kit === 'custom') {
    st.kit = 'custom';
    Object.keys(CAT.treeEntries).forEach(function (tid) {
      if (CAT.treeEntries[tid].augment.id === data.augment) st.customTree = tid;
    });
    st.customWeapons = (data.weapons || []).map(function (w) {
      return { id: w.id || slug(w.name || ''), price: 0 };
    }).filter(function (w) { return CAT.weaponsById[w.id]; });
    st.customArmor = data.armor && CAT.armorById[data.armor.id] ? data.armor.id : null;
    st.creditsOverride = (typeof data.credits === 'number') ? data.credits : null;
  } else {
    st.kit = data.kit && CAT.kitsById[data.kit] ? data.kit : null;
  }
  st.technique = data.technique && CAT.techniquesById[data.technique] ? data.technique : null;
  st.techniqueOldHands = data.technique_old_hands && CAT.techniquesById[data.technique_old_hands] ? data.technique_old_hands : null;
  state = st;
  autosave();
  renderForm();
  renderDossier();
}

/* ---------------- form rendering ---------------- */
function radioRow(group, id, selected, inner) {
  return '<label class="opt-row' + (selected ? ' sel' : '') + '">' +
    '<input type="radio" name="' + group + '" value="' + esc(id) + '"' + (selected ? ' checked' : '') + '>' +
    inner + '</label>';
}

function renderResumeList() {
  var el = document.getElementById('resumeList');
  el.innerHTML = CAT.resumes.map(function (r) {
    return radioRow('resume', r.id, state.resume === r.id,
      '<div class="opt-top"><span class="opt-name">' + esc(r.name) + '</span>' +
      '<span class="opt-meta">' + esc(fmtCr(r.credits)) + '</span></div>' +
      '<div class="opt-sub">' + esc(r.skills.join(' T1 · ')) + ' T1 — <em>' + esc(r.standing) + '</em></div>');
  }).join('');
  el.querySelectorAll('input[name=resume]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      state.resume = this.value;
      state.creditsOverride = null;
      onStateChange(['resume']);
    });
  });
}

function renderSpeciesList() {
  var el = document.getElementById('speciesList');
  el.innerHTML = CAT.species.map(function (sp) {
    return radioRow('species', sp.id, state.species === sp.id,
      '<div class="opt-top"><span class="opt-ico">' + esc(sp.icon) + '</span>' +
      '<span class="opt-name">' + esc(sp.name) + '</span>' +
      '<span class="opt-meta"><a class="opt-link" target="_blank" rel="noopener" href="index.html#' + esc(sp.pageId) + '">full file →</a></span></div>' +
      '<div class="opt-sub">' + esc(sp.headline) + '</div>');
  }).join('');
  el.querySelectorAll('input[name=species]').forEach(function (inp) {
    inp.addEventListener('change', function () { state.species = this.value; onStateChange(['species']); });
  });
  el.querySelectorAll('a.opt-link').forEach(function (a) {
    a.addEventListener('click', function (e) { e.stopPropagation(); });
  });
}

function renderTraitList() {
  var el = document.getElementById('traitList');
  el.innerHTML = CAT.traits.map(function (t) {
    return radioRow('trait', t.id, state.trait === t.id,
      '<div class="opt-top"><span class="opt-name">' + esc(t.name) + '</span></div>' +
      '<div class="opt-sub"><span class="gift">' + esc(t.gift) + '</span><br><span class="ledger">' + esc(t.ledger) + '</span></div>');
  }).join('');
  el.querySelectorAll('input[name=trait]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      state.trait = this.value;
      if (state.trait !== 'old-hands') state.techniqueOldHands = null;
      onStateChange(['trait', 'kit']); /* kit panel re-renders for the Old Hands pick */
    });
  });
}

function renderStatPanel() {
  var el = document.getElementById('statPanel');
  var html = '<div class="stat-mode-toggle">' +
    '<button type="button" class="mode-btn' + (state.statMode === 'array' ? ' active' : '') + '" data-mode="array">ARRAY · 8/7/6/5/4</button>' +
    '<button type="button" class="mode-btn' + (state.statMode === 'pointbuy' ? ' active' : '') + '" data-mode="pointbuy">POINT-BUY · 30 PTS</button>' +
    '</div>';

  if (state.statMode === 'array') {
    var used = STAT_KEYS.map(function (k) { return state.stats[k]; }).filter(function (v) { return v != null; });
    html += '<div class="stat-grid">' + STAT_KEYS.map(function (k) {
      var opts = '<option value="">—</option>' + ARRAY_VALUES.map(function (v) {
        var taken = used.indexOf(v) !== -1 && state.stats[k] !== v;
        return '<option value="' + v + '"' + (state.stats[k] === v ? ' selected' : '') + (taken ? ' disabled' : '') + '>' + v + '</option>';
      }).join('');
      return '<div class="stat-cell"><div class="stat-cell-name">' + STAT_LABELS[k] + '</div>' +
        '<select class="frm-select" data-stat="' + k + '">' + opts + '</select>' +
        '<div class="stat-cell-bonus">' + fmtBonus(bonusOf(state.stats[k])) + '</div></div>';
    }).join('') + '</div>';
    var left = ARRAY_VALUES.filter(function (v) { return used.indexOf(v) === -1; });
    html += '<div class="budget-line"><span>UNASSIGNED VALUES</span><span class="' + (left.length ? 'warn' : 'ok') + '">' +
      (left.length ? left.join(' · ') : 'NONE — ARRAY COMPLETE') + '</span></div>';
  } else {
    var sum = STAT_KEYS.reduce(function (a, k) { return a + (Number(state.pb[k]) || 0); }, 0);
    var rem = PB_BUDGET - sum;
    html += '<div class="stat-grid">' + STAT_KEYS.map(function (k) {
      var v = state.pb[k];
      return '<div class="stat-cell"><div class="stat-cell-name">' + STAT_LABELS[k] + '</div>' +
        '<div class="pb-controls">' +
        '<button type="button" class="pb-btn" data-stat="' + k + '" data-d="-1"' + (v <= PB_MIN ? ' disabled' : '') + '>−</button>' +
        '<span class="pb-val">' + v + '</span>' +
        '<button type="button" class="pb-btn" data-stat="' + k + '" data-d="1"' + (v >= PB_MAX || rem <= 0 ? ' disabled' : '') + '>+</button>' +
        '</div><div class="stat-cell-bonus">' + fmtBonus(bonusOf(v)) + '</div></div>';
    }).join('') + '</div>';
    html += '<div class="budget-line"><span>BUDGET ' + PB_BUDGET + ' · MIN ' + PB_MIN + ' · MAX ' + PB_MAX + ' AT CREATION</span>' +
      '<span class="' + (rem === 0 ? 'ok' : 'warn') + '">SPENT ' + sum + ' · REMAINING ' + rem + '</span></div>';
  }
  el.innerHTML = html;

  el.querySelectorAll('.mode-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.statMode = this.dataset.mode;
      onStateChange(['stats']);
    });
  });
  el.querySelectorAll('select[data-stat]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      var v = this.value === '' ? null : parseInt(this.value, 10);
      var k = this.dataset.stat;
      if (v != null) {
        STAT_KEYS.forEach(function (o) { if (o !== k && state.stats[o] === v) state.stats[o] = null; });
      }
      state.stats[k] = v;
      onStateChange(['stats']);
    });
  });
  el.querySelectorAll('.pb-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var k = this.dataset.stat, d = parseInt(this.dataset.d, 10);
      var sum = STAT_KEYS.reduce(function (a, kk) { return a + (Number(state.pb[kk]) || 0); }, 0);
      var nv = state.pb[k] + d;
      if (nv < PB_MIN || nv > PB_MAX) return;
      if (d > 0 && sum >= PB_BUDGET) return;
      state.pb[k] = nv;
      onStateChange(['stats']);
    });
  });
}

function techniqueOptions(selectedId) {
  var trained = CAT.techniques.filter(function (t) { return t.rung === 'trained'; });
  return '<option value="">— select a Trained technique —</option>' + trained.map(function (t) {
    var label = t.name + ' — ' + t.kind + (t.ap != null ? ', ' + t.ap + ' AP' : '');
    return '<option value="' + esc(t.id) + '"' + (selectedId === t.id ? ' selected' : '') + ' title="' + esc(t.effect) + '">' + esc(label) + '</option>';
  }).join('');
}

function renderKitPanel() {
  var el = document.getElementById('kitPanel');
  var html = CAT.kits.map(function (k) {
    var entry = CAT.treeEntries[k.treeId];
    return radioRow('kit', k.id, state.kit === k.id,
      '<div class="opt-top"><span class="opt-ico">' + esc(k.icon) + '</span><span class="opt-name">' + esc(k.name) + '</span>' +
      '<span class="opt-meta">LEAN ' + esc(k.lean) + '</span></div>' +
      '<div class="opt-sub">' + esc(k.desc) + '</div>' +
      '<div class="opt-sub">TREE ' + esc(k.tree) + ' · ENTRY ' + esc(entry ? entry.augment.name : k.augName) + ' (free) · GEAR ' + esc(k.gear) + '</div>');
  }).join('');
  html += radioRow('kit', 'custom', state.kit === 'custom',
    '<div class="opt-top"><span class="opt-ico">⚙</span><span class="opt-name">Custom</span>' +
    '<span class="opt-meta">' + (CAT.customBudget != null ? CAT.customBudget.toLocaleString('en-US') + ' CR BUDGET' : 'BUDGET —') + '</span></div>' +
    '<div class="opt-sub">Any legal loadout within budget · any one tree’s entry augment, free · one free Trained technique. Unspent budget walks with you as credits.</div>');

  /* sub-panel: technique pick (every kit) + custom build controls */
  if (state.kit) {
    html += '<div class="kit-sub">';
    if (state.kit === 'custom') {
      html += '<label class="frm-microlabel">TREE ENTRY AUGMENT — PICK ONE TREE (FREE)</label>' +
        '<select class="frm-select" id="customTreeSel"><option value="">— select tree —</option>' +
        Object.keys(CAT.treeEntries).map(function (tid) {
          var e = CAT.treeEntries[tid];
          return '<option value="' + esc(tid) + '"' + (state.customTree === tid ? ' selected' : '') + '>' +
            esc(e.treeName + ' — ' + e.augment.name) + '</option>';
        }).join('') + '</select>';

      var spent = customSpent();
      var remaining = (CAT.customBudget != null ? CAT.customBudget - spent : null);
      html += '<div class="kit-sub custom-gear-group"><label class="frm-microlabel">WEAPONS — LEGAL CATALOG</label>' +
        '<div class="cg-gap-note">⚠ weapon prices are unprinted in the catalog (DESIGN GAP, see Weapons) — enter the table-agreed price; 0 keeps it free-of-record.</div>' +
        CAT.weapons.map(function (w) {
          var pick = null;
          state.customWeapons.forEach(function (cw) { if (cw.id === w.id) pick = cw; });
          return '<label class="cg-row' + (pick ? ' sel' : '') + '"><input type="checkbox" data-w="' + esc(w.id) + '"' + (pick ? ' checked' : '') + '>' +
            '<span class="cg-name">' + esc(w.name) + '</span>' +
            '<span class="cg-spec">' + esc(w.acc_die + ' · ' + w.damage_dice + ' · ' + w.ap + ' AP · wt ' + w.weight) + '</span>' +
            '<span class="cg-price">' + (pick ? '<input class="cg-price-input" type="number" min="0" step="10" data-wp="' + esc(w.id) + '" value="' + (Number(pick.price) || 0) + '"> cr' : 'price —') + '</span></label>';
        }).join('') + '</div>';

      html += '<div class="custom-gear-group"><label class="frm-microlabel">ARMOR — THE LADDER</label>' +
        '<label class="cg-row' + (state.customArmor == null ? ' sel' : '') + '"><input type="radio" name="customArmor" value=""' + (state.customArmor == null ? ' checked' : '') + '>' +
        '<span class="cg-name">None</span><span class="cg-spec">unarmored — Evasion uncapped</span><span class="cg-price">0 cr</span></label>' +
        CAT.armor.map(function (a) {
          return '<label class="cg-row' + (state.customArmor === a.id ? ' sel' : '') + '"><input type="radio" name="customArmor" value="' + esc(a.id) + '"' + (state.customArmor === a.id ? ' checked' : '') + '>' +
            '<span class="cg-name">' + esc(a.name) + '</span>' +
            '<span class="cg-spec">VAL ' + a.value + ' · ABS ' + a.absorb + ' · HP ' + a.armor_hp + ' · CAP ' + (a.ev_cap == null ? '—' : a.ev_cap) + '</span>' +
            '<span class="cg-price">' + esc(fmtCr(a.price)) + '</span></label>';
        }).join('') + '</div>';

      html += '<div class="budget-line"><span>GEAR BUDGET ' + (CAT.customBudget != null ? CAT.customBudget.toLocaleString('en-US') + ' CR' : '—') + '</span>' +
        '<span class="' + (remaining != null && remaining >= 0 ? 'ok' : 'warn') + '">SPENT ' + spent.toLocaleString('en-US') +
        ' · UNSPENT ' + (remaining == null ? '—' : remaining.toLocaleString('en-US')) + ' → CREDITS</span></div>';
    }

    html += '<div class="kit-sub"><label class="frm-microlabel">FREE TECHNIQUE — ONE TRAINED-TIER PICK, INSTRUCTOR WAIVED (RULING 3)</label>' +
      '<select class="frm-select" id="techSel">' + techniqueOptions(state.technique) + '</select></div>';

    if (state.trait === 'old-hands') {
      html += '<div class="kit-sub"><label class="frm-microlabel">OLD HANDS — ONE TECHNIQUE FREE AT CREATION (TRAINED TIER ASSUMED — RUNG UNPRINTED)</label>' +
        '<select class="frm-select" id="techSelOH">' + techniqueOptions(state.techniqueOldHands) + '</select></div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;

  el.querySelectorAll('input[name=kit]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      state.kit = this.value;
      state.creditsOverride = null;
      onStateChange(['kit']);
    });
  });
  var treeSel = document.getElementById('customTreeSel');
  if (treeSel) treeSel.addEventListener('change', function () {
    state.customTree = this.value || null;
    onStateChange(['kit']);
  });
  var techSel = document.getElementById('techSel');
  if (techSel) techSel.addEventListener('change', function () {
    state.technique = this.value || null;
    autosave(); renderDossier();
  });
  var techSelOH = document.getElementById('techSelOH');
  if (techSelOH) techSelOH.addEventListener('change', function () {
    state.techniqueOldHands = this.value || null;
    autosave(); renderDossier();
  });
  el.querySelectorAll('input[type=checkbox][data-w]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var id = this.dataset.w;
      state.creditsOverride = null;
      if (this.checked) state.customWeapons.push({ id: id, price: 0 });
      else state.customWeapons = state.customWeapons.filter(function (cw) { return cw.id !== id; });
      onStateChange(['kit']);
    });
  });
  el.querySelectorAll('input.cg-price-input').forEach(function (pi) {
    pi.addEventListener('change', function () {
      var id = this.dataset.wp, v = Math.max(0, Number(this.value) || 0);
      state.creditsOverride = null;
      state.customWeapons.forEach(function (cw) { if (cw.id === id) cw.price = v; });
      onStateChange(['kit']);
    });
    pi.addEventListener('click', function (e) { e.stopPropagation(); });
  });
  el.querySelectorAll('input[name=customArmor]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      state.customArmor = this.value || null;
      state.creditsOverride = null;
      onStateChange(['kit']);
    });
  });
}

function renderSlots() {
  var el = document.getElementById('slotList');
  var slots = getSlots();
  var names = Object.keys(slots).sort(function (a, z) { return (slots[z].savedAt || 0) - (slots[a].savedAt || 0); });
  if (!names.length) { el.innerHTML = '<div class="rec-empty">NO SAVED SLOTS ON FILE.</div>'; return; }
  el.innerHTML = names.map(function (n) {
    var d = slots[n].savedAt ? new Date(slots[n].savedAt) : null;
    return '<div class="rec-slot"><span class="rec-slot-name">' + esc(n) + '</span>' +
      '<span class="rec-slot-date">' + (d ? d.toISOString().slice(0, 10) : '') + '</span>' +
      '<button type="button" data-load="' + esc(n) + '">LOAD</button>' +
      '<button type="button" class="del" data-del="' + esc(n) + '">DEL</button></div>';
  }).join('');
  el.querySelectorAll('button[data-load]').forEach(function (b) {
    b.addEventListener('click', function () {
      var slots2 = getSlots();
      if (slots2[this.dataset.load]) {
        state = mergeState(slots2[this.dataset.load].state);
        autosave(); renderForm(); renderDossier();
      }
    });
  });
  el.querySelectorAll('button[data-del]').forEach(function (b) {
    b.addEventListener('click', function () {
      var slots2 = getSlots();
      delete slots2[this.dataset.del];
      setSlots(slots2); renderSlots();
    });
  });
}

function renderForm() {
  renderResumeList();
  renderSpeciesList();
  renderTraitList();
  renderStatPanel();
  renderKitPanel();
  renderSlots();
  document.getElementById('charName').value = state.name || '';
  document.getElementById('charNotes').value = state.notes || '';
}

function onStateChange(sections) {
  autosave();
  if (sections.indexOf('resume') !== -1) renderResumeList();
  if (sections.indexOf('species') !== -1) renderSpeciesList();
  if (sections.indexOf('trait') !== -1) renderTraitList();
  if (sections.indexOf('stats') !== -1) renderStatPanel();
  if (sections.indexOf('kit') !== -1) renderKitPanel();
  renderDossier();
}

/* ---------------- THE DOSSIER ---------------- */
function fieldRow(label, valueHtml) {
  return '<div class="dsr-field"><span class="dsr-field-l">' + label + '</span><span class="dsr-field-v">' + valueHtml + '</span></div>';
}
function unfilled(text) { return '<span class="unfilled">' + esc(text) + '</span>'; }
function stampNone(text) { return '<span class="stamp-none">' + esc(text) + '</span>'; }

function renderDossier() {
  if (!CAT) return;
  var d = derive();
  var h = '';

  h += '<div class="doc-banner"><span class="doc-banner-no">AS-DOSSIER</span>' +
    '<span class="doc-banner-book">CONTRACTOR RECORD · INTAKE DIVISION</span>' +
    '<span class="doc-banner-class">CONTRACTOR COPY</span></div>';

  /* ---- head: subject + identity lines ---- */
  h += '<div class="dsr-head">';
  h += '<span class="dsr-microlabel">SUBJECT OF RECORD</span>';
  h += '<div class="dsr-name">' + (state.name ? esc(state.name) : unfilled('UNNAMED — PENDING DESIGNATION')) + '</div>';
  h += '<div class="dsr-ident">';
  h += fieldRow('SPECIES', d.species ? esc(d.species.name) : unfilled('NOT ON FILE'));
  h += fieldRow('RÉSUMÉ', d.resume ? esc(d.resume.name) : unfilled('NOT ON FILE'));
  h += fieldRow('TRAIT', d.trait ? esc(d.trait.name) : unfilled('NOT ON FILE'));
  h += fieldRow('KIT', d.isCustom ? 'Custom issue' : (d.kit ? esc(d.kit.name) : unfilled('NOT ON FILE')));
  h += fieldRow('CERTIFICATIONS', d.resume ? esc(d.resume.skills.map(function (s) { return s + ' T1'; }).join(' · ')) : unfilled('NONE ON FILE'));
  h += fieldRow('STANDING', d.resume ? '<small>' + esc(d.resume.standing) + '</small>' : unfilled('NONE ON FILE'));
  h += '</div></div>';

  /* ---- stats ---- */
  h += '<div class="dsr-sec"><div class="dsr-sec-title">Stat Assay <span class="annot">· raw / bonus per the one table</span></div>';
  h += '<div class="dsr-stats">' + STAT_KEYS.map(function (k) {
    var v = d.stats[k], b = d.bonuses[k];
    return '<div class="dsr-stat"><div class="dsr-stat-name">' + STAT_LABELS[k] + '</div>' +
      '<div class="dsr-stat-val' + (v == null ? ' unset' : '') + '">' + (v == null ? '—' : v) + '</div>' +
      '<div class="dsr-stat-bonus' + (b == null ? ' unset' : '') + '">' + fmtBonus(b) + '</div></div>';
  }).join('') + '</div></div>';

  /* ---- accuracy ratings ---- */
  h += '<div class="dsr-sec"><div class="dsr-sec-title">Accuracy Ratings <span class="annot">· stat by weapon class</span></div>';
  h += '<table class="dsr-table"><thead><tr><th>Weapon class</th><th>Stat</th><th>Rating</th></tr></thead><tbody>';
  d.accuracy.forEach(function (row) {
    h += '<tr><td class="dim">' + esc(row.cls) + '</td>' +
      '<td class="mono">' + (row.stat ? STAT_LABELS[row.stat] : '<span class="dim">' + esc(row.statText) + '</span>') + '</td>' +
      '<td class="mono">' + (row.stat ? fmtBonus(row.bonus) : '—') + '</td></tr>';
  });
  h += '</tbody></table></div>';

  /* ---- derived block ---- */
  h += '<div class="dsr-sec"><div class="dsr-sec-title">Derived Assessment</div><div class="dsr-derived">';
  var evTxt;
  if (d.evasion == null) evTxt = unfilled('PENDING ARRAY');
  else {
    evTxt = '<strong>' + d.evasion + '</strong>';
    if (d.evCap != null && d.evRaw > d.evCap) evTxt += ' <small>(raw ' + d.evRaw + ', capped by ' + esc(d.armor.name) + ')</small>';
    else if (d.evCap != null) evTxt += ' <small>(cap ' + d.evCap + ')</small>';
  }
  h += fieldRow('EVASION', evTxt);
  h += fieldRow('MAX FLESH HP', d.hp == null ? unfilled('PENDING ARRAY') :
    '<strong>' + d.hp + '</strong>' + (d.hpMods.length ? ' <small>(' + esc(d.hpMods.join(', ')) + ')</small>' : ''));
  h += fieldRow('AP / TURN', '<strong>5</strong>');
  h += fieldRow('RP', '<strong>2</strong> <small>+ unspent AP</small>');
  h += fieldRow('FREE VENT', d.vent == null ? unfilled('PENDING ARRAY') :
    '<strong>' + d.vent + '</strong>' + (d.ventNote ? ' <small>(' + esc(d.ventNote) + ')</small>' : ''));
  h += fieldRow('FATE ROLL', d.fate == null ? unfilled('PENDING ARRAY') :
    '<strong>d20 ' + fmtBonus(d.fate.mod) + '</strong> <small>vs DC ' + d.fate.dc + '</small>');
  if (d.roundCap != null) h += fieldRow('ROUND CAPACITY', '<strong>' + d.roundCap + '</strong> <small>(4 + Interface)</small>');
  if (d.prepSlots != null) h += fieldRow('PREP SLOTS', '<strong>' + d.prepSlots + '</strong>');
  if (d.sinCap != null) h += fieldRow('SIN CAPACITY', '<strong>' + d.sinCap + '</strong> <small>(Grit bonus + 2)</small>');
  h += fieldRow('CREDITS', d.credits == null ? unfilled('PENDING RÉSUMÉ') :
    '<strong>' + esc(fmtCr(d.credits)) + '</strong>' + (d.unspent != null && d.unspent > 0 ? ' <small>(incl. ' + d.unspent.toLocaleString('en-US') + ' unspent issue budget)</small>' : ''));
  h += '</div>';
  if (d.overBudget) h += '<div class="dsr-warnline">⚠ CUSTOM ISSUE OVER BUDGET — REDUCE LOADOUT. THE BUREAU DOES NOT EXTEND CREDIT.</div>';
  h += '</div>';

  /* ---- issued equipment ---- */
  h += '<div class="dsr-sec"><div class="dsr-sec-title">Issued Equipment</div>';
  if (d.weapons.length) {
    h += '<table class="dsr-table"><thead><tr><th>Weapon</th><th>Acc</th><th>Dmg</th><th>AP</th><th>Wt</th><th>Stat</th></tr></thead><tbody>';
    d.weapons.forEach(function (w) {
      h += '<tr><td>' + esc(w.name) + (w.tags.length ? ' <span class="dim mono">[' + esc(w.tags.join(', ')) + ']</span>' : '') + '</td>' +
        '<td class="mono">' + esc(w.acc_die) + '</td><td class="mono">' + esc(w.damage_dice) + '</td>' +
        '<td class="mono">' + w.ap + '</td><td class="mono">' + w.weight + '</td>' +
        '<td class="mono">' + STAT_LABELS[w.attack_stat] + ' ' + fmtBonus(d.bonuses[w.attack_stat]) + '</td></tr>';
    });
    h += '</tbody></table>';
  }
  if (d.armor) {
    h += fieldRow('ARMOR', '<strong>' + esc(d.armor.name) + '</strong> <small class="mono">VAL ' + d.armor.value +
      ' · ABS ' + d.armor.absorb + ' · HP ' + d.armor.armor_hp + ' · EV CAP ' + (d.evCap == null ? '—' : d.evCap) + '</small>');
  } else {
    h += fieldRow('ARMOR', d.kit || d.isCustom ? stampNone('NONE ISSUED') : unfilled('PENDING KIT'));
  }
  if (d.gearNotes.length) {
    h += fieldRow('ALSO ON MANIFEST', '<small class="mono">' + esc(d.gearNotes.join(' · ')) + '</small>');
  }
  if (!d.weapons.length && !d.armor && !d.gearNotes.length) {
    h += '<div class="dsr-manifest-count">' + (state.kit ? 'NO STATTED ISSUE RESOLVED.' : 'NO ISSUE RECORDED — SECTION 5 PENDING.') + '</div>';
  }
  h += '</div>';

  /* ---- augment manifest: the one lonely entry ---- */
  h += '<div class="dsr-sec"><div class="dsr-sec-title">Augment Manifest <span class="annot">· installs on record</span></div>';
  if (d.augment) {
    h += '<div class="dsr-aug"><span class="dsr-aug-name">' + esc(d.augment.name) + '</span>' +
      '<span class="dsr-aug-meta">' + esc(d.treeName || '') + ' · ENTRY · INSTALLED FREE AT ISSUE</span>' +
      '<div class="dsr-aug-effect">' + esc(d.augment.effect) + '</div></div>';
    h += '<div class="dsr-manifest-count">ENTRIES ON FILE: 1. THE TREE DOES THE DIVERGING.</div>';
  } else {
    h += stampNone('NO INSTALLS ON FILE') + '<div class="dsr-manifest-count">ENTRIES ON FILE: 0.</div>';
  }
  h += '</div>';

  /* ---- technique certifications ---- */
  h += '<div class="dsr-sec"><div class="dsr-sec-title">Technique Certifications</div>';
  var techs = [];
  if (state.technique && CAT.techniquesById[state.technique]) techs.push(CAT.techniquesById[state.technique]);
  if (state.techniqueOldHands && CAT.techniquesById[state.techniqueOldHands]) techs.push(CAT.techniquesById[state.techniqueOldHands]);
  if (techs.length) {
    techs.forEach(function (t) {
      h += fieldRow(esc(t.name).toUpperCase(), '<small>' + esc(t.kind + (t.ap != null ? ', ' + t.ap + ' AP' : '') + ' · Trained · ' + t.effect) + '</small>');
    });
  } else {
    h += stampNone('NONE CERTIFIED') + '<div class="dsr-manifest-count">' + (state.kit ? 'ONE TRAINED PICK OUTSTANDING — SECTION 5.' : 'SECTION 5 PENDING.') + '</div>';
  }
  h += '</div>';

  /* ---- file status: THE EMPTY FIELDS, printed deliberately ---- */
  h += '<div class="dsr-sec dsr-status"><div class="dsr-sec-title">File Status <span class="annot">· as of issue</span></div>';
  h += fieldRow('SCAR COUNT', d.scars === 0 ? '<span class="dsr-zero">0</span>' :
    '<span class="dsr-zero">' + d.scars + '</span> <small>disclosed at intake — no debuff; the clean death is spent</small>');
  h += fieldRow('SATURATION', d.satFloor > 0 ?
    '<span class="dsr-zero">' + d.saturation + '</span> <small>floor ' + d.satFloor + ' — congenital</small>' :
    '<span class="dsr-zero">0</span>');
  h += fieldRow('CHARGE', '<span class="dsr-zero">0</span>');
  h += fieldRow('PP / LP', '<span class="dsr-zero">0 / 0</span>');
  h += fieldRow('LICENSES', stampNone('NONE ON FILE'));
  h += fieldRow('OBLIGATIONS', stampNone('NONE ON FILE'));
  h += '</div>';

  /* the previous holder wrote in the margin */
  h += '<div class="c-margin-note" style="--tilt:-0.8deg">everyone’s file starts this thin. fill it slow.</div>';

  h += '<div class="dsr-end">— END OF FILE · SUBJECT TO REVISION WITHOUT NOTICE —</div>';

  document.getElementById('dossier').innerHTML = h;
}

/* ---------------- parse notice ---------------- */
function showParseNotice(issues) {
  var el = document.getElementById('parseNotice');
  if (!issues.length) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = '<strong>CATALOG PARSE NOTICE — THE BOOK AND THE BUILDER DISAGREE</strong>' +
    '<ul>' + issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
}

/* Console/debug hook — lets the node smoke test (and Chris) drive the pipeline. */
root.ASBuilderDebug = {
  get state() { return state; },
  set state(s) { state = mergeState(s); },
  get catalogs() { return CAT; },
  set catalogs(c) { CAT = c; },
  derive: function () { return derive(); },
  buildExport: function () { return buildExport(); },
  defaultState: defaultState
};

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof restoreTheme === 'function') restoreTheme();

  loadCatalogs().then(function (cat) {
    CAT = cat;
    var issues = validateCatalogs(cat).concat(cat.loadErrors);
    showParseNotice(issues);
    restoreAutosave();
    renderForm();
    renderDossier();
  }).catch(function (e) {
    showParseNotice(['catalog load failed: ' + e.message +
      (location.protocol === 'file:' ? ' (offline bundle missing? rebuild data/bundle.js)' : '')]);
  });

  document.getElementById('charName').addEventListener('input', function () {
    state.name = this.value;
    autosave(); renderDossier();
  });
  document.getElementById('charNotes').addEventListener('input', function () {
    state.notes = this.value;
    autosave();
  });
  document.getElementById('btnSaveSlot').addEventListener('click', function () {
    var name = document.getElementById('slotName').value.trim() ||
      (state.name ? state.name : 'contractor') + ' · ' + new Date().toISOString().slice(0, 10);
    var slots = getSlots();
    slots[name] = { savedAt: Date.now(), state: JSON.parse(JSON.stringify(state)) };
    setSlots(slots);
    document.getElementById('slotName').value = '';
    renderSlots();
  });
  document.getElementById('btnExport').addEventListener('click', function () {
    if (!CAT) return;
    doExport();
  });
  document.getElementById('btnImport').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f || !CAT) return;
    var fr = new FileReader();
    fr.onload = function () {
      try { doImport(JSON.parse(fr.result)); }
      catch (e) { alert('Unreadable file: ' + e.message); }
    };
    fr.readAsText(f);
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    if (!confirm('Clear the intake form? Saved slots are kept.')) return;
    state = defaultState();
    autosave();
    if (CAT) { renderForm(); renderDossier(); }
  });
});

})(typeof window !== 'undefined' ? window : globalThis);
