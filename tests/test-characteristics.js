// Tests for characteristic bonuses (characteristicBonus / characteristicSet)
// in rollhandlers/common.js.
// Run: node tests/test-characteristics.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const { recalcCharacteristicBonuses, updateAttributes, onCharacteristicChanged } =
  ctx;

// --- fixtures ---------------------------------------------------------------

function bonusMod(field, value, extra = {}) {
  return {
    data: {
      type: "characteristicBonus",
      field,
      valueType: "number",
      value: String(value),
      ...extra,
    },
  };
}

function setMod(field, value, extra = {}) {
  return {
    data: {
      type: "characteristicSet",
      field,
      valueType: "number",
      value: String(value),
      ...extra,
    },
  };
}

function talent(name, modifiers, extra = {}) {
  return { _id: name, name, data: { modifiers, ...extra } };
}

function item(name, modifiers, carried = "equipped", extra = {}) {
  return { _id: name, name, data: { carried, modifiers, ...extra } };
}

// A character as it exists BEFORE this feature shipped: scores and thresholds,
// but no {char}Base / {char}Bonus / woundThresholdBrawn keys anywhere.
function legacyCharacter(overrides = {}) {
  return {
    _id: "c1",
    recordType: "characters",
    effects: [],
    effectIds: [],
    data: {
      brawn: 3,
      agility: 2,
      intellect: 2,
      cunning: 2,
      willpower: 4,
      presence: 2,
      woundThreshold: 15,
      strainThreshold: 16,
      wounds: 0,
      strain: 0,
      species: [{ data: { woundThreshold: 10, strainThreshold: 10 } }],
      talents: [],
      inventory: [],
      ...overrides,
    },
  };
}

// Apply the flat "data.x" patch a handler produces back onto a record, the way
// the server would, so a test can run a second pass against the new state.
function commit(rec, valuesToSet) {
  const next = JSON.parse(JSON.stringify(rec));
  Object.keys(valuesToSet).forEach((key) => {
    if (!key.startsWith("data.")) return;
    const path = key.slice(5);
    if (path.includes(".")) return; // nested list writes aren't needed here
    next.data[path] = valuesToSet[key];
  });
  return next;
}

function recalc(rec, seed = {}) {
  const valuesToSet = { ...seed };
  recalcCharacteristicBonuses(rec, valuesToSet);
  return valuesToSet;
}

function fullUpdate(rec, seed = {}) {
  const valuesToSet = { ...seed };
  updateAttributes(rec, valuesToSet);
  return valuesToSet;
}

// --- tests ------------------------------------------------------------------

section("recalcCharacteristicBonuses — migrating a character with no Base keys");
{
  const v = recalc(legacyCharacter());
  assert("snapshots Base from the current score", v["data.brawnBase"], 3);
  assert("bonus is 0 with no modifiers", v["data.brawnBonus"], 0);
  assert("set is cleared to null", v["data.brawnSet"], null);
  assert("effective score is unchanged", v["data.brawn"], 3);
  assert("every characteristic is migrated", v["data.presenceBase"], 2);
}

section("recalcCharacteristicBonuses — is idempotent once Base exists");
{
  const migrated = commit(legacyCharacter(), recalc(legacyCharacter()));
  const v = recalc(migrated);
  assert("score stays put", v["data.brawn"], 3);
  assert("bonus stays 0", v["data.brawnBonus"], 0);
  assert("Base is not re-snapshotted", v["data.brawnBase"], undefined);
}

section("characteristicBonus — talents");
{
  const rec = legacyCharacter({
    talents: [talent("Enduring", [bonusMod("brawn", 1)])],
  });
  const v = recalc(rec);
  assert("Base is the pre-bonus score", v["data.brawnBase"], 3);
  assert("bonus is collected", v["data.brawnBonus"], 1);
  assert("effective score adds the bonus", v["data.brawn"], 4);
  assert("other characteristics untouched", v["data.agility"], 2);
}

