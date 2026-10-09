/* ==========================================================================
   Build Planner v2 · premade builds  (Saves → Premades)
   --------------------------------------------------------------------------
   Loading a premade replaces the trees, points and level. The character's
   name, title, rank, flavor text and portrait stay as they are.

   To add one: set up the build in the planner, open Saves → Premades and
   press "Copy current build as a premade entry", then paste it below and
   write a description.

     id     unique, lowercase, used internally
     name   shown in the list
     desc   one or two sentences
     level  character level (points available = level)
     trees  [[treeId, points], ...] in slot order: birth tree, sub tree 1,
            sub tree 2. Points snap down to the nearest tier.
   ========================================================================== */
window.BP = window.BP || {};

BP.PREMADES = [
{id:"ember-fist", name:"Ember Fist", level:33,
 desc:"Every punch sets the target alight. Burn feeds Fervor and Opening for attack speed and keeps Opportunist's bonus damage switched on, Combo builds toward a big Suplex, and Twist the Knife makes the Burn tick early.",
 trees:[["brawler",21],["pyromancer",6],["opportunist",6]]},
 {id:"mash", name:"Mash", level:67,
 desc:" Play around Aegis defense conversion mechanic.",
 trees:[["aegis",33],["madness",21],["gambler",11]]},
];
