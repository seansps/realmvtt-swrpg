// Apply healing
// Ignore negative healing as that is what damage is for
if (value > 0) {
  var wounds = parseInt(record.data?.wounds || "0", 10);
  wounds -= value;
  if (wounds < 0) {
    wounds = 0;
  }

  // Manually calculate wounds remaining
  const woundThreshold = parseInt(record.data?.woundThreshold || "0", 10);
  const woundsRemaining = Math.max(0, woundThreshold - wounds);

  valuesToSet = {
    "data.wounds": wounds,
    "data.woundsRemaining": woundsRemaining,
  };

  // If it's a minion, recalculate thresholds to update skill ranks
  if (
    record.recordType === "npcs" &&
    (!record.data?.type || record.data?.type === "minion")
  ) {
    recalculateThresholds(record, valuesToSet);
  }

  api.setValues(valuesToSet);
}

// If healing > 0, float text
const token = api.getToken();
if (value > 0 && token) {
  api.floatText(token, `+${value}`, "#1bc91b");
}
