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
api.setValue("data.woundsRemaining", woundsRemaining);