section("characteristicBonus — a ranked talent applies once per rank");
{
  const rec = legacyCharacter({
    talents: [talent("Grit", [bonusMod("willpower", 1)], { rank: 3 })],
  });
  const v = recalc(rec);
  assert("rank 3 grants +3", v["data.willpowerBonus"], 3);
  assert("effective score", v["data.willpower"], 7);
}

section("characteristicBonus — bonuses from several sources stack");
{
  const rec = legacyCharacter({
    talents: [talent("Enduring", [bonusMod("brawn", 1)])],
    inventory: [item("Powered Armor", [bonusMod("brawn", 2)])],
  });
  const v = recalc(rec);
  assert("talent + item", v["data.brawnBonus"], 3);
  assert("effective score", v["data.brawn"], 6);
}

section("characteristicBonus — only equipped items count");
{
  const carried = legacyCharacter({
    inventory: [item("Powered Armor", [bonusMod("brawn", 2)], "carried")],
  });
  assert("carried is ignored", recalc(carried)["data.brawnBonus"], 0);

  const dropped = legacyCharacter({
    inventory: [item("Powered Armor", [bonusMod("brawn", 2)], "dropped")],
  });
  assert("dropped is ignored", recalc(dropped)["data.brawnBonus"], 0);

  const equipped = legacyCharacter({
    inventory: [item("Powered Armor", [bonusMod("brawn", 2)], "equipped")],
  });
  assert("equipped applies", recalc(equipped)["data.brawnBonus"], 2);
}

section("characteristicBonus — unequipping reverts the score");
{
  let rec = legacyCharacter({
    inventory: [item("Powered Armor", [bonusMod("brawn", 2)])],
  });
  rec = commit(rec, recalc(rec));
  assert("equipped score", rec.data.brawn, 5);

  rec.data.inventory[0].data.carried = "carried";
  const v = recalc(rec);
  assert("score reverts to base", v["data.brawn"], 3);
  assert("bonus is cleared", v["data.brawnBonus"], 0);
}

section("characteristicBonus — removing a talent reverts the score");
{
  let rec = legacyCharacter({
    talents: [talent("Enduring", [bonusMod("brawn", 1)])],
  });
  rec = commit(rec, recalc(rec));
  assert("with talent", rec.data.brawn, 4);

  rec.data.talents = [];
  const v = recalc(rec);
  assert("score reverts", v["data.brawn"], 3);
  assert("bonus cleared", v["data.brawnBonus"], 0);
}

section("characteristicBonus — itemOnly modifiers never reach the character");
{
  const rec = legacyCharacter({
    inventory: [
      item("Vibro-axe", [bonusMod("brawn", 2, { itemOnly: true })]),
    ],
  });
  assert("itemOnly is skipped", recalc(rec)["data.brawnBonus"], 0);
}

section("characteristicBonus — unknown / empty field is ignored");
{
  const rec = legacyCharacter({
    talents: [
      talent("Bogus", [bonusMod("smarts", 5), bonusMod("", 5)]),
    ],
  });
  const v = recalc(rec);
  assert("no characteristic changed", v["data.brawn"], 3);
  assert("intellect untouched", v["data.intellect"], 2);
}

section("characteristicBonus — field name is matched case-insensitively");
{
  const rec = legacyCharacter({
    talents: [talent("Shouty", [bonusMod("Brawn", 1)])],
  });
  assert("Brawn == brawn", recalc(rec)["data.brawn"], 4);
}

section("characteristicSet — acts as a floor, not an override");
{
  const raises = legacyCharacter({
    inventory: [item("Cybernetic Arm", [setMod("brawn", 5)])],
  });
  const v1 = recalc(raises);
  assert("raises a lower score", v1["data.brawn"], 5);
  assert("recorded for revert", v1["data.brawnSet"], 5);
  assert("bonus stays 0", v1["data.brawnBonus"], 0);

  const noop = legacyCharacter({
    brawn: 6,
    inventory: [item("Cybernetic Arm", [setMod("brawn", 5)])],
  });
  assert("never lowers a higher score", recalc(noop)["data.brawn"], 6);
}

