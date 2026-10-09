/* ==========================================================================
   Build Planner v2 · hover keywords
   --------------------------------------------------------------------------
   Every term listed here gets a dotted underline in skill text; hovering,
   tapping or focusing it shows the tooltip. Only the first occurrence per
   skill is underlined.

   Skill names don't need entries: a skill name used inside its own tree's
   text (e.g. "Parry" in Counter Edge, "Combo" in Second Wind) links to that
   skill automatically.

   Fields
     k     term shown as the tooltip title (unique)
     m     pattern to match in text (regular expression, no look-behind);
           default = the term itself
     cs    1 = only match when written with a capital first letter (default)
           0 = match any case ("evasion", "Evasion")
     d     definition. Optional when src is given.
     src   where the mechanic is defined: "treeId/Skill name",
           "treeId/curse" or "treeId/note". Shown as "Defined in …";
           without d, the tooltip shows that skill's own text.
     tree  only link inside this tree (for tree-specific resources like Debt)
     link  0 = keep the definition but never underline it
     nb    skip matches directly preceded by this text ("Scent " for Mark)
   ========================================================================== */
window.BP = window.BP || {};

BP.KEYWORDS = [

/* ---- General rules (from the Skill Trees doc) ---- */
{k:"Attack",link:0,d:"Any offensive action, weapon or spell."},
{k:"Hit",link:0,d:"An attack that lands on the target. Multi-hit attacks count each hit separately."},
{k:"Strike",link:0,d:"Any attack."},
{k:"Weapon",link:0,d:"Any wielded weapon, including staffs and catalysts."},
{k:"Spell",link:0,d:"A magic skill. Spells are not weapon-bound, so anyone who learns one can cast it."},
{k:"Kill",m:"kill(?:s|ed)?",cs:0,d:"An enemy's death is credited to whoever applied the killing effect, including damage over time and delayed effects."},
{k:"Attack speed",m:"attack speed",cs:0,d:"How fast the user attacks with weapons. Does not affect casting. Bonus attack speed is capped at +200%."},
{k:"Cast speed",m:"cast speed",cs:0,d:"How fast the user casts spells. Separate stat from attack speed. Bonus cast speed is capped at +200%."},
{k:"Speed bonuses",link:0,d:"Attack speed bonus max +200%. Cast speed bonus max +200%."},
{k:"Critical chance",m:"critical chance",cs:0,d:"Max 100%. Overcapped critical chance converts to critical damage at a 1:5 ratio."},
{k:"Damage reduction",m:"damage reduction",cs:0,d:"Max 60% combined from all sources."},
{k:"Evasion chance",m:"evasion (?:chance|cap)",cs:0,d:"Max 70%."},
{k:"Evasion",m:"evasions?|evade[sd]?",cs:0,d:"Avoiding an attack through evasion chance or an evasive skill (dodges, sidesteps, rolls, afterimages). Parries, deflects, and blocks are not evasions. Skills that \"count as an evasion\" trigger evasion effects (Drift, Riposte) even though no attack was avoided."},
{k:"Secondary hits",m:"secondary hits?",cs:0,d:"Count as hits, but can never trigger another secondary hit of the same kind."},
{k:"Stored damage",m:"stored damage",cs:0,d:"Damage banked on a target or object instead of being applied immediately, released later (often at a multiplier). Stored damage cannot be cleansed, transferred, or reduced."},
{k:"True damage",m:"true damage",cs:0,d:"Damage that ignores barriers, Defense, and damage reduction."},
{k:"Barrier",m:"barriers?",cs:0,d:"Any layer that absorbs damage before HP, including Blessing, Bulwark-based barriers, Lifeshield, and monster mana shells."},
{k:"Healing reduction",m:"healing reduction",cs:0,d:"Reduces all HP restored to a target, including healing, regeneration, and lifesteal."},
{k:"Luck",d:"A base stat that improves overall luck."},
{k:"Position",m:"Position(?:s|al)?|Frontal|Behind|Above",d:"The zone an attack comes from, relative to its target: Frontal (within its vision arc), Behind (outside it), or Above (airborne or elevated relative to it). A target without sight (Blind, or a sightless creature) has no vision arc: all attacks against it count as Behind. Only one positional bonus may apply per hit."},
{k:"Gadget",m:"Gadgets?",d:"A mechanical device learned as a skill and carried ready. A deployed Gadget is an object: it can be targeted, destroyed, and affected by area effects."},

/* ---- Damage over time ---- */
{k:"Damage over time",m:"damage over time",cs:0,d:"Burn, Bleed, Poison, Acid, Sear, Soulbleed, Blight, Infection, Rot, and similar. Ticks do NOT count as hits."},
{k:"Burn",m:"Burn(?:s|ing|ed)?",src:"pyromancer/Tinder",d:"Fire damage over time. Max 10 stacks. Lasts 15 seconds, refreshed whenever a new stack is applied."},
{k:"Bleed",m:"Bleed(?:s|ing)?",d:"Hits and effects apply 1 Bleed (max 10). Bleed lasts 15 seconds, refreshed whenever a new stack is applied, ticking damage every 3 seconds. If the target moved in the last second (including displacement), ticks deal 50% bonus damage."},
{k:"Poison",m:"Poison(?:s|ed)?",d:"Hits apply 1 Poison (max 10); poison skills apply 2 instead. Poison lasts 30 seconds, refreshed whenever a new stack is applied, ticking damage every 2 seconds. More stacks, heavier ticks."},
{k:"Acid",d:"Hits apply 1 Acid (max 5). Acid lasts 12 seconds, refreshed on application, ticking damage every 3 seconds. Each Acid stack reduces the target's Defense by 3% while held."},
{k:"Sear",d:"A burning brand (max 5 stacks, 10 seconds). Each time the target casts a spell, all Sear stacks deal damage at once and the duration is refreshed."},
{k:"Soulbleed",d:"A shadow curse lasting 10 seconds, ticking every 2 seconds. Each tick heals the afflicter for 50% of the damage dealt."},
{k:"Blight",d:"A creeping rot lasting 12 seconds, ticking every 3 seconds. If Blight is cleansed before it expires, it detonates for all its remaining tick damage plus 50%."},
{k:"Rot",d:"Damage over time that pays out its stored damage over 5 seconds and ignores barriers."},
{k:"Wither",m:"Wither(?:ed)?",src:"wither/Festering",d:"Max 5 stacks. Lasts 8 seconds, refreshed on each new stack. Each Wither reduces healing the target receives by 4%."},

/* ---- Debuffs and statuses ---- */
{k:"Debuff",m:"debuff(?:s|ed)?",cs:0,d:"Any negative status on a target: Burn, Chill, Static, Bleed, Poison, Acid, Sear, Soulbleed, Blight, Weight, Condemn, Infection, Snare, Wither, Weakened, Slow, curses, defense reductions. Crowd control effects are not debuffs. Stored damage is not a debuff."},
{k:"Chill",m:"Chill(?:s|ed)?",src:"cryomancer/Chill",d:"Max 10 stacks. Lasts 30 seconds, refreshed whenever a new stack is applied. Each Chill slows the target. At max Chill, the target Freezes."},
{k:"Static",src:"stormcaller/Static",d:"Max 20 stacks. Lasts 6 seconds, refreshed whenever a new stack is applied. Each Static increases all damage the target takes from the user by 0.5%."},
{k:"Weight",src:"graviturgist/Weight",d:"Max 5 stacks. Each Weight slows the target and increases the damage it takes from displacement (knockbacks, pulls, and pushes). At 5 Weight, the target is Grounded."},
{k:"Condemn",m:"Condemn(?:ed)?",src:"executioner/Condemn",d:"Max 10 stacks. Each Condemn increases the damage the target takes from the user by 2%. Lasts 15 seconds, refreshed whenever a new stack is applied."},
{k:"Snare",m:"Snare(?:s|d)?",d:"A stacking slow (max 5). Each Snare slows the target by 4%. At max Snare, the target is Rooted for 2 seconds and all Snare is removed. Snare is a debuff."},
{k:"Slow",m:"slow(?:s|ed|ing)?",cs:0,d:"Reduces movement speed. Slows from different sources do not stack; the strongest applies."},
{k:"Weakened",d:"The target deals reduced damage for the duration. Weakened is a debuff."},
{k:"Exposed",src:"deadeye/Prediction"},
{k:"Off-Balance",src:"quicksilver/Riposte"},
{k:"Mark",m:"Mark(?:s|ed)?(?! a spot)(?![^.]*\\bas Prey)",nb:"Scent ",d:"A status that identifies a target for the user and allies. Marks are not debuffs."},
{k:"Prey",d:"A status that identifies a target as the user's quarry, for the user only. Prey is not a debuff and cannot be shared like a Mark."},

/* ---- Crowd control and movement ---- */
{k:"Crowd control",m:"crowd control",cs:0,d:"Effects that fully or partly remove control of a character: Stun, Silence, Freeze, Rooted, Grounded, Fear, Charm, Shackle, Blind, and Hysteria. Duration halved against stronger targets. After any crowd control ends, the target is immune to that same effect for 5 seconds."},
{k:"Stun",m:"Stun(?:s|ned)?",cs:0,d:"Crowd control. The target cannot act for the duration."},                 /* drafted in v2: check */
{k:"Silence",m:"Silence[sd]?",cs:0,d:"Crowd control. The target cannot cast spells for the duration."},   /* drafted in v2: check */
{k:"Freeze",m:"Freez(?:e|es|ing)|Frozen",src:"cryomancer/Chill",d:"Crowd control. Encased in ice and unable to act for 5 seconds, then immune to Freeze for 10 seconds. Happens at max Chill."},
{k:"Rooted",m:"Root(?:ed|s|ing)?",d:"The target cannot move from its position but can still attack, cast, and turn. Forced displacement (knockbacks, pulls, pushes, drags) still moves a Rooted target."},
{k:"Grounded",src:"graviturgist/Weight",d:"Crowd control. Unable to jump, fly, or dash for 3 seconds. Happens at 5 Weight."},
{k:"Pinned",m:"Pin(?:s|ned)?",cs:0,src:"archer/Pinning Shot"},
{k:"Immobile",d:"A target that is Rooted, Pinned, Frozen, Stunned, or Grappled. Any skill that references Immobile applies to a target in any of these states."},
{k:"Fear",d:"The target flees from the user for the duration. Any damage taken ends Fear early."},
{k:"Charm",m:"Charm(?:s|ed)?",d:"The target treats the user as an ally and the user's enemies as its own. Any damage taken ends Charm."},
{k:"Shackle",m:"Shackle(?:s|d)?",d:"The target's weapons are bound: it cannot make weapon attacks, but can still move and cast."},
{k:"Blind",m:"Blind(?:ed)?",d:"The target's attacks have a 50% chance to miss, and it cannot benefit from sight-based effects. Misses caused by Blind do not count as evasions."},
{k:"Hysteria",src:"madness/Laughter of the Mad God",d:"Crowd control. +10% damage dealt, and the affected attack the nearest creature regardless of side."},
{k:"Taunt",m:"Taunt(?:s|ed)?",cs:0,src:"guardian/Taunt",d:"The target is forced to attack the user."},
{k:"Stagger",m:"stagger(?:s|ed|ing)?",cs:0,d:"A brief interrupt that delays the target's next action by 1 second. Staggers are not crowd control: full duration applies to any target, and bosses are not immune between staggers."},
{k:"Displacement",m:"displacements?|knockbacks?|knocked back|knocks? back",cs:0,d:"Forced movement: knockbacks, pulls, pushes, and drags. Displacement always moves the target unless it is immune or anchored."},

/* ---- Tree mechanics (only linked inside their own tree) ---- */
/* Executioner */
{k:"Heavy weapons",m:"heavy weapons?",cs:0,tree:"executioner",src:"executioner/Heavy Arms"},
/* Aegis */
{k:"Fortified",tree:"aegis",src:"aegis/Fortify"},
{k:"Perfect Fortify",tree:"aegis",src:"aegis/Fortify"},
{k:"Thorns",tree:"aegis",src:"aegis/Spiked Guard"},
/* Gunner */
{k:"Rounds",m:"round types?|Rounds",cs:0,tree:"gunner",src:"gunner/Firearm Handling"},
/* Heavy Gunner */
{k:"Overheat",m:"Overheat(?:s|ing)?",tree:"heavy_gunner",src:"heavy_gunner/Heat"},
/* Demolisher */
{k:"Recoil",tree:"demolisher",src:"demolisher/Heavy Machinery"},
/* Thrower */
{k:"Embed",m:"embed(?:s|ded)?",cs:0,tree:"thrower",src:"thrower/Throwing Arm"},
/* Pyromancer */
{k:"Ember Bolt",tree:"pyromancer",src:"pyromancer/Flame Affinity"},
/* Stormcaller */
{k:"Charge",tree:"stormcaller",src:"stormcaller/Overcharge"},
{k:"Conductor",m:"Conductors?",tree:"stormcaller",src:"stormcaller/Conduction"},
/* Conjurer */
{k:"Form",m:"Formless|Spear|Hook|Buckler|Forms?",tree:"conjurer",src:"conjurer/Reforge"},
/* Reactor */
{k:"Meltdown",m:"Meltdowns?|Melts Down",tree:"reactor",src:"reactor/Instability"},
/* Mycomancer */
{k:"Mushroom",m:"mushrooms?|Puffcaps?|Spitters?|Glowcaps?",cs:0,tree:"mycomancer",src:"mycomancer/Cultivate"},
{k:"Maturity",tree:"mycomancer",src:"mycomancer/Maturation"},
{k:"Spore Shot",m:"Spore Shots?",tree:"mycomancer",src:"mycomancer/Fungal Affinity"},
/* Spellthief */
{k:"Aether",tree:"spellthief",src:"spellthief/Disrupt"},
/* Debtcaster */
{k:"Debt",tree:"debtcaster",src:"debtcaster/Credit"},
{k:"Credit Limit",tree:"debtcaster",src:"debtcaster/Credit"},
{k:"Due",tree:"debtcaster",src:"debtcaster/Credit"},
{k:"Default",tree:"debtcaster",src:"debtcaster/Credit"},
{k:"Rating",tree:"debtcaster",src:"debtcaster/Credit Rating"},
{k:"Lien",m:"Liens?",tree:"debtcaster",src:"debtcaster/Foreclosure"},
/* Archmage */
{k:"Attunement",tree:"archmage",src:"archmage/Ascension"},
{k:"Circle",m:"Circles?",tree:"archmage",src:"archmage/Ascension"},
{k:"Descend",tree:"archmage",src:"archmage/Ascension"},
{k:"Arcane Bolt",tree:"archmage",src:"archmage/Arcane Mastery"},
{k:"Mass",tree:"archmage",src:"archmage/Singularity"},
/* Barrier Master */
{k:"Property",m:"Propert(?:y|ies)",tree:"barrier_master",src:"barrier_master/Lifeshield"},
/* Sequencer */
{k:"Program",m:"Programs?",tree:"sequencer",src:"sequencer/Compile"},
{k:"Delay",m:"Delays?",tree:"sequencer",src:"sequencer/Compile"},
{k:"Condition",m:"Conditions?",tree:"sequencer",src:"sequencer/Conditional"},
{k:"Targeted",tree:"sequencer",src:"sequencer/Ping"},
/* Hexer */
{k:"Affliction",m:"Afflictions?|afflicted",cs:0,tree:"hexer",src:"hexer/Curse Affinity"},
/* Spirit Caller */
{k:"Rotation",tree:"spirit_caller",src:"spirit_caller/Spirit Bond"},
{k:"Wisp",m:"(?:Fire|Frost|Thunder|Stone) Wisps?",tree:"spirit_caller",src:"spirit_caller/Spirit Bond"},
{k:"Blessing",m:"Blessings?",tree:"spirit_caller",src:"spirit_caller/Bestow"},
{k:"Exhausted",tree:"spirit_caller",src:"spirit_caller/Spirit Merge"},
/* Skillmaster */
{k:"Record",m:"Record(?:s|ed)?",tree:"skillmaster",src:"skillmaster/Codex"},
{k:"Annotation",tree:"skillmaster",src:"skillmaster/Annotate"},
/* Chef */
{k:"Meal",m:"Meals?",tree:"chef",src:"chef/Cooking"},
{k:"Field Snack",tree:"chef",src:"chef/Cooking"},
{k:"Snack",m:"Snacks?",tree:"chef",src:"chef/Snack Pack"},
/* Penitent */
{k:"Boon",m:"Boons?",tree:"penitent",src:"penitent/Relish"},
{k:"Sympathy",tree:"penitent",src:"penitent/Sympathetic Pain"},
{k:"Lingering Sin",tree:"penitent",src:"penitent/curse"},
/* Madness */
{k:"Madness",tree:"madness",src:"madness/curse"},
/* Carnage */
{k:"Price of Slaughter",tree:"carnage",src:"carnage/curse"},
/* Scourge */
{k:"Inverted healing",m:"inverted healing",cs:0,tree:"scourge",src:"scourge/curse"},
/* Lycanthropy */
{k:"Beast",tree:"lycanthropy",src:"lycanthropy/Beast Form"},
{k:"Moonbeast",tree:"lycanthropy",src:"lycanthropy/Moonbound"},
{k:"Fury",tree:"lycanthropy",src:"lycanthropy/Pent-Up Fury"},
{k:"Scent Mark",m:"Scent Marks?",tree:"lycanthropy",src:"lycanthropy/Territory"},
{k:"Form skill",m:"Form skills?",tree:"lycanthropy",src:"lycanthropy/note"},
/* Obsession */
{k:"Obsession",tree:"obsession",src:"obsession/curse"},
{k:"Withdrawal",tree:"obsession",src:"obsession/curse"},
{k:"Relapse",m:"Relaps(?:e|es|ed)",tree:"obsession",src:"obsession/curse"}
];

