const token = data?.token;

const valuesToSet = {};

// Check for persistant damage effects like Burn
const modifiers = getEffectsAndModifiersForToken(
  token,
  ["persistentDamage"],
  ""
);

const damage = modifiers.reduce((acc, modifier) => acc + modifier.value, 0);

if (damage > 0) {
  const effectsNames = modifiers.map((modifier) => modifier.name).join(", ");
  const burnDamageMacro = getDamageMacro({
    damage: damage,
    damageType: "wounds",
  });
  const message = `Taking ${damage} damage due to ${effectsNames}.\n${burnDamageMacro}`;
  api.sendMessage(message, undefined, undefined, undefined, token);
}