section("characteristicSet — highest set wins, and stacks on top of bonuses");
{
  const rec = legacyCharacter({
    inventory: [
      item("Cybernetic Arm", [setMod("brawn", 5)]),
      item("Better Arm", [setMod("brawn", 6)]),
    ],
  });
  assert("highest set wins", recalc(rec)["data.brawn"], 6);

  const withBonus = legacyCharacter({
    talents: [talent("Enduring", [bonusMod("brawn", 4)])],
    inventory: [item("Cybernetic Arm", [setMod("brawn", 5)])],
  });
  const v = recalc(withBonus);
  assert("base+bonus beats the set floor", v["data.brawn"], 7);
  assert("set is still tracked", v["data.brawnSet"], 5);
}

section("characteristicSet — unequipping reverts and clears the stored set");
{
  let rec = legacyCharacter({
    inventory: [item("Cybernetic Arm", [setMod("brawn", 5)])],
  });
  rec = commit(rec, recalc(rec));
  assert("set applied", rec.data.brawn, 5);
  assert("set stored", rec.data.brawnSet, 5);

  rec.data.inventory[0].data.carried = "carried";
  const v = recalc(rec);
  assert("score reverts to base", v["data.brawn"], 3);
  assert("stored set cleared", v["data.brawnSet"], null);
}

section("updateAttributes — derived stats follow the bonused Brawn");
{
  const rec = legacyCharacter({
    talents: [talent("Enduring", [bonusMod("brawn", 1)])],
  });
  const v = fullUpdate(rec);
  assert("effective brawn", v["data.brawn"], 4);
  assert("soak = brawn + armor", v["data.soakValue"], 4);
  assert("encumbrance threshold = 5 + brawn", v["data.encumbranceThreshold"], 9);
}

section("updateAttributes — a characteristic bonus NEVER moves wound/strain threshold");
{
  // Thresholds are fixed at creation (species + Brawn/Willpower) and after that
  // only woundThresholdBonus / strainThresholdBonus move them.
  const plain = fullUpdate(legacyCharacter());
  assert("wound threshold unchanged", plain["data.woundThreshold"], 15);
  assert("strain threshold unchanged", plain["data.strainThreshold"], 16);

  const brawnBonus = fullUpdate(
    legacyCharacter({ talents: [talent("Enduring", [bonusMod("brawn", 1)])] }),
  );
  assert("brawn goes up", brawnBonus["data.brawn"], 4);
  assert("wound threshold does NOT", brawnBonus["data.woundThreshold"], 15);
  assert("soak DOES", brawnBonus["data.soakValue"], 4);

  const wpBonus = fullUpdate(
    legacyCharacter({ talents: [talent("Grit", [bonusMod("willpower", 2)])] }),
  );
  assert("willpower goes up", wpBonus["data.willpower"], 6);
  assert("strain threshold does NOT", wpBonus["data.strainThreshold"], 16);

  const setItem = fullUpdate(
    legacyCharacter({
      inventory: [item("Cybernetic Arm", [setMod("brawn", 5)])],
    }),
  );
  assert("set floors brawn", setItem["data.brawn"], 5);
  assert("wound threshold still static", setItem["data.woundThreshold"], 15);
  assert("soak follows the set", setItem["data.soakValue"], 5);
}

section("updateAttributes — creation still seeds the threshold from Brawn/Willpower");
{
  // No stored threshold yet: species + characteristic is the starting value.
  const fresh = legacyCharacter();
  delete fresh.data.woundThreshold;
  delete fresh.data.strainThreshold;
  const v = fullUpdate(fresh);
  assert("wound threshold seeded", v["data.woundThreshold"], 13);
  assert("strain threshold seeded", v["data.strainThreshold"], 14);
}

