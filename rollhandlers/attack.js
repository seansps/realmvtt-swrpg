const roll = data.roll;
const metadata = roll?.metadata || {};
const dataPathToWeapon = metadata?.dataPathToWeapon;

const animation = metadata?.animation;
const recordId = metadata?.recordId;
const tokenId = metadata?.tokenId;
const targetId = metadata?.targetId;
// Generally all attacks are on personal scale.
// Attacks made using vehicle weapons though
// will be on a planetary scale
const scale = metadata?.scale || "personal";

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

  let baseDamage = parseInt(weapon.data?.damage || 0, 10);
  // Check for superior, which increases baseDamage by 1
  const isSuperior = (weapon.data?.special || []).includes("superior");
  if (isSuperior) {
    baseDamage += 1;
  }

  let damage = baseDamage + results.successes;
  // If this is unarmed or melee add brawn from metadata unless noAddBrawn is true
  if (weapon.data?.type === "melee weapon" && !weapon.data?.noAddBrawn) {
    damage += record?.data?.brawn || 0;
  }

  if (results.successes > 0) {
    const superiorMessage = isSuperior ? " (Superior +1)" : "";
    message += `\n\n**[center]Total Damage: ${damage}${superiorMessage}[/center]**`;
  }

  // Check for auto-fire trigger if this was an auto-fire attack
  if (
    metadata?.attackType === "auto-fire" &&
    (results.advantages >= 2 || results.triumphs >= 1) &&
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
    (weapon.data?.special &&
      weapon.data?.special.includes("stun-damage-droid")) ||
    (weapon.data?.special && weapon.data?.special.includes("ion"))
  ) {
    damageType = "stun";
  }

  // Check if damage has the "breach" quality
  let breach = 0;
  if (weapon.data?.special && weapon.data?.special.includes("breach")) {
    breach = weapon.data?.breach || 0;
  }

  // Check if damage has the "pierce" quality
  let pierce = 0;
  if (weapon.data?.special && weapon.data?.special.includes("pierce")) {
    pierce = weapon.data?.pierce || 0;
  }

  const damageMacro = getDamageForMacroForAttack({
    record,
    weapon,
    damage,
    scale,
    damageType,
    breach,
    pierce,
  });

  // Attempt to get the target
  let target = null;
  const targets = api.getTargets();
  if (targets.length > 0) {
    target = targets.find((t) => t.token?._id === targetId);
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
    const increaseCrit = [];
    const increaseCriticalHitMods = getEffectsAndModifiersForToken(record, [
      "increaseCriticalHit",
    ]);
    increaseCriticalHitMods.forEach((mod) => {
      mod.value = Math.abs(mod.value);
    });
    increaseCrit.push(...increaseCriticalHitMods);

    // Check for vicious which increases crit by 10*rating
    const isVicious = (weapon.data?.special || []).includes("vicious");
    if (isVicious) {
      const viciousRating = weapon.data?.vicious || 0;
      increaseCrit.push({
        name: "Vicious",
        value: `${viciousRating * 10}`,
        active: true,
      });
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

    critMacro = getRollCriticalInjuryMacro(increaseCrit, critType);
    message += `\n\n**[center][color=blue]Critical ${
      critType === "hit" ? "Hit" : "Injury"
    } Can Be Triggered if Damage Exceeds Soak[/color][/center]**`;
  }

  // Get target's silhoutte
  // Size is a field in the format `Silhouette x`
  const targetSilhouette = target?.token?.data?.size || "Silhouette 1";
  const silhouetteNumber = parseInt(targetSilhouette.split(" ")[1], 10);
  const amountSilhouetteBeyondOne = Math.max(silhouetteNumber - 1, 0);

  // If this has the active stun quality, and they have advantage >=2 or triumph, show stun macro
  const stunRating =
    weapon.data?.special && weapon.data?.special.includes("stun")
      ? weapon.data?.stun || 0
      : 0;
  let stunMacro = "";
  if (stunRating > 0 && (results.advantages >= 2 || results.triumphs >= 1)) {
    message += `\n\n**[center][color=blue]Stun can be Triggered[/color][/center]**`;
    stunMacro = getDamageForMacroForAttack({
      record,
      weapon,
      scale,
      damage: stunRating,
      damageType: "stun",
      breach,
      pierce,
    });
  } else if (
    weapon.data?.special &&
    weapon.data?.special.includes("unarmed") &&
    results.successes > 0
  ) {
    stunMacro = getDamageForMacroForAttack({
      record,
      weapon,
      scale,
      damage,
      damageType: "stun",
      breach,
      pierce,
    });
  }

  // Blast: If success and >= 2 advanatage or triumph, show blast macro,
  // or if failure and >= 3 advantage, show blast macro
  let blastMacro = "";
  if (
    weapon.data?.special &&
    weapon.data?.special.includes("blast") &&
    ((results.successes > 0 &&
      (results.advantages >= 2 || results.triumphs >= 1)) ||
      (results.successes < 1 &&
        (results.advantages >= 3 || results.triumphs >= 1)))
  ) {
    message += `\n\n**[center][color=blue]Blast can be Triggered[/color][/center]**`;
    // Blast damage is blast rating + successes
    const blastDamage = (weapon.data?.blast || 0) + results.successes;
    blastMacro = getDamageMacro({
      damage: blastDamage,
      damageType: "blast",
    });
  }

  // Check for other macros to add
  let additionalMacros = [];
  if (
    results.successes > 0 &&
    (results.advantages >= 2 || results.triumphs >= 1)
  ) {
    // Burn:  If the  attack is successful, the target continues to suffer the
    // weapon's base damage for a number of rounds equal to the weapon’s Burn rating.
    if (weapon.data?.special && weapon.data?.special.includes("burn")) {
      const burnRating = weapon.data?.burn || 0;
      additionalMacros.push(
        getEffectMacroByName("Burn", burnRating, baseDamage)
      );
      message += `\n\n**[center][color=blue]Burn can be Triggered[/color][/center]**`;
    }
    // Concussive, staggered for a number of rounds equal to the weapon’s Concussive rating.
    if (weapon.data?.special && weapon.data?.special.includes("concussive")) {
      const concussiveRating = weapon.data?.concussive || 0;
      additionalMacros.push(
        getEffectMacroByName("Staggered", concussiveRating)
      );
      message += `\n\n**[center][color=blue]Concussive can be Triggered[/color][/center]**`;
    }
    // Disorient: If the attack is successful, the target is disoriented for a number of rounds equal to the weapon’s Disorient rating.
    if (weapon.data?.special && weapon.data?.special.includes("disorient")) {
      const disorientRating = weapon.data?.disorient || 0;
      additionalMacros.push(
        getEffectMacroByName("Disoriented", disorientRating)
      );
      message += `\n\n**[center][color=blue]Disorient can be Triggered[/color][/center]**`;
    }
    // Ensnare: If the attack is successful, the target is ensnared for a number of rounds equal to the weapon’s Ensnare rating.
    if (weapon.data?.special && weapon.data?.special.includes("ensnare")) {
      const ensnareRating = weapon.data?.ensnare || 0;
      additionalMacros.push(getEffectMacroByName("Immobilized", ensnareRating));
      message += `\n\n**[center][color=blue]Ensnare can be Triggered[/color][/center]**`;
    }
    // Knockdown applies Prone, can be triggered if 2 adv + 1 for each silhouette beyond 1
    if (
      weapon.data?.special &&
      weapon.data?.special.includes("knockdown") &&
      (results.advantages >= 2 + amountSilhouetteBeyondOne ||
        results.triumphs >= 1)
    ) {
      additionalMacros.push(getEffectMacroByName("Prone"));
      message += `\n\n**[center][color=blue]Knockdown can be Triggered[/color][/center]**`;
    }
    // Linked
    if (weapon.data?.special && weapon.data?.special.includes("linked")) {
      message += `\n\n**[center][color=blue]Linked can be Triggered[/color][/center]**`;
    }
  }

  // Slow-firing effect doesn't require success or advantage
  if (weapon.data?.special && weapon.data?.special.includes("slow-firing")) {
    const slowFiringRating = weapon.data?.slowFiring || 0;
    additionalMacros.push(
      getEffectMacroByName("Slow-Firing", slowFiringRating)
    );
  }

  // Guided, if the attack misses, and guided activates, show guided macro
  if (
    weapon.data?.special &&
    weapon.data?.special.includes("guided") &&
    results.successes < 1 &&
    (results.advantages >= 3 || results.triumphs >= 1) // Generally, guided requires 3 advantage to activate
  ) {
    additionalMacros.push(getGuidedMacro(dataPathToWeapon));
    message += `\n\n**[center][color=blue]Guided can be Triggered[/color][/center]**`;
  }

  // Sunder, we'll check for 1 or more advantage or triumph
  if (
    results.successes > 0 &&
    weapon.data?.special &&
    weapon.data?.special.includes("sunder") &&
    (results.advantages >= 1 || results.triumphs >= 1)
  ) {
    // We'll handle it narratively
    message += `\n\n**[center][color=blue]Sunder can be Triggered[/color][/center]**`;
  }

  message += `\n\n${damageMacro}`;
  if (critMacro) {
    message += `\n\n${critMacro}`;
  }
  if (stunMacro) {
    message += `\n\n${stunMacro}`;
  }
  if (blastMacro) {
    message += `\n\n${blastMacro}`;
  }
  if (additionalMacros.length > 0) {
    message += `\n\n${additionalMacros.join("\n\n")}`;
  }

  api.sendMessage(message, roll, [], tags);
} else {
  // Could not find weapon, just show basic result
  api.sendMessage(message, roll, [], tags);
}

if (animation && tokenId) {
  api.playAnimation(animation, tokenId, targetId);
}
