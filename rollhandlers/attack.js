const roll = data.roll;
const metadata = roll?.metadata || {};
const dataPathToWeapon = metadata?.dataPathToWeapon;

// TODO

// Todo lookup weapon by ID
// TOdo generate tags for special props

// Show crit macro if trimpth or # adv >= crit rating

// If success > 0
// Add success to damage of weapon, and if unarmed or melee, add brawn from metadata
// getDamageForMacroForAttack(record, weapon, successes)

// TODO need stunBtn on attacks if stun is present
// which will tell this to show stun damage (for passive stun)
// (OR: remove the stunBtn entirely and just show both macros -- which
// means we'd need a Stun Active and Stun Passive macro))
// When you set to stun, it does 'Stun Damage'
// which gets soaked. When you activate the Stun (Active) quality it gives the
// target that much strain, which is not soaked.

// Todo macros for damage to strain (reduced by soak and not depending on
// source, such as Brawling, or item qualities)

const tags = [
  {
    name: metadata?.rollName || "Attack",
    tooltip: metadata?.tooltip || "",
  },
];

if (dataPathToWeapon) {
  // Get the weapon used for this attack
  const weapon = api.getValue(dataPathToWeapon);
  const tagsForQualities = getTagsForQualities(weapon.data?.special || []);
  tags.push(...tagsForQualities);

  api.sendMessage("", roll, [], tags);
}
{
  // Could not find weapon, just show basic result
  api.sendMessage("", roll, [], tags);
}
