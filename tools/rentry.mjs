#!/usr/bin/env node
/* ==========================================================================
   Rentry ⇄ planner data
   --------------------------------------------------------------------------
   Export the trees as Markdown (paste into Rentry):
     node tools/rentry.mjs export > trees.md
     node tools/rentry.mjs export swordsman > swordsman.md

   Read Markdown in the same format back into planner data:
     node tools/rentry.mjs import trees.md
   writes data/trees.from-rentry.js. Check it (node tools/validate.mjs works on
   it once you rename it to data/trees.js), then replace data/trees.js.
   Trees are matched by name, so ids, icons and "applies" tags are kept.

   Format (one tree):
     ## Swordsman
     *Melee · Common · Main Class Tree*

     **Curse · Lingering Sin:** curse text            (cursed trees)
     - *Sight lost:* text                              (curse details)
     **Form skills:** note text                       (tree notes)

     - **1 – Blade Handling** (Passive, Utility): skill text
     - **33 – Severance** (Active, Damage) ★: capstone text
         - *Bastion:* sub-rule text                    (or "- text" without a label)
         - *Circle 5-9 · Seeker Bolt:* form text *Passive:* form passive
         - *Human · Track* (Active, Utility): half text
   ========================================================================== */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadData, ROOT } from "./load-data.mjs";

const CATN = { melee: "Melee", ranged: "Ranged", magic: "Magic", support: "Support", auxiliary: "Auxiliary", cursed: "Cursed" };
const CAT_BY_NAME = Object.fromEntries(Object.entries(CATN).map(([k, v]) => [v.toLowerCase(), k]));

/* ---------------- export ---------------- */
function exportTree(t) {
  const L = [`## ${t.n}`, `*${CATN[t.c]} · ${t.r} · ${t.ty}*`, ""];
  if (t.cu) {
    L.push(`**Curse · ${t.cu[0]}:** ${t.cu[1]}`);
    (t.cu[2] || []).forEach(([a, b]) => L.push(`- *${a}:* ${b}`));
    L.push("");
  }
  (t.no || []).forEach(([a, b]) => { L.push(`**${a}:** ${b}`); L.push(""); });
  for (const s of t.sk) {
    L.push(`- **${s.t} – ${s.n}** (${s.g.join(", ")})${s.c ? " ★" : ""}:${s.x ? " " + s.x : ""}`);
    (s.s || []).forEach(([a, b]) => L.push(`    - ${a ? `*${a}:* ` : ""}${b}`));
    (s.f || []).forEach(f => L.push(`    - *Circle ${f[0]} · ${f[1]}:* ${f[2]}${f[3] ? ` *Passive:* ${f[3]}` : ""}`));
    (s.h || []).forEach(h => L.push(`    - *${h[0]} · ${h[1]}* (${h[2].join(", ")}): ${h[3]}`));
  }
  return L.join("\n");
}

