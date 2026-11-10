#!/usr/bin/env node
// Tests for the "minionCountInName" campaign setting
// Usage: node tests/test-minion-name.js

const vm = require("vm");
const { createSandbox, loadScript } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

function makeMinion(overrides = {}) {
  return {
    _id: "minion1",
    recordType: "npcs",
    name: "Stormtrooper",
    data: {
      type: "minion",
      woundsPerMinion: 5,
      numberInGroup: 3,
      woundThreshold: 15,
      wounds: 0,
      skills: [],
      ...(overrides.data || {}),
    },
    fields: {},
    ...(overrides.top || {}),
  };
}

function sandboxWithSetting(value) {
  const ctx = createSandbox();
  ctx.api.getSetting = (key) => (key === "minionCountInName" ? value : null);
  return ctx;
}

function recalcName(ctx, record, extraValues = {}) {
  const values = { ...extraValues };
  ctx.recalculateThresholds(record, values);
  return values;
}

// ── Name helper ──────────────────────────────────────────────
section("getMinionGroupName");
{
  const ctx = createSandbox();
  assert("appends count", ctx.getMinionGroupName("Stormtrooper", 3), "Stormtrooper [3]");
  assert("replaces existing count", ctx.getMinionGroupName("Stormtrooper [3]", 2), "Stormtrooper [2]");
  assert("never negative", ctx.getMinionGroupName("Stormtrooper [1]", -2), "Stormtrooper [0]");
  assert("keeps other brackets", ctx.getMinionGroupName("Guard [Elite]", 4), "Guard [Elite] [4]");
}

// ── recalculateThresholds ────────────────────────────────────
section("recalculateThresholds name updates");
{
  const off = sandboxWithSetting(null);
  assert("setting unset: name untouched", recalcName(off, makeMinion()).name, undefined);
  const no = sandboxWithSetting("no");
  assert("setting no: name untouched", recalcName(no, makeMinion()).name, undefined);

  const on = sandboxWithSetting("yes");
  assert("group of 3, no wounds", recalcName(on, makeMinion()).name, "Stormtrooper [3]");
  assert(
    "one minion down (6 wounds)",
    recalcName(on, makeMinion({ top: { name: "Stormtrooper [3]" } }), { "data.wounds": 6 }).name,
    "Stormtrooper [2]",
  );
  assert(
    "exactly at 5 wounds still 3",
    recalcName(on, makeMinion({ top: { name: "Stormtrooper [2]" } }), { "data.wounds": 5 }).name,
    "Stormtrooper [3]",
  );
  assert(
    "all dead clamps at 0",
    recalcName(on, makeMinion({ top: { name: "Stormtrooper [1]" } }), { "data.wounds": 40 }).name,
    "Stormtrooper [0]",
  );
  assert(
    "no change when name already correct",
    recalcName(on, makeMinion({ top: { name: "Stormtrooper [3]" } })).name,
    undefined,
  );
  assert(
    "zero wounds per minion: name untouched",
    recalcName(on, makeMinion({ data: { woundsPerMinion: 0 } })).name,
    undefined,
  );
  assert(
    "rival: name untouched",
    recalcName(on, makeMinion({ data: { type: "rival" } })).name,
    undefined,
  );
  assert(
    "vehicles record type: name untouched",
    recalcName(on, makeMinion({ top: { recordType: "vehicles" }, data: { type: undefined } })).name,
    undefined,
  );
}

// ── Apply Damage macro + Undo ────────────────────────────────
section("Apply Damage macro renames and undo restores name");
{
  const ctx = sandboxWithSetting("yes");
  const originalName = `Jabba's "Elite" Guard [3]`;
  const target = makeMinion({ top: { name: originalName } });
  let setOnRecord = null;
  let sent = null;
  ctx.api.getSelectedOrDroppedToken = () => [target];
  ctx.api.setValuesOnRecord = (rec, values) => {
    setOnRecord = values;
  };
  ctx.api.sendMessage = (msg) => {
    sent = msg;
  };

  const macro = ctx.getDamageMacro({ damage: 6 });
  const code = macro.replace(/^```[^\n]*\n/, "").replace(/```\s*$/, "");
  new vm.Script(code).runInContext(ctx);

  assert("damage renames to [2]", setOnRecord && setOnRecord.name, `Jabba's "Elite" Guard [2]`);

  const undoMatch = sent && sent.match(/```Undo\n([\s\S]*?)```/);
  assert("undo macro present", !!undoMatch, true);
  if (undoMatch) {
    let restored = null;
    ctx.isGM = true;
    ctx.api.setValuesOnTokenById = (id, type, values) => {
      restored = values;
    };
    ctx.api.editMessage = () => {};
    new vm.Script(undoMatch[1]).runInContext(ctx);
    assert("undo restores original name", restored && restored.name, originalName);
    assert("undo restores wounds", restored && restored["data.wounds"], 0);
  }
}

section("Apply Healing macro renames and undo restores name");
{
  const ctx = sandboxWithSetting("yes");
  const originalName = "Stormtrooper [1]";
  const target = makeMinion({ top: { name: originalName }, data: { wounds: 12 } });
  let setOnRecord = null;
  let sent = null;
  ctx.api.getSelectedOrDroppedToken = () => [target];
  ctx.api.setValuesOnRecord = (rec, values) => {
    setOnRecord = values;
  };
  ctx.api.sendMessage = (msg) => {
    sent = msg;
  };

  const macro = ctx.getHealingMacro(10);
  const code = macro.replace(/^```[^\n]*\n/, "").replace(/```\s*$/, "");
  new vm.Script(code).runInContext(ctx);

  assert("healing renames to [3]", setOnRecord && setOnRecord.name, "Stormtrooper [3]");
  const undoMatch = sent && sent.match(/```Undo\n([\s\S]*?)```/);
  if (undoMatch) {
    let restored = null;
    ctx.isGM = true;
    ctx.api.setValuesOnTokenById = (id, type, values) => {
      restored = values;
    };
    ctx.api.editMessage = () => {};
    new vm.Script(undoMatch[1]).runInContext(ctx);
    assert("heal undo restores original name", restored && restored.name, originalName);
  } else {
    assert("heal undo macro present", false, true);
  }
}

// ── Combat tracker wound edit ────────────────────────────────
section("onChangeWounds recalculates minion name");
{
  const ctx = sandboxWithSetting("yes");
  ctx.record = makeMinion({ top: { name: "Stormtrooper [3]" }, data: { wounds: 11 } });
  let setValues = null;
  ctx.api.setValues = (values) => {
    setValues = values;
  };
  loadScript(ctx, "onChangeWounds.js");
  assert("tracker edit renames to [1]", setValues && setValues.name, "Stormtrooper [1]");
}

process.exit(summary() > 0 ? 1 : 0);
