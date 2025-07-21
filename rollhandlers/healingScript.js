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

  api.setValues({
    "data.wounds": wounds,
    "data.woundsRemaining": woundsRemaining,
  });
}

// If healing > 0, float text
const token = api.getToken();
if (value > 0 && token) {
  api.floatText(token, `+${value}`, "#1bc91b");
}
