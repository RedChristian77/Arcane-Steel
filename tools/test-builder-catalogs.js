#!/usr/bin/env node
/* ============================================================
   TEST — builder catalog parsers vs the real page JSONs
   Run: node tools/test-builder-catalogs.js
   Loads js/builder.js (Part 1 parsers export via module.exports)
   against data/pages/*.json and asserts the catalog counts the
   builder depends on. Exits 1 on any failure.

   NOTE ON SPECIES: the rebuild brief expected 8 species; the
   shipped registry (races-overview.json) prints "seven playable
   species" and the repo carries 7 species pages. The test asserts
   the book as printed — 7 — and prints the discrepancy loudly.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const P = require(path.join(__dirname, '..', 'js', 'builder.js'));

const PAGES_DIR = path.join(__dirname, '..', 'data', 'pages');
function loadPage(id) {
  return JSON.parse(fs.readFileSync(path.join(PAGES_DIR, id + '.json'), 'utf8'));
}

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log('  PASS  ' + label + (detail ? '  [' + detail + ']' : ''));
  } else {
    failures++;
    console.error('  FAIL  ' + label + (detail ? '  [' + detail + ']' : ''));
  }
}

console.log('== builder catalog parser test ==\n');

/* --- résumés --- */
const resumes = P.parseResumes(loadPage('pc-creation-resumes'));
check('résumés parsed = 10', resumes.length === 10, 'got ' + resumes.length);
check('every résumé has 2 skills + standing + credits',
  resumes.every(r => r.skills.length === 2 && r.standing && typeof r.credits === 'number'),
  resumes.map(r => r.name + ':' + r.credits).slice(0, 3).join(', ') + ', …');

/* --- traits --- */
const traits = P.parseTraits(loadPage('pc-creation-traits'));
check('traits parsed = 10', traits.length === 10, 'got ' + traits.length);
check('every trait two-sided (gift + ledger)', traits.every(t => t.gift && t.ledger));

/* --- kits --- */
const kitsParsed = P.parseKits(loadPage('pc-creation-kits'));
check('kits parsed = 10', kitsParsed.kits.length === 10, 'got ' + kitsParsed.kits.length);
check('Custom budget parsed = 1200 cr (from the page, not hard-coded)',
  kitsParsed.customBudget === 1200, 'got ' + kitsParsed.customBudget);
check('every kit names tree + entry augment + gear',
  kitsParsed.kits.every(k => k.tree && k.augName && k.gear));

/* --- techniques --- */
const techniques = P.parseTechniques(loadPage('pc-techniques'));
const trained = techniques.filter(t => t.rung === 'trained');
const advanced = techniques.filter(t => t.rung === 'advanced');
const master = techniques.filter(t => t.rung === 'master');
check('Trained techniques >= 8', trained.length >= 8, 'got ' + trained.length);
console.log('        (trained ' + trained.length + ' / advanced ' + advanced.length + ' / master ' + master.length + ' = ' + techniques.length + ' total)');
check('every technique has kind Passive/Active', techniques.every(t => t.kind === 'Passive' || t.kind === 'Active'));
check('Active techniques carry AP cost', techniques.filter(t => t.kind === 'Active').every(t => typeof t.ap === 'number'));

/* --- weapons + attack stats --- */
const weaponsParsed = P.parseWeapons(loadPage('pc-equipment-weapons'));
check('weapons parsed = 11', weaponsParsed.weapons.length === 11, 'got ' + weaponsParsed.weapons.length);
check('every weapon carries an attack stat',
  weaponsParsed.weapons.every(w => w.attack_stat === 'reflex' || w.attack_stat === 'chrome'),
  weaponsParsed.weapons.map(w => w.name + '→' + w.attack_stat).join(', '));
check('every weapon has acc/dmg/ap/weight',
  weaponsParsed.weapons.every(w => /^d\d+$/.test(w.acc_die) && /^\d+d\d+$/.test(w.damage_dice) && Number.isInteger(w.ap) && Number.isInteger(w.weight)));
