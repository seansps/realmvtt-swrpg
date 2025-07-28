const roll = data.roll;
const metadata = roll?.metadata || {};
const dataPathToWeapon = metadata?.dataPathToWeapon;

const animation = metadata?.animation;
const recordId = metadata?.recordId;
const tokenId = metadata?.tokenId;
const targetId = metadata?.targetId;

// TODO (dont forget to add modifiers in rollAttack based on weapon special)

// TODO need stunBtn on attacks if stun is present
// which will tell this to show stun damage (for passive stun)
// (OR: remove the stunBtn entirely and just show both macros -- which
// means we'd need a Stun Active and Stun Passive macro))
// When you set to stun, it does 'Stun Damage'
// which gets soaked. When you activate the Stun (Active) quality it gives the
// target that much strain, which is not soaked.

// Todo macros for damage to strain (reduced by soak and not depending on
// source, such as Brawling, or item qualities)

// TODO macro for Blast too, if it has it

// TODO macros for Effects for things like ensnare, disorient, etc.

// TODO macro for Guided, if it has it

const tags = [
  {
    name: metadata?.rollName || "Attack",
    tooltip: metadata?.tooltip || "",
  },
];

// Parse the dice results
const types = roll.narrativeResults || [];
const results = parseGenesysResults(types);

let weapon = "";
let weaponName = "";
if (dataPathToWeapon) {
  weapon = api.getValue(dataPathToWeapon);
  weaponName = weapon?.name || "";
}

if (results.successes > 0) {
  message = `**[center][color=green]Hit: ${
    results.successes
  } Additional Damage${
    weaponName ? ` with ${weaponName}` : ""
  }[/color][/center]**`;
} else {
  message = `**[center][color=red]Miss${
    weaponName ? ` with ${weaponName}` : ""
  }![/color][/center]**`;
}

if (weapon) {
  // Get the weapon used for this attack
  const tagsForQualities = getTagsForQualities(weapon);
  tags.push(...tagsForQualities);

  // Add tags for crit and range
  tags.push({
    name: `Crit ${weapon.data?.crit || 0}`,
    tooltip: `Critical Rating: ${weapon.data?.crit}`,
  });
  let range = weapon.data?.range;
  // If we're using stun-setting, the range is always Short
  if (metadata?.attackType === "stun-setting") {
    range = "Short";
  }
  tags.push({
    name: `${range}`,
    tooltip: `Range: ${range}`,
  });

  let damage = parseInt(weapon.data?.damage || 0, 10) + results.successes;
  // If this is unarmed or melee add brawn from metadata
  if (weapon.data?.type === "melee weapon") {
    damage += record?.data?.brawn || 0;
  }

  message += `\n\n**[center]Total Damage: ${damage}[/center]**`;

  // Check for auto-fire trigger if this was an auto-fire attack
  if (
    metadata?.attackType === "auto-fire" &&
    results.advantages >= 2 &&
    results.successes > 0
  ) {
    const autoFireTimes = Math.floor(results.advantages / 2);
    message += `\n\n**[center][color=blue]Auto-fire Can Be Triggered${
      autoFireTimes > 1 ? ` (${autoFireTimes} Times)` : ""
    }![/color][/center]**`;
  } else if (metadata?.attackType === "stun-setting" && results.successes > 0) {
    message += `\n\n**[center][color=blue]Weapon Set to Stun[/color][/center]**`;
  }

  // If this was a stun-setting attack, or if the weapon has the stun quality,
  // then it will only show stun damage
  let damageType = "wounds";
  if (
    metadata?.attackType === "stun-setting" ||
    (weapon.data?.special && weapon.data?.special.includes("stun-damage")) ||
    (weapon.data?.special && weapon.data?.special.includes("stun-damage-droid"))
  ) {
    damageType = "stun";
  }

  const damageMacro = getDamageForMacroForAttack(
    record,
    weapon,
    damage,
    damageType
  );

  // If this has the active stun quality, and they have advantage >=2, show stun macro
  const strainRating = weapon.data?.strainRating || 0;
  let stunMacro = "";
  if (strainRating > 0 && results.advantages >= 2) {
    message += `\n\n**[center][color=blue]Stun can be Triggered[/color][/center]**`;
    stunMacro = getDamageForMacroForAttack(
      record,
      weapon,
      strainRating,
      "stun"
    );
  }

  // If there is 1 triumph or advantage >= crit rating, show the crit macro
  let critMacro = "";
  const critRating = weapon.data?.crit || 0;
  if (
    results.successes > 0 &&
    (results.triumphs > 0 ||
      (critRating > 0 &&
        results.advantages > 0 &&
        results.advantages >= critRating))
  ) {
    // Get any increaseCriticalHitMods for person doing the attack, send it to the macro
    const increaseCriticalHitMods = getEffectsAndModifiersForToken(record, [
      "increaseCriticalHit",
    ]);
    increaseCriticalHitMods.forEach((mod) => {
      mod.value = Math.abs(mod.value);
    });

    // Attempt to get the target
    let target = null;
    const targets = api.getTargets();
    if (targets.length > 0) {
      target = targets.find((t) => t.token?._id === targetId);
    }

    let critType = "notset";
    if (target?.token?.data?.type === "vehicle") {
      critType = "hit";
    } else if (
      target?.token?.recordType === "characters" ||
      target?.token?.recordType === "npcs"
    ) {
      critType = "injury";
    }

    critMacro = getRollCriticalInjuryMacro(increaseCriticalHitMods, critType);
    message += `\n\n**[center]Critical ${
      critType === "hit" ? "Hit" : "Injury"
    } Triggered if Damage Exceeds Soak[/center]**`;
  }

  message += `\n\n${damageMacro}`;
  if (critMacro) {
    message += `\n\n${critMacro}`;
  }

  api.sendMessage(message, roll, [], tags);
} else {
  // Could not find weapon, just show basic result
  api.sendMessage(message, roll, [], tags);
}

if (animation && tokenId) {
  api.playAnimation(animation, tokenId, targetId);
}
