#!/usr/bin/env node
/* ==========================================================================
   Build Planner data check
   Usage:  node tools/validate.mjs
   Exits with code 1 when something is broken (GitHub Actions runs this on
   every push). Warnings don't fail the check.
   ========================================================================== */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadData, ROOT } from "./load-data.mjs";

const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);

let BP;
try { BP = loadData(); }
catch (e) { console.error("✗ A data file doesn't load: " + e.message); process.exit(1); }

const TREES = BP.TREES || [], KEYWORDS = BP.KEYWORDS || [], PREMADES = BP.PREMADES || [];
const APPLIES = BP.APPLIES || [], ALIASES = BP.TREE_ALIASES || {};
const CATS = ["melee", "ranged", "magic", "support", "auxiliary", "cursed"];
const RARITIES = ["Common", "Uncommon", "Rare", "Legendary"];
const TYPES = ["Main Class Tree", "Auxiliary Tree", "Cursed Tree"];
const MAIN = "Main Class Tree";
const byId = new Map();
const AP_NAMES = new Set(APPLIES.map(a => a.k));

/* ---- trees ---- */
if (!TREES.length) err("BP.TREES is empty");
for (const t of TREES) {
  const where = `tree "${t.id || t.n || "?"}"`;
  if (!t.id || !/^[a-z0-9_]+$/.test(t.id)) err(`${where}: id must be lowercase letters, digits or _`);
  if (byId.has(t.id)) err(`${where}: duplicate id`);
  byId.set(t.id, t);
  if (!t.n) err(`${where}: missing name (n)`);
  if (!CATS.includes(t.c)) err(`${where}: category c must be one of ${CATS.join(", ")}`);
  if (!RARITIES.includes(t.r)) err(`${where}: rarity r must be one of ${RARITIES.join(", ")}`);
  if (!TYPES.includes(t.ty)) err(`${where}: type ty must be one of ${TYPES.join(", ")}`);
  if (t.c === "cursed" && !t.cu) err(`${where}: cursed trees need a curse (cu)`);
  if (t.cu && (!Array.isArray(t.cu) || typeof t.cu[0] !== "string" || typeof t.cu[1] !== "string")) err(`${where}: cu must be [name, text, [[label,text],...]]`);
  if (!Array.isArray(t.sk) || !t.sk.length) { err(`${where}: no skills`); continue; }
  if (t.sk.length !== 8) warn(`${where}: has ${t.sk.length} skills (trees usually have 8; icons 02–09 map to skills in order)`);
  const names = new Set();
  let prev = 0;
  t.sk.forEach((s, i) => {
    const sw = `${where} skill ${i + 1} "${s.n || "?"}"`;
    if (!s.n) err(`${sw}: missing name`);
    if (names.has(s.n)) err(`${sw}: duplicate skill name in this tree`);
    names.add(s.n);
    if (!Number.isInteger(s.t) || s.t < 1) err(`${sw}: tier t must be a whole number ≥ 1`);
    else if (s.t <= prev) err(`${sw}: tiers must go up (${prev} → ${s.t})`);
    prev = s.t;
    if (!Array.isArray(s.g) || !s.g.length) err(`${sw}: needs tags (g)`);
    else if (s.g.length !== 2) warn(`${sw}: has ${s.g.length} tag(s) ${JSON.stringify(s.g)} (most skills have 2)`);
    if (typeof s.x !== "string") err(`${sw}: text x must be a string`);
    else if (!s.x.trim() && !s.h) err(`${sw}: empty text`);
    if (s.ap) {
      if (!Array.isArray(s.ap)) err(`${sw}: ap must be a list`);
      else s.ap.forEach(a => { if (!AP_NAMES.has(a)) err(`${sw}: ap "${a}" isn't in BP.APPLIES (data/keywords.js)`); });
    }
    if (/\byou(r|rs|rself)?\b/i.test([s.x, ...(s.s || []).flat(), ...(s.h || []).map(h => h[3])].join(" ")))
      warn(`${sw}: uses "you"; skill text is written in neutral voice ("the user")`);
  });
  const caps = t.sk.filter(s => s.c);
  if (caps.length !== 1) err(`${where}: needs exactly one capstone (c:1), found ${caps.length}`);
  else if (caps[0] !== t.sk[t.sk.length - 1]) err(`${where}: the capstone should be the last skill`);
  if (t.sk.length && t.sk[t.sk.length - 1].t !== 33) warn(`${where}: top tier is ${t.sk[t.sk.length - 1].t}, not 33`);
  for (let n = 1; n <= t.sk.length + 1; n++) {
    const f = join(ROOT, "icons", t.id, String(n).padStart(2, "0") + ".webp");
    if (!existsSync(f)) warn(`${where}: missing icon icons/${t.id}/${String(n).padStart(2, "0")}.webp (a letter tile shows instead)`);
  }
}