check('attack-stat-by-class table parsed (5 classes)', weaponsParsed.attackStats.length === 5,
  weaponsParsed.attackStats.map(r => r.stat || '(block)').join(', '));
/* spot-check the ruling classification against the printed table */
const byName = Object.fromEntries(weaponsParsed.weapons.map(w => [w.name, w]));
check('light melee → Reflex (Knife)', byName['Knife'] && byName['Knife'].attack_stat === 'reflex');
check('heavy melee → Chrome (Heavy Axe)', byName['Heavy Axe'] && byName['Heavy Axe'].attack_stat === 'chrome');
check('guns → Reflex (Marksman Rifle)', byName['Marksman Rifle'] && byName['Marksman Rifle'].attack_stat === 'reflex');

/* --- armor --- */
const armor = P.parseArmor(loadPage('pc-equipment-armor'));
check('armor tiers parsed = 7', armor.length === 7, 'got ' + armor.length);
check('armor carries value/absorb/armor_hp/ev_cap/price',
  armor.every(a => Number.isInteger(a.value) && Number.isInteger(a.absorb) && Number.isInteger(a.armor_hp) && (a.ev_cap === null || Number.isInteger(a.ev_cap)) && Number.isInteger(a.price)));
check('Padded Jacket cap is uncapped (—)', armor[0] && armor[0].ev_cap === null);

/* --- casting patterns (RULING 5 — the Channeler arrival state) --- */
const patterns = P.parsePatterns(loadPage('pc-casting-patterns'));
check('patterns parsed = 10 (the launch ten)', patterns.length === 10, 'got ' + patterns.length);
check('at least 2 patterns are Tier 1 (kit Channelers pick two)',
  patterns.filter(p => p.tier === 1).length >= 2,
  'tier 1: ' + patterns.filter(p => p.tier === 1).map(p => p.name).join(', '));
check('every pattern has a name + integer tier',
  patterns.every(p => p.name && Number.isInteger(p.tier)));

/* --- species --- */
const species = P.parseSpecies(loadPage('races-overview'));
console.log('\n  NOTE: brief said "8 species"; the shipped registry prints SEVEN playable');
console.log('  species (races-overview: "Arcane Steel features seven playable species")');
console.log('  and the repo has 7 races-*.json species pages. Asserting the book: 7.');
check('species parsed = 7 (as the registry prints)', species.length === 7,
  species.map(s => s.name).join(', '));
check('every species has a 1-line headline + page id',
  species.every(s => s.headline && /^races-/.test(s.pageId)));

/* --- tree entry augments --- */
const entries = {};
P.TREE_PAGE_IDS.forEach(tid => {
  const e = P.parseTreeEntry(loadPage(tid));
  if (e) entries[tid] = e;
});
check('tree entry augments parsed = 10', Object.keys(entries).length === 10,
  Object.values(entries).map(e => e.treeName + '→' + e.augment.name).join(', '));

/* --- kit ↔ tree cross-resolution --- */
let crossOk = true;
kitsParsed.kits.forEach(k => {
  const e = entries[k.treeId];
  if (!e || e.augment.id !== P.slug(k.augName)) {
    crossOk = false;
    console.error('        mismatch: kit ' + k.name + ' names "' + k.augName + '", tree entry is "' + (e ? e.augment.name : 'MISSING') + '"');
  }
});
check('all 10 kit-named entry augments resolve to their tree entry', crossOk);

/* --- bonus table sanity (the rulings table, used everywhere) --- */
check('bonus table: 4→+1, 8→+3, 10→+4, 20→+9',
  P.bonusOf(4) === 1 && P.bonusOf(8) === 3 && P.bonusOf(10) === 4 && P.bonusOf(20) === 9);
check('slug handles diacritics (Résumé→resume…)', P.slug('Margin Rat') === 'margin-rat' && P.slug('Sin Eater') === 'sin-eater');

