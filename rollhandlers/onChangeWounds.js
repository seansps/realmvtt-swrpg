// Update current hp
var wounds = record.data?.wounds || 0;
var woundThreshold = record.data?.woundThreshold || 0;
var woundsRemaining = woundThreshold - wounds;
if (woundsRemaining < 0) {
  woundsRemaining = 0;
}
if (woundsRemaining > woundThreshold) {
  woundsRemaining = woundThreshold;
}
const valuesToSet = { "data.woundsRemaining": woundsRemaining };

// Minions: recalculate group size (skill ranks and, if enabled, the name count)
if (
  record.recordType === "npcs" &&
  (!record.data?.type || record.data?.type === "minion")
) {
  recalculateThresholds(record, valuesToSet);
}

api.setValues(valuesToSet);