section("updateAttributes — raising a characteristic BY HAND leaves thresholds alone");
{
  let rec = legacyCharacter();
  rec = commit(rec, fullUpdate(rec));

  const written = {};
  const scoped = createSandbox();
  scoped.api.setValues = (v) => Object.assign(written, v);
  scoped.onCharacteristicChanged(rec, "brawn", 4);

  assert("brawn goes up", written["data.brawn"], 4);
  assert("wound threshold stays put", written["data.woundThreshold"], 15);
  assert("soak still follows brawn", written["data.soakValue"], 4);
}

section("updateAttributes — woundThresholdBonus modifiers still move the threshold");
{
  let rec = legacyCharacter();
  rec = commit(rec, fullUpdate(rec));

  rec.data.inventory = [
    item("Armor Plating", [
      {
        data: {
          type: "woundThresholdBonus",
          field: "",
          valueType: "number",
          value: "3",
        },
      },
    ]),
  ];
  rec = commit(rec, fullUpdate(rec));
  assert("threshold up by the bonus", rec.data.woundThreshold, 18);

  rec.data.inventory[0].data.carried = "carried";
  rec = commit(rec, fullUpdate(rec));
  assert("threshold reverts on unequip", rec.data.woundThreshold, 15);
}

section("updateAttributes — XP-bought threshold increases survive a recalc");
{
  let rec = legacyCharacter();
  rec = commit(rec, fullUpdate(rec));

  // Player buys +2 wound threshold by hand.
  rec.data.woundThreshold = 17;
  rec = commit(rec, fullUpdate(rec));
  assert("purchase is not recomputed away", rec.data.woundThreshold, 17);

  rec.data.talents = [talent("Enduring", [bonusMod("brawn", 1)])];
  rec = commit(rec, fullUpdate(rec));
  assert("a brawn bonus does not disturb it", rec.data.woundThreshold, 17);
}

section("recalculateThresholds — a direct updateAttribute pass leaves the threshold alone");
{
  // Editing a vitals field calls updateAttribute directly, which reaches
  // recalculateThresholds without recalcCharacteristicBonuses running first.
  // The stored threshold must survive that untouched.
  const rec = legacyCharacter();
  const valuesToSet = {};
  ctx.updateAttribute({
    record: rec,
    attribute: "wounds",
    value: 0,
    moreValuesToSet: valuesToSet,
  });
  assert("threshold untouched", valuesToSet["data.woundThreshold"], 15);
}

section("onCharacteristicChanged — a manual edit sets Base, bonuses stay on top");
{
  const written = {};
  const rec = legacyCharacter({
    talents: [talent("Enduring", [bonusMod("brawn", 1)])],
  });
  const scoped = createSandbox();
  scoped.api.setValues = (v) => Object.assign(written, v);
  scoped.onCharacteristicChanged(rec, "brawn", 4);

  assert("typed value becomes the base", written["data.brawnBase"], 4);
  assert("talent bonus still applies", written["data.brawn"], 5);
  assert("bonus recorded", written["data.brawnBonus"], 1);
}

section("NPCs — feature modifiers feed the same pipeline");
{
  const npc = {
    _id: "n1",
    recordType: "npcs",
    effects: [],
    effectIds: [],
    data: {
      brawn: 2,
      agility: 2,
      intellect: 2,
      cunning: 2,
      willpower: 2,
      presence: 2,
      woundThreshold: 12,
      strainThreshold: 12,
      wounds: 0,
      strain: 0,
      type: "rival",
      features: [talent("Hardened", [bonusMod("brawn", 2)])],
      talents: [],
      inventory: [],
    },
  };
  const v = recalc(npc);
  assert("NPC feature bonus applies", v["data.brawn"], 4);
  assert("NPC base snapshotted", v["data.brawnBase"], 2);
}

process.exit(summary());