/* ---- aliases ---- */
for (const [from, to] of Object.entries(ALIASES)) {
  if (byId.has(from)) err(`alias "${from}": that id still exists, remove the alias or the tree`);
  if (!byId.has(to)) err(`alias "${from}" → "${to}": no tree with id "${to}"`);
}

/* ---- keywords ---- */
const kwKeys = new Set();
function resolveSrc(src) {
  const p = src.indexOf("/"), t = byId.get(src.slice(0, p)), rest = src.slice(p + 1);
  if (p < 0 || !t) return `no tree "${src.slice(0, p)}"`;
  if (rest === "curse") return t.cu ? null : `tree "${t.id}" has no curse`;
  if (rest === "note") return (t.no || []).length ? null : `tree "${t.id}" has no note`;
  return t.sk.some(s => s.n === rest) ? null : `no skill "${rest}" in ${t.id}`;
}
for (const k of KEYWORDS) {
  const where = `keyword "${k.k || "?"}"`;
  if (!k.k) { err(`${where}: missing k`); continue; }
  if (kwKeys.has(k.k)) err(`${where}: duplicate`);
  kwKeys.add(k.k);
  const m = k.m || k.k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (/\(\?<[=!]/.test(m)) err(`${where}: pattern uses a look-behind, which breaks the app on older iPhones (use nb instead)`);
  try { new RegExp(m); } catch (e) { err(`${where}: pattern doesn't compile: ${e.message}`); }
  if (/\((?!\?)/.test(m.replace(/\\\(/g, ""))) err(`${where}: use (?:…) instead of (…) in patterns`);
  if (k.src) { const r = resolveSrc(k.src); if (r) err(`${where}: src ${r}`); }
  if (k.tree && !byId.has(k.tree)) err(`${where}: no tree "${k.tree}"`);
  if (!k.d && !k.src) err(`${where}: needs a definition (d) or a source (src)`);
}
for (const a of APPLIES) {
  if (!["dot", "debuff", "control", "mark"].includes(a.g)) err(`applies "${a.k}": group g must be dot, debuff, control or mark`);
  if (!a.d && !KEYWORDS.some(k => k.k === (a.kw || a.k))) err(`applies "${a.k}": needs d, or kw pointing at a keyword`);
}

/* ---- premades ---- */
const pmIds = new Set();
for (const p of PREMADES) {
  const where = `premade "${p.id || p.name || "?"}"`;
  if (!p.id) err(`${where}: missing id`);
  if (pmIds.has(p.id)) err(`${where}: duplicate id`);
  pmIds.add(p.id);
  if (!p.name) err(`${where}: missing name`);
  if (!Number.isInteger(p.level) || p.level < 1 || p.level > 100) err(`${where}: level must be 1–100`);
  const list = (p.trees || []).filter(Boolean);
  let total = 0, cursed = 0;
  const seen = new Set();
  list.forEach(([id, pts], i) => {
    const t = byId.get(id) || byId.get(ALIASES[id]);
    if (!t) { err(`${where}: no tree "${id}"`); return; }
    if (seen.has(t.id)) err(`${where}: ${t.n} is used twice`);
    seen.add(t.id);
    if (t.c === "cursed") cursed++;
    if (i === 0 && p.trees[0] && t.ty !== MAIN) err(`${where}: the birth tree (${t.n}) must be a Main Class tree`);
    const tiers = t.sk.map(s => s.t);
    if (pts && !tiers.includes(pts)) warn(`${where}: ${pts} points in ${t.n} isn't a tier, it snaps down`);
    total += pts || 0;
  });
  if (cursed > 1) err(`${where}: more than one cursed tree`);
  if (total > p.level) err(`${where}: spends ${total} points but level ${p.level} only gives ${p.level}`);
}

/* ---- report ---- */
const counts = `${TREES.length} trees, ${TREES.reduce((a, t) => a + t.sk.length, 0)} skills, ${KEYWORDS.length} keywords, ${PREMADES.length} premades`;
warnings.forEach(w => console.log("! " + w));
errors.forEach(e => console.log("✗ " + e));
if (errors.length) { console.log(`\n✗ ${errors.length} error(s), ${warnings.length} warning(s) · ${counts}`); process.exit(1); }
console.log(`✓ Data OK · ${counts}${warnings.length ? ` · ${warnings.length} warning(s)` : ""}`);