/* ==========================================================================
   "Applies" panel: what a build puts on its targets.
   Skills list what they apply in data/trees.js (ap:["Burn", ...]); this list
   sets the order and grouping. k = name shown, g = group (dot | debuff |
   control | mark), kw = keyword whose definition the tooltip shows (default k),
   d = definition for generic entries that aren't keywords.
   ========================================================================== */
BP.APPLIES = [
/* damage over time */
{k:"Burn",g:"dot"},{k:"Bleed",g:"dot"},{k:"Poison",g:"dot"},{k:"Rot",g:"dot"},{k:"Blight",g:"dot"},
{k:"Infection",g:"dot",d:"Spore infection from 0 to 100%. Every 10% makes the target take +2% spore damage. Lasts 20 seconds, refreshed whenever more is applied."},
/* debuffs */
{k:"Chill",g:"debuff"},{k:"Static",g:"debuff"},{k:"Weight",g:"debuff"},{k:"Condemn",g:"debuff"},{k:"Snare",g:"debuff"},{k:"Wither",g:"debuff"},
{k:"Mass",g:"debuff"},{k:"Lien",g:"debuff"},{k:"Weakened",g:"debuff"},{k:"Exposed",g:"debuff"},{k:"Off-Balance",g:"debuff"},
{k:"Defense down",g:"debuff",d:"Lowers the target's Defense."},
{k:"Damage taken up",g:"debuff",d:"The target takes more damage."},
{k:"Damage dealt down",g:"debuff",d:"The target deals less damage."},
{k:"Healing blocked",g:"debuff",d:"The target can't be healed for a while."},
/* control */
{k:"Freeze",g:"control"},{k:"Root",g:"control",kw:"Rooted"},{k:"Stun",g:"control"},{k:"Silence",g:"control"},{k:"Taunt",g:"control"},
{k:"Grounded",g:"control"},{k:"Pin",g:"control",kw:"Pinned"},{k:"Grapple",g:"control",d:"Held in place by the user. Counts as Immobile."},
{k:"Hysteria",g:"control"},{k:"Stagger",g:"control"},{k:"Knockback",g:"control",kw:"Displacement"},{k:"Pull",g:"control",kw:"Displacement"},{k:"Slow",g:"control"},
/* marks */
{k:"Mark",g:"mark"},{k:"Prey",g:"mark"}
];