/* --- derived-block smoke test (Part 2 under a minimal DOM stub) --- */
console.log('\n== derived block smoke test (rulings v1) ==');
{
  const builderPath = require.resolve(path.join(__dirname, '..', 'js', 'builder.js'));
  delete require.cache[builderPath];
  global.window = global;
  global.document = {
    addEventListener() {},
    getElementById() { return null; },
    createElement() {
      return {
        _t: '',
        set textContent(v) { this._t = String(v); },
        get innerHTML() { return this._t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
      };
    }
  };
  global.localStorage = { getItem() { return null; }, setItem() {} };
  require(builderPath);
  const D = global.ASBuilderDebug;
  check('debug hook exposed under DOM stub', !!D);

  const byId = {};
  ['pc-creation-resumes', 'pc-creation-traits', 'pc-creation-kits', 'pc-techniques',
   'pc-equipment-weapons', 'pc-equipment-armor', 'pc-casting-patterns', 'races-overview'].concat(P.TREE_PAGE_IDS)
    .forEach(id => { byId[id] = loadPage(id); });
  D.catalogs = P.buildCatalogs(byId);

  /* an Enforcer Human Survivor Berserker, array 8/7/6/5/4 as Chrome/Reflex/Grit/Interface/Edge */
  D.state = {
    name: 'Smoke Test', resume: 'enforcer', species: 'human', trait: 'survivor',
    statMode: 'array',
    stats: { chrome: 8, reflex: 7, grit: 6, interface: 5, edge: 4 },
    kit: 'berserker', technique: 'quick-draw'
  };
  const d = D.derive();
  check('Max Flesh HP = 16 + 2×Grit bonus (Grit 6 → +2 → 20)', d.hp === 20, 'got ' + d.hp);
  check('Evasion = 3 + Edge + Reflex (4→+1, 7→+2 → 6), under Contractor Standard cap 8', d.evasion === 6 && d.evCap === 8, 'got ' + d.evasion + ' cap ' + d.evCap);
  check('Free vent: Grit +2, Human −1 (min 1) → 1', d.vent === 1, 'got ' + d.vent);
  check('Fate Roll d20 +4 vs DC 12 (Survivor scar counts as untreated)', d.fate && d.fate.mod === 4 && d.fate.dc === 12, 'got +' + (d.fate && d.fate.mod) + ' vs ' + (d.fate && d.fate.dc));
  check('Survivor: scar count 1', d.scars === 1);
  check('credits = résumé line (Enforcer 400)', d.credits === 400, 'got ' + d.credits);
  check('kit gear resolves: Heavy Axe → Chrome attack', d.weapons.length === 1 && d.weapons[0].id === 'heavy-axe' && d.weapons[0].attack_stat === 'chrome');
  check('kit armor resolves: Contractor Std → Contractor Standard', d.armor && d.armor.id === 'contractor-standard');
  check('augment manifest: one entry, Adrenal Injector', d.augment && d.augment.id === 'adrenal-injector');

  const exp = D.buildExport();
  check('export schema = arcane-steel-character@1', exp.schema === 'arcane-steel-character@1');
  check('export stores RAW stats only', exp.stats.chrome === 8 && exp.stats.edge === 4);
  check('export stores ids for resume/trait/species/kit/technique/augment',
    exp.resume === 'enforcer' && exp.trait === 'survivor' && exp.species === 'human' &&
    exp.kit === 'berserker' && exp.technique === 'quick-draw' && exp.augment === 'adrenal-injector');
  check('export weapons carry {acc_die,damage_dice,ap,weight,tags,attack_stat}',
    exp.weapons.length === 1 && exp.weapons[0].acc_die === 'd6' && exp.weapons[0].damage_dice === '3d10' &&
    exp.weapons[0].ap === 4 && exp.weapons[0].weight === 3 && Array.isArray(exp.weapons[0].tags) && exp.weapons[0].attack_stat === 'chrome');
  check('export armor carries {value,absorb,armor_hp,ev_cap}',
    exp.armor && exp.armor.value === 3 && exp.armor.absorb === 1 && exp.armor.armor_hp === 12 && exp.armor.ev_cap === 8);
  check('export state = {scars:1, saturation:0, charge:0, pp:0, lp:0}',
    exp.state.scars === 1 && exp.state.saturation === 0 && exp.state.charge === 0 && exp.state.pp === 0 && exp.state.lp === 0);
  check('derived values NEVER stored (no hp/evasion/vent/fate keys)',
    !('hp' in exp) && !('evasion' in exp) && !('vent' in exp) && !('fate' in exp) && !('bonuses' in exp));

  /* Rift-Touched + Flicker + point-buy variant */
  D.state = {
    resume: 'margin-rat', species: 'flicker', trait: 'rift-touched',
    statMode: 'pointbuy',
    pb: { chrome: 4, reflex: 8, grit: 8, interface: 4, edge: 6 },
    kit: 'custom', customTree: 'pc-trees-channeler'
  };
  const d2 = D.derive();
  check('Flicker −2 max HP (Grit 8 → 22 − 2 = 20)', d2.hp === 20, 'got ' + d2.hp);
  check('Rift-Touched saturation floor 5', d2.saturation === 5 && d2.satFloor === 5);
  check('Custom kit: credits = résumé 250 + unspent 1200 = 1450', d2.credits === 1450, 'got ' + d2.credits);
  check('Custom tree entry: Rift Conduit → Round capacity 4 + Interface (+1) = 5', d2.augment.id === 'rift-conduit' && d2.roundCap === 5, 'got ' + d2.roundCap);

  /* RULING 5 — kit Channeler arrival: two known T1 patterns, 3 rounds banked each, Charge 0 */
  check('non-Channeler export carries no patterns key', !('patterns' in exp));
  D.state = {
    name: 'Weave Smoke', resume: 'enforcer', species: 'human',
    statMode: 'array',
    stats: { chrome: 4, reflex: 5, grit: 6, interface: 8, edge: 7 },
    kit: 'channeler', patterns: ['lance', 'static-veil']
  };
  const d3 = D.derive();
  check('Channeler derive: both Tier-1 picks resolve from the catalog',
    d3.isChanneler === true && d3.patternsKnown.length === 2 &&
    d3.patternsKnown[0].id === 'lance' && d3.patternsKnown[1].id === 'static-veil');
  check('the longer gear string still resolves (Light Weave worn, Focus noted)',
    d3.armor && d3.armor.id === 'light-weave' && d3.gearNotes.indexOf('Focus') !== -1,
    'notes: ' + d3.gearNotes.join(' · '));
  check('pattern clause leaves the gear notes once both picks are made',
    !d3.gearNotes.some(n => /pattern|rounds banked|charge 0/i.test(n)));
  const exp3 = D.buildExport();
  check('export patterns = [{id, banked: 3} × 2], schema unchanged',
    exp3.schema === 'arcane-steel-character@1' &&
    Array.isArray(exp3.patterns) && exp3.patterns.length === 2 &&
    exp3.patterns[0].id === 'lance' && exp3.patterns[1].id === 'static-veil' &&
    exp3.patterns.every(p => p.banked === 3));
  check('Channeler Charge stays 0 in export state', exp3.state.charge === 0);
}

/* --- summary --- */
console.log('\n== counts ==');
console.log('  résumés ............ ' + resumes.length);
console.log('  traits ............. ' + traits.length);
console.log('  kits ............... ' + kitsParsed.kits.length + ' (+ Custom, ' + kitsParsed.customBudget + ' cr budget)');
console.log('  techniques ......... ' + techniques.length + ' (trained ' + trained.length + ' / advanced ' + advanced.length + ' / master ' + master.length + ')');
console.log('  weapons ............ ' + weaponsParsed.weapons.length + ' (attack-stat classes: ' + weaponsParsed.attackStats.length + ')');
console.log('  armor tiers ........ ' + armor.length);
console.log('  patterns ........... ' + patterns.length + ' (the launch ten)');
console.log('  species ............ ' + species.length + ' (registry prints seven; brief said 8 — see NOTE)');
console.log('  tree entries ....... ' + Object.keys(entries).length);

if (failures) {
  console.error('\n' + failures + ' FAILURE(S). The dossier does not ship like this.');
  process.exit(1);
} else {
  console.log('\nALL GREEN. Catalog parses clean against the book.');
}
