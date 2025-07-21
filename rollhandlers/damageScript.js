// Apply damage
// First deduct from Temp HP
let damage = value;
// Ignore negative damage as that is what healing is for
if (damage > 0) {
  var wounds = parseInt(record.data?.wounds || "0", 10);
  wounds += damage;

  // Manually calculate wounds remaining
  const woundThreshold = parseInt(record.data?.woundThreshold || "0", 10);
  const woundsRemaining = Math.max(0, woundThreshold - wounds);

  api.setValues({
    "data.wounds": wounds,
    "data.woundsRemaining": woundsRemaining,
  });
}

// If damage > 0, float text
const token = api.getToken();
if (value > 0 && token) {
  if (wounds > record.data?.woundThreshold) {
    // Minions die > 100% wounds
    if (
      token.recordType === "npcs" &&
      token.data?.type?.toLowerCase() !== "nemesis"
    ) {
      api.addEffect("Dead", token);
    } else {
      // Others are unconscious at > 100% wounds
      api.addEffect("Unconscious", token);
    }
  }
  api.floatText(token, `-${value}`, "#FF0000");
}
