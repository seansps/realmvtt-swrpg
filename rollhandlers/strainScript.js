// Apply strain change
// Positive value = damage, negative value = healing
const isMinion =
  record.recordType === "npcs" &&
  (!record.data?.type || record.data?.type === "minion");
const isRival = record.recordType === "npcs" && record.data?.type === "rival";

// Minions and rivals have no strain — redirect to wounds
if (isMinion || isRival) {
  var wounds = parseInt(record.data?.wounds || "0", 10);
  wounds += value;
  if (wounds < 0) {
    wounds = 0;
  }

  const woundThreshold = parseInt(record.data?.woundThreshold || "0", 10);
  const woundsRemaining = Math.max(0, woundThreshold - wounds);

  valuesToSet = {
    "data.wounds": wounds,
    "data.woundsRemaining": woundsRemaining,
  };

  if (isMinion) {
    recalculateThresholds(record, valuesToSet);
  }

  api.setValues(valuesToSet);

  const token = api.getToken();
  if (token) {
    if (value > 0) {
      // Damage — check for death
      if (wounds > woundThreshold) {
        api.addEffect("Dead", token);
      }
      api.floatText(token, `-${value}`, "#FF0000");
    } else if (value < 0) {
      // Healing
      api.floatText(token, `+${Math.abs(value)}`, "#1bc91b");
    }
  }
} else {
  // PCs, nemeses, and vehicles — apply to strain
  var strain = parseInt(record.data?.strain || "0", 10);
  strain += value;
  if (strain < 0) {
    strain = 0;
  }

  const strainThreshold = parseInt(record.data?.strainThreshold || "0", 10);
  const strainRemaining = Math.min(
    Math.max(0, strainThreshold - strain),
    strainThreshold,
  );

  valuesToSet = {
    "data.strain": strain,
    "data.strainRemaining": strainRemaining,
  };

  api.setValues(valuesToSet);

  const token = api.getToken();
  if (token) {
    if (value > 0) {
      // Strain damage — purple
      if (strain > strainThreshold) {
        api.addEffect("Unconscious", token);
      }
      api.floatText(token, `-${value}`, "#b44dff");
    } else if (value < 0) {
      // Strain healing — cyan
      api.floatText(token, `+${Math.abs(value)}`, "#00e5ff");
    }
  }
}