/* ---------------- import ---------------- */
function parse(md, known) {
  const trees = [];
  let t = null, sk = null;
  const fail = (n, line, why) => { throw new Error(`line ${n + 1}: ${why}\n  ${line}`); };
  md.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || /^# /.test(line) || /^\(generated/.test(line)) return;
    let m;
    if ((m = line.match(/^## (.+)$/))) {
      const name = m[1].trim(), old = known.find(k => k.n === name);
      t = { id: old ? old.id : name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), n: name, sk: [], _old: old };
      trees.push(t); sk = null; return;
    }
    if (!t) fail(n, line, "text before the first ## tree heading");
    if (!t.c && (m = line.match(/^\*(.+?) · (.+?) · (.+?)\*$/))) {
      t.c = CAT_BY_NAME[m[1].toLowerCase()]; t.r = m[2]; t.ty = m[3];
      if (!t.c) fail(n, line, "unknown category " + m[1]);
      return;
    }
    if ((m = line.match(/^\*\*Curse · (.+?):\*\* ?(.*)$/))) { t.cu = [m[1], m[2], []]; sk = null; return; }
    if ((m = line.match(/^\*\*(.+?):\*\* ?(.*)$/))) { (t.no = t.no || []).push([m[1], m[2]]); sk = null; return; }
    if ((m = line.match(/^- \*\*(\d+) – (.+?)\*\* \((.+?)\)( ★)?:(?: (.*))?$/))) {
      sk = { t: +m[1], n: m[2], g: m[3].split(/,\s*/) };
      if (m[4]) sk.c = 1;
      sk.x = m[5] || "";
      const old = t._old && t._old.sk.find(s => s.n === sk.n);
      if (old && old.ap) sk.ap = old.ap;
      if (old && old.img) sk.img = old.img;
      t.sk.push(sk); return;
    }
    if (!sk && t.cu && (m = line.match(/^- \*(.+?):\* (.*)$/))) { t.cu[2].push([m[1], m[2]]); return; }
    if ((m = line.match(/^\s{2,}- (.*)$/))) {
      if (!sk) fail(n, line, "indented line outside a skill");
      const body = m[1];
      if ((m = body.match(/^\*Circle (.+?) · (.+?):\* (.*?)(?: \*Passive:\* (.*))?$/))) { (sk.f = sk.f || []).push(m[4] ? [m[1], m[2], m[3], m[4]] : [m[1], m[2], m[3]]); return; }
      if ((m = body.match(/^\*(.+?) · (.+?)\* \((.+?)\): (.*)$/))) { (sk.h = sk.h || []).push([m[1], m[2], m[3].split(/,\s*/), m[4]]); return; }
      if ((m = body.match(/^\*(.+?):\* (.*)$/))) { (sk.s = sk.s || []).push([m[1], m[2]]); return; }
      (sk.s = sk.s || []).push(["", body]); return;
    }
    fail(n, line, "line doesn't match the format (see the top of tools/rentry.mjs)");
  });
  return trees.map(({ _old, ...t }) => t);
}

/* same compact style as data/trees.js: one skill per line */
function serialize(trees) {
  const order = ["t", "n", "g", "c", "x", "s", "f", "h", "ap", "img"];
  const line = o => "{" + order.filter(k => o[k] !== undefined).map(k => k + ":" + JSON.stringify(o[k])).join(",") + "}";
  let out = "BP.TREES = [\n", last = null;
  trees.forEach((t, i) => {
    if (t.c !== last) { out += `\n/* ---- ${t.c.toUpperCase()} ---- */\n`; last = t.c; }
    const head = { id: t.id, n: t.n, c: t.c, r: t.r, ty: t.ty };
    if (t.cu) head.cu = t.cu;
    if (t.no) head.no = t.no;
    out += "{" + Object.keys(head).map(k => k + ":" + JSON.stringify(head[k])).join(",") + ",sk:[\n" + t.sk.map(line).join(",\n") + "]}" + (i < trees.length - 1 ? "," : "") + "\n";
  });
  return out + "];\n";
}

/* ---------------- cli ---------------- */
const [cmd, arg] = process.argv.slice(2);
const BP = loadData(["data/trees.js"]);
if (cmd === "export") {
  const list = arg ? BP.TREES.filter(t => t.id === arg || t.n.toLowerCase() === arg.toLowerCase()) : BP.TREES;
  if (!list.length) { console.error("No tree called " + arg); process.exit(1); }
  process.stdout.write("# Build Planner trees\n(generated by tools/rentry.mjs)\n\n" + list.map(exportTree).join("\n\n") + "\n");
} else if (cmd === "import" && arg) {
  let trees;
  try { trees = parse(readFileSync(arg, "utf8"), BP.TREES); }
  catch (e) { console.error("✗ " + e.message); process.exit(1); }
  const current = readFileSync(join(ROOT, "data/trees.js"), "utf8");
  const head = current.slice(0, current.indexOf("BP.TREES = ["));
  const outFile = join(ROOT, "data/trees.from-rentry.js");
  writeFileSync(outFile, head + serialize(trees));
  const added = trees.filter(t => !BP.TREES.some(k => k.id === t.id)).map(t => t.n);
  const gone = BP.TREES.filter(k => !trees.some(t => t.id === k.id)).map(t => t.n);
  console.log(`✓ ${trees.length} trees → data/trees.from-rentry.js`);
  if (added.length) console.log("  new: " + added.join(", ") + " (add icons in icons/<id>/)");
  if (gone.length) console.log("  not in the file (left out): " + gone.join(", "));
  console.log("  Next: check it, then replace data/trees.js with it and run node tools/validate.mjs");
} else {
  console.log("Usage:\n  node tools/rentry.mjs export [treeId] > trees.md\n  node tools/rentry.mjs import trees.md");
  process.exit(cmd ? 1 : 0);
}
