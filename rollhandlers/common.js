// Generates a random UUID for adding Subskills manually to Skills during character creation
function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    // Generate a random number between 0 and 15 (0xF)
    const r = Math.floor(Math.random() * 16);
    // For 'x', use random digit
    // For 'y', use random digit with bits 0 and 1 set to 1 and 0 respectively (8, 9, A, or B)
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    // Convert to hexadecimal string
    return v.toString(16);
  });
}

function getEffectAppliedBy(record, effect) {
  const effectValue = record?.effectValues?.[effect?._id];
  if (effectValue && effectValue?.tokenId !== "null") {
    return effectValue?.tokenId;
  }
  return null;
}

const getNearestParentDataPath = (dataPath) => {
  const parts = dataPath.split(".data");
  return parts.length > 1 ? parts.slice(0, -1).join(".data") : "";
};

function capitalize(string) {
  if (!string || typeof string !== "string") return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function normalToCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/\s+(.)/g, (match, char) => char.toUpperCase());
}

function camelToNormal(skill) {
  return skill.replace(/([A-Z])/g, " $1").replace(/^./, function (str) {
    return str.toUpperCase();
  });
}

function convertToDataPaths(data) {
  const result = {};

  function processObject(obj, currentPath = "") {
    // Exit early if obj is null or undefined
    if (obj === null || obj === undefined) return;

    // Handle arrays and objects differently
    if (Array.isArray(obj)) {
      // For arrays, we store the entire array at the current path
      result[currentPath] = obj;
    } else if (typeof obj === "object") {
      // For objects, recursively process each property
      Object.keys(obj).forEach((key) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;

        // If the value is a primitive or an array, add it directly to the result
        if (
          typeof obj[key] !== "object" ||
          Array.isArray(obj[key]) ||
          obj[key] === null
        ) {
          result[newPath] = obj[key];
        } else {
          // Otherwise, recursively process the nested object
          processObject(obj[key], newPath);
        }
      });
    } else {
      // Handle primitive values
      result[currentPath] = obj;
    }
  }

  processObject(data);
  return result;
}

function evaluateMath(stringValue) {
  // Return 0 if no value provided
  if (!stringValue) return 0;

  try {
    // Remove all whitespace and validate string only contains valid math characters
    const sanitizedString = stringValue.replace(/\s+/g, "");
    if (!/^[0-9+\-*/().]+$/.test(sanitizedString)) {
      return 0;
    }

    // Use Function constructor to safely evaluate the math expression
    // Math.floor to match D&D's rounding down convention
    return Math.floor(Function(`'use strict'; return (${sanitizedString})`)());
  } catch (e) {
    // Return 0 if evaluation fails
    return 0;
  }
}

function applyMath(value, math) {
  // Trim spaces and split the string into operator and number
  const trimmedMath = math.trim();
  const operator = trimmedMath.charAt(0);
  const number = parseInt(trimmedMath.slice(1).trim(), 10);

  if (isNaN(number)) {
    return value;
  }

  switch (operator) {
    case "+":
      return value + number;
    case "-":
      return value - number;
    case "*":
      return value * number;
    case "/":
      return Math.floor(value / number); // Always round down
    default:
      return value;
  }
}

// Checks for replacements in a string modifier
function checkForReplacements(value, replacements = {}, recordOverride = null) {
  let thisRecord = recordOverride || record;
  // Case for Brawn|Agility|Intellect|Cunning|Willpower|Presence
  const matchModifier = value.match(
    /[Bb]rawn|[Aa]gility|[Ii]ntellect|[Cc]unning|[Ww]illpower|[Pp]resence/
  );
  if (matchModifier) {
    const attributeMod = parseInt(
      thisRecord?.data?.[matchModifier[0]] || "0",
      10
    );
    value = value.replaceAll(matchModifier[0], attributeMod);
  }
  // Check for replacements in the replacements object
  if (replacements && Object.keys(replacements).length > 0) {
    Object.keys(replacements).forEach((key) => {
      value = value.replaceAll(key, replacements[key]);
    });
  }
  return value;
}

// Function to parse Star Wars/Genesys dice results
function parseGenesysResults(diceResults) {
  let numSuccess = 0;
  let numAdvantage = 0;
  let numThreat = 0;
  let numDespair = 0;
  let numTriumph = 0;
  let numFailure = 0;

  diceResults.forEach((die) => {
    const dieType = die.type.toLowerCase();
    const dieValue = die.value;

    if (dieType === "ability") {
      // Ability die (d8)
      if (dieValue === 1) {
        // No Op
      } else if (dieValue === 2 || dieValue === 3) {
        numSuccess++;
      } else if (dieValue === 4) {
        numSuccess += 2;
      } else if (dieValue === 5 || dieValue === 6) {
        numAdvantage++;
      } else if (dieValue === 7) {
        numSuccess++;
        numAdvantage++;
      } else if (dieValue === 8) {
        numAdvantage += 2;
      }
    } else if (dieType === "difficulty") {
      // Difficulty die (d8)
      if (dieValue === 1) {
        // No Op
      } else if (dieValue === 2) {
        numFailure++;
      } else if (dieValue === 3) {
        numFailure += 2;
      } else if (dieValue === 4 || dieValue === 5 || dieValue === 6) {
        numThreat++;
      } else if (dieValue === 7) {
        numThreat += 2;
      } else if (dieValue === 8) {
        numFailure++;
        numThreat++;
      }
    } else if (dieType === "proficiency") {
      // Proficiency die (d12)
      if (dieValue === 1) {
        // No Op
      } else if (dieValue === 2 || dieValue === 3) {
        numSuccess++;
      } else if (dieValue === 4 || dieValue === 5) {
        numSuccess += 2;
      } else if (dieValue === 6) {
        numAdvantage++;
      } else if (dieValue === 7 || dieValue === 8 || dieValue === 9) {
        numSuccess++;
        numAdvantage++;
      } else if (dieValue === 10 || dieValue === 11) {
        numAdvantage += 2;
      } else if (dieValue === 12) {
        numTriumph++;
      }
    } else if (dieType === "challenge") {
      // Challenge die (d12)
      if (dieValue === 1) {
        // No Op
      } else if (dieValue === 2 || dieValue === 3) {
        numFailure++;
      } else if (dieValue === 4 || dieValue === 5) {
        numFailure += 2;
      } else if (dieValue === 6 || dieValue === 7) {
        numThreat++;
      } else if (dieValue === 8 || dieValue === 9) {
        numFailure++;
        numThreat++;
      } else if (dieValue === 10 || dieValue === 11) {
        numThreat += 2;
      } else if (dieValue === 12) {
        numDespair++;
      }
    } else if (dieType === "boost") {
      // Boost die (d6)
      if (dieValue === 1 || dieValue === 2) {
        // No Op
      } else if (dieValue === 3) {
        numSuccess++;
      } else if (dieValue === 4) {
        numSuccess++;
        numAdvantage++;
      } else if (dieValue === 5) {
        numAdvantage += 2;
      } else if (dieValue === 6) {
        numAdvantage++;
      }
    } else if (dieType === "setback") {
      // Setback die (d6)
      if (dieValue === 1 || dieValue === 2) {
        // No Op
      } else if (dieValue === 3 || dieValue === 4) {
        numFailure++;
      } else if (dieValue === 5 || dieValue === 6) {
        numThreat++;
      }
    }
  });

  // Cancel out failures/threats with successes/advantages
  const finalSuccesses = numSuccess + numTriumph - numFailure - numDespair;
  const finalAdvantages = numAdvantage - numThreat;

  return {
    successes: finalSuccesses,
    advantages: finalAdvantages,
    rawSuccesses: numSuccess,
    rawAdvantages: numAdvantage,
    rawFailures: numFailure,
    rawThreats: numThreat,
    triumphs: numTriumph,
    despairs: numDespair,
  };
}

// Collects all modifiers from effects and features for a token or record
function getEffectsAndModifiersForToken(
  target,
  types = [],
  field = "",
  itemId = undefined,
  appliedById = undefined,
  // If Weapon is provided, we also look on it and attachments on it
  weapon = undefined,
  // If Ammo is provided, we also look for modifiers on it
  ammoItem = undefined,
  ability = undefined
) {
  if (!target) {
    return [];
  }
  let results = [];

  // Set of stack modifiers that we have seen so we don't duplicate them
  const stackModifiers = {};

  // First collect modifiers from effects
  const effects = target?.effects || [];
  effects.forEach((effect) => {
    const rules = effect.rules || [];
    rules.forEach((rule) => {
      const ruleType = rule?.type || "";
      const isPenalty = ruleType.toLowerCase().includes("penalty");
      let value = rule.value || "";
      if (rule.valueType === "number") {
        value = parseInt(rule.value, 10);
        if (isNaN(value)) {
          value = 0;
        }
        if (isPenalty && value > 0) {
          value = -value;
        }
      } else if (
        rule.valueType === "string" &&
        !value.trim().startsWith("-") &&
        isPenalty &&
        !value.includes("disadvantage")
      ) {
        value = "-" + value;
      }
      // Check for strings that require replacements
      if (rule.valueType === "string") {
        value = checkForReplacements(value, {}, target);
      }
      if (
        value !== 0 &&
        (rule.valueType === "number" || rule.valueType === "string")
      ) {
        let name = effect.name || "Effect";
        // If this is a stackable effect, add the effect per stack amount with a different name each time
        let times = 1;
        if (effect.stackable) {
          times = target?.effectIds?.filter((id) => id === effect?._id).length;
        }
        for (let i = 0; i < times; i++) {
          results.push({
            name: i > 0 ? `${name} (x${i + 1})` : name,
            value: value,
            active: true,
            modifierType: ruleType,
            field: rule?.field || "",
            valueType: rule.valueType,
            isPenalty: isPenalty,
            isEffect: true,
            appliedBy: getEffectAppliedBy(target, effect),
          });
        }
      } else if (rule.valueType === "api") {
        let value = parseInt(target?.effectValues?.[effect?._id] || "0", 10);
        if (isPenalty && value > 0) {
          value = -value;
        }
        if (value !== 0) {
          results.push({
            name: effect.name || "Effect",
            value: value,
            active: true,
            modifierType: ruleType,
            field: rule?.field || "",
            valueType: rule.valueType,
            isPenalty: isPenalty,
            isEffect: true,
            appliedBy: null,
          });
        }
      } else if (
        rule.valueType === "stack" &&
        !stackModifiers[`${effect?._id}-${JSON.stringify(rule)}`]
      ) {
        stackModifiers[`${effect?._id}-${JSON.stringify(rule)}`] = true;
        // The value is the number of times they have this effect
        let value = target?.effectIds?.filter(
          (id) => id === effect?._id
        ).length;
        if (isPenalty && value > 0) {
          value = -value;
        }
        // Check if there is addtional math to apply to it
        const math = rule?.value || "";
        if (math) {
          value = applyMath(value, math);
        }
        if (isPenalty && value > 0) {
          value = -value;
        }
        if (value !== 0) {
          results.push({
            name: effect.name || "Effect",
            value: value,
            active: true,
            modifierType: ruleType,
            field: rule?.field || "",
            valueType: rule.valueType,
            isPenalty: isPenalty,
            isEffect: true,
            appliedBy: getEffectAppliedBy(target, effect),
          });
        }
      }
    });
  });

  // Now collect all modifiers from Species, Careers, Talents, and Items
  // Ensure items is an array before filtering
  const items = Array.isArray(target?.data?.inventory)
    ? target?.data?.inventory
    : [];

  // Get all species features
  const species = target?.data?.species || [];
  const speciesFeatures = [];
  species.forEach((s) => {
    const features = s.data?.features || [];
    features.forEach((feature) => {
      speciesFeatures.push(feature);
    });
  });

  // Get all talents
  const talents = target?.data?.talents || [];

  // NPCs get features
  const npcFeatures = target?.data?.features || [];

  // Items that are equipped with attachments
  const attachments = weapon ? weapon?.data?.attachments || [] : [];
  // Filter attachments to only include attachments that are active
  // Assume undefined/null means active
  const activeAttachments = attachments
    .filter(
      (attachment) =>
        attachment.data?.active === true ||
        attachment.data?.active === undefined ||
        attachment.data?.active === null
    )
    .map((attachment) => ({
      ...attachment,
      weaponId: weapon?._id,
    }));

  // If ability is provided, add any talents from it
  const abilityTalents = [...(ability?.data?.talents || [])];

  // Get critical injuries
  const criticalInjuries = target?.data?.criticalInjuries || [];

  // Filter items that are not equipped
  const equippedItems = items.filter(
    (item) => item.data?.carried === "equipped"
  );
  [
    ...speciesFeatures,
    ...talents,
    ...equippedItems,
    ...npcFeatures,
    ...activeAttachments,
    ...abilityTalents,
    ...criticalInjuries,
    ...(weapon ? [weapon] : []),
    ...(ammoItem ? [ammoItem] : []),
  ].forEach((feature) => {
    const modifiers = feature.data?.modifiers || [];
    modifiers.forEach((modifier) => {
      const ruleType = modifier.data?.type || "";
      const isPenalty = ruleType.toLowerCase().includes("penalty");
      let value = modifier.data?.value || "";
      if (modifier.data?.valueType === "number") {
        value = parseInt(modifier.data?.value, 10);
        if (isNaN(value)) {
          value = 0;
        }
        if (isPenalty && value > 0) {
          value = -value;
        }
      } else if (modifier.data?.valueType === "field") {
        const fieldToUse = modifier.data?.value || "";
        if (fieldToUse) {
          value = target?.data?.[fieldToUse] || "";
        }
      } else if (
        modifier.data?.valueType === "string" &&
        !value.trim().startsWith("-") &&
        isPenalty
      ) {
        value = "-" + value;
      }

      // Check for strings that require replacements
      if (modifier.data?.valueType === "string") {
        value = checkForReplacements(value, {}, target);
      }

      // Only relevant if it has a value
      if (value !== 0) {
        // Check if this only applies to equipped item and mark it with ID if so
        const itemOnly = modifier.data?.itemOnly || false;
        results.push({
          name: feature?.name || "Feature",
          value: value,
          active: modifier.data?.active === true,
          modifierType: ruleType,
          field: modifier.data?.field || "",
          valueType: modifier.data?.valueType,
          itemId: itemOnly ? feature?._id : undefined,
          isPenalty: isPenalty,
          isEffect: false,
        });
      }
    });
  });

  if (types && types.length > 0) {
    results = results.filter((r) => types.includes(r.modifierType));
  }

  if (field && field !== "") {
    results = results.filter(
      (r) => r.field === field || r.field === "all" || !r.field
    );
  }

  // Filter by itemId if provided
  results = results.filter(
    (r) => r.itemId === itemId || r.itemId === undefined
  );

  // Filter by appliedById if provided
  if (appliedById) {
    results = results.filter((r) => r.appliedBy === appliedById);
  }

  return results;
}

function updateAttribute({
  record,
  attribute,
  value,
  moreValuesToSet = undefined,
}) {
  const valuesToSet = moreValuesToSet || {};

  // Set the attribute value
  valuesToSet[`data.${attribute}`] = value;

  // Recalculate derived attributes based on which attribute changed
  if (attribute === "brawn") {
    // Only set wound threshold if it's undefined (first time)
    if (record?.data?.woundThreshold === undefined) {
      const species = record?.data?.species?.[0];
      const speciesWoundThreshold = species?.data?.woundThreshold || 10;
      const woundThreshold = speciesWoundThreshold + parseInt(value || "0", 10);
      valuesToSet["data.woundThreshold"] = woundThreshold;
    }

    // Update Soak Value: brawn + armor soak (always updates)
    // TODO when adding items, get soak from armor
    const armorSoak = 0;
    const soakValue = parseInt(value || "0", 10) + armorSoak;
    valuesToSet["data.soakValue"] = soakValue;

    // Update wounds remaining with current threshold
    const currentWounds = parseInt(record?.data?.wounds || "0", 10);
    const woundThreshold = parseInt(record?.data?.woundThreshold || "0", 10);
    valuesToSet["data.woundsRemaining"] = Math.max(
      0,
      woundThreshold - currentWounds
    );

    // Characters have an “encumbrance threshold" of 5 plus
    // their Brawn rating
    const encumbranceThreshold = 5 + parseInt(value || "0", 10);
    valuesToSet["data.encumbranceThreshold"] = encumbranceThreshold;
  }

  if (attribute === "willpower") {
    // Only set strain threshold if it's undefined (first time)
    if (record?.data?.strainThreshold === undefined) {
      const species = record?.data?.species?.[0];
      const speciesStrainThreshold = species?.data?.strainThreshold || 10;
      const strainThreshold =
        speciesStrainThreshold + parseInt(value || "0", 10);
      valuesToSet["data.strainThreshold"] = strainThreshold;
    }

    // Update strain remaining with current threshold
    const currentStrain = parseInt(record?.data?.strain || "0", 10);
    const strainThreshold = parseInt(record?.data?.strainThreshold || "0", 10);
    valuesToSet["data.strainRemaining"] = Math.max(
      0,
      strainThreshold - currentStrain
    );
  }

  if (attribute === "wounds") {
    // Update wounds remaining: threshold - wounds
    const woundThreshold = parseInt(record?.data?.woundThreshold || "0", 10);
    const woundsRemaining = Math.max(
      0,
      woundThreshold - parseInt(value || "0", 10)
    );
    valuesToSet["data.woundsRemaining"] = woundsRemaining;
  }

  if (attribute === "strain") {
    // Update strain remaining: threshold - strain
    const strainThreshold = parseInt(record?.data?.strainThreshold || "0", 10);
    const strainRemaining = Math.max(
      0,
      strainThreshold - parseInt(value || "0", 10)
    );
    valuesToSet["data.strainRemaining"] = strainRemaining;
  }

  // If moreValuesToSet was passed, merge the values instead of setting them
  if (moreValuesToSet) {
    Object.keys(valuesToSet).forEach((key) => {
      moreValuesToSet[key] = valuesToSet[key];
    });
  } else {
    // Set the values directly
    api.setValues(valuesToSet);
  }
}

function updateAttributes(record, moreValuesToSet = undefined) {
  const valuesToSet = moreValuesToSet || {};

  // List of all characteristics
  const characteristics = [
    "brawn",
    "agility",
    "intellect",
    "cunning",
    "willpower",
    "presence",
  ];

  // Update each characteristic using updateAttribute
  characteristics.forEach((attribute) => {
    const currentValue = parseInt(record?.data?.[attribute] || "0", 10);
    updateAttribute({
      record,
      attribute,
      value: currentValue,
      moreValuesToSet: valuesToSet,
    });
  });

  // Also update wounds and strain to recalculate remaining values
  const currentWounds = parseInt(record?.data?.wounds || "0", 10);
  const currentStrain = parseInt(record?.data?.strain || "0", 10);

  updateAttribute({
    record,
    attribute: "wounds",
    value: currentWounds,
    moreValuesToSet: valuesToSet,
  });

  updateAttribute({
    record,
    attribute: "strain",
    value: currentStrain,
    moreValuesToSet: valuesToSet,
  });

  // Recalculate thresholds to account for modifiers that directly affect derived stats
  // (like Soak Value Bonus, Wound Threshold Bonus, etc.)
  recalculateThresholds(record, valuesToSet);

  // If moreValuesToSet was passed, we've already merged everything
  // Otherwise, set the values directly
  if (!moreValuesToSet) {
    api.setValues(valuesToSet);
  }
}

function getTagsForQualities(qualities) {
  const tags = [];

  if (qualities.includes("accurate")) {
    tags.push({
      name: "Accurate (Passive)",
      tooltip: "Add 1 Boost die to combat checks with this weapon",
    });
  }

  if (qualities.includes("auto-fire")) {
    tags.push({
      name: "Auto-Fire (Active)",
      tooltip:
        "Increases difficulty by 1 when fired in Auto-Fire. On hit, spend 2 Advantage to trigger Auto-fire for additional hit. Can trigger multiple times. Additional hits can target same or different targets within range. Initial target must be highest difficulty/defense. Each hit can activate Critical Injury.",
    });
  }

  if (qualities.includes("breach")) {
    tags.push({
      name: "Breach (Passive)",
      tooltip:
        "Ignores 1 point of armor per rank of Breach (meaning they also ignore 10 points of soak for every rating of Breach)",
    });
  }

  if (qualities.includes("burn")) {
    tags.push({
      name: "Burn (Active)",
      tooltip:
        "If the attack is successful, can spend 2 Advantage to set target on fire. The target continues to suffer the weapon's base damage for a number of rounds equal to the weapon's Burn rating. Damage is applied at the start of each of the target's actions. A victim can attempt a Coordination check to stop the burn, or jump in water.",
    });
  }

  if (qualities.includes("blast")) {
    tags.push({
      name: "Blast (Active)",
      tooltip:
        "If the attack is successful, can spend 2 Advantage to activate Blast. Each character (friend or foe) Engaged with the original target suffers wounds equal to the weapon's Blast rating (plus an additional wound per Success as usual). The user may also trigger Blast if the attack misses, by spending 3 Advantage. In this case, the original target and every target engaged with the original target suffers damage equal to the Blast rating of the weapon.",
    });
  }

  if (qualities.includes("concussive")) {
    tags.push({
      name: "Concussive (Active)",
      tooltip:
        "May spend 2 Advantage to stagger the target for a number of rounds equal to the weapon's Concussive rating. A staggered target cannot perform actions.",
    });
  }

  if (qualities.includes("cortosis")) {
    tags.push({
      name: "Cortosis (Passive)",
      tooltip:
        "Weapons with the Cortosis quality are immune to the Sunder quality. Armor with the Cortosis quality makes the wearer's soak immune to the Pierce and Breach qualities.",
    });
  }

  if (qualities.includes("cumbersome")) {
    tags.push({
      name: "Cumbersome (Passive)",
      tooltip:
        "To wield a Cumbersome weapon properly, the character needs a Brawn characteristic equal to or greater than the weapon's Cumbersome rating. For each point of Brawn the character is deficient, he must increase the difficulty of all checks made while using the weapon by one.",
    });
  }

  if (qualities.includes("defensive")) {
    tags.push({
      name: "Defensive (Passive)",
      tooltip:
        "A character wielding a weapon with the Defensive quality increases his melee defense by the weapon's Defensive rating.",
    });
  }

  if (qualities.includes("deflection")) {
    tags.push({
      name: "Deflection (Passive)",
      tooltip:
        "An item with the Deflection quality increases the wearer's ranged defense equal to its Deflection rating.",
    });
  }

  if (qualities.includes("disorient")) {
    tags.push({
      name: "Disorient (Active)",
      tooltip:
        "May spend 2 Advantage to disorient target for a number of rounds equal to the weapon's Disorient rating. A disoriented target adds 1 Setback die to all skill checks he performs.",
    });
  }

  if (qualities.includes("ensnare")) {
    tags.push({
      name: "Ensnare (Active)",
      tooltip:
        "May spend 2 Advantage to immobilize target for a number of rounds equal to the weapon's Ensnare rating. An immobilized target cannot perform maneuvers. An Ensnared target may attempt a Hard Athletics check as his action on his turn to break free from the effect.",
    });
  }

  if (qualities.includes("guided")) {
    tags.push({
      name: "Guided (Active)",
      tooltip:
        "On a miss, may spend 3 Advantage (unless otherwise specified in the weapon's description) to make an attack check at the end of the round. The difficulty of the check is calculated by comparing the weapon's silhouette of 0 to the silhouette of the target, and the check's Ability dice equal to the weapon's Guided rating. If the test is successful, the weapon strikes the target and damage is dealt normally.",
    });
  }

  if (qualities.includes("knockdown")) {
    tags.push({
      name: "Knockdown (Active)",
      tooltip:
        "May spend 2 Advantage (plus 1 per silhouette beyond 1) to knock target prone.",
    });
  }

  if (qualities.includes("inaccurate")) {
    tags.push({
      name: "Inaccurate (Passive)",
      tooltip: "Add 1 Setback die to combat checks with this weapon.",
    });
  }

  if (qualities.includes("inferior")) {
    tags.push({
      name: "Inferior (Passive)",
      tooltip:
        "An Inferior weapon generates automatic Threat on all checks related to its use, and has its base damage decreased by one. Inferior armor has its encumbrance increased by one and its defense decreased by one. If it does not have defense, decrease its soak value by one to a minimum of zero.",
    });
  }

  if (qualities.includes("ion")) {
    tags.push({
      name: "Ion (Passive)",
      tooltip:
        "Deals system strain damage instead of physical damage. Droids are affected by ion weapons, taking damage to their strain threshold.",
    });
  }

  if (qualities.includes("limited-ammo")) {
    tags.push({
      name: "Limited Ammo (Passive)",
      tooltip:
        "May be used to make a number of attacks equal to its Limited Ammo rating before it must be reloaded with a maneuver.",
    });
  }

  if (qualities.includes("linked")) {
    tags.push({
      name: "Linked (Active)",
      tooltip:
        "May spend 2 Advantage to gain an additional hit, and may do so a number of times equal to the weapon's linked rating.",
    });
  }

  if (qualities.includes("pierce")) {
    tags.push({
      name: "Pierce (Passive)",
      tooltip: "Ignores 1 point of soak for each rank of Pierce.",
    });
  }

  if (qualities.includes("prepare")) {
    tags.push({
      name: "Prepare (Passive)",
      tooltip:
        "Requires maneuvers to prepare before use, equal to the weapon's Prepare rating.",
    });
  }

  if (qualities.includes("slow-firing")) {
    tags.push({
      name: "Slow-Firing (Passive)",
      tooltip:
        "Must wait a number of rounds equal to the weapon's Slow-Firing rating before firing again.",
    });
  }

  if (qualities.includes("stun")) {
    tags.push({
      name: "Stun (Active)",
      tooltip: "May spend 2 Advantage to deal strain damage instead of wounds.",
    });
  }

  if (qualities.includes("stun-damage")) {
    tags.push({
      name: "Stun Damage (Passive)",
      tooltip: "Deals strain damage instead of wounds",
    });
  }

  if (qualities.includes("sunder")) {
    tags.push({
      name: "Sunder (Active)",
      tooltip:
        "May spend 1 Advantage to damage target's weapon or armor. Can be applied multiple times to destroy a weapon with damage going from Minor, Moderate, Major, and Destroyed.",
    });
  }

  if (qualities.includes("superior")) {
    tags.push({
      name: "Superior (Passive)",
      tooltip:
        "Superior weapons generate automatic Advantage on all checks related to use, and have their base damage increased by 1. Superior armor has its encumbrance reduced by one and its soak value increased by one.",
    });
  }

  if (qualities.includes("tractor")) {
    tags.push({
      name: "Tractor (Passive)",
      tooltip:
        "Once the weapon hits its target, the target may not move unless its pilot makes a successful Piloting check with a difficulty based on the tractor beam's rating.",
    });
  }

  if (qualities.includes("vicious")) {
    tags.push({
      name: "Vicious (Passive)",
      tooltip: "Add 10 * Vicious rating to critical injury results.",
    });
  }

  return tags;
}

function getAllStarWarsSkills() {
  const skills = [
    { name: "Astrogation", stat: "intellect", group: "General" },
    { name: "Athletics", stat: "brawn", group: "General" },
    { name: "Brawl", stat: "brawn", group: "Combat" },
    { name: "Charm", stat: "presence", group: "General" },
    { name: "Coercion", stat: "willpower", group: "General" },
    { name: "Computers", stat: "intellect", group: "General" },
    { name: "Cool", stat: "presence", group: "General" },
    { name: "Coordination", stat: "agility", group: "General" },
    { name: "Core Worlds", stat: "intellect", group: "Knowledge" },
    { name: "Deception", stat: "cunning", group: "General" },
    { name: "Discipline", stat: "willpower", group: "General" },
    { name: "Education", stat: "intellect", group: "Knowledge" },
    { name: "Gunnery", stat: "agility", group: "Combat" },
    { name: "Leadership", stat: "presence", group: "General" },
    { name: "Lightsaber", stat: "brawn", group: "Combat" },
    { name: "Lore", stat: "intellect", group: "Knowledge" },
    { name: "Mechanics", stat: "intellect", group: "General" },
    { name: "Medicine", stat: "intellect", group: "General" },
    { name: "Melee", stat: "brawn", group: "Combat" },
    { name: "Negotiation", stat: "presence", group: "General" },
    { name: "Outer Rim", stat: "intellect", group: "Knowledge" },
    { name: "Perception", stat: "cunning", group: "General" },
    { name: "Piloting (Planetary)", stat: "agility", group: "General" },
    { name: "Piloting (Space)", stat: "agility", group: "General" },
    { name: "Ranged (Heavy)", stat: "agility", group: "Combat" },
    { name: "Ranged (Light)", stat: "agility", group: "Combat" },
    { name: "Resilience", stat: "brawn", group: "General" },
    { name: "Skulduggery", stat: "cunning", group: "General" },
    { name: "Stealth", stat: "agility", group: "General" },
    { name: "Streetwise", stat: "cunning", group: "General" },
    { name: "Survival", stat: "cunning", group: "General" },
    { name: "Underworld", stat: "intellect", group: "Knowledge" },
    { name: "Vigilance", stat: "willpower", group: "General" },
    { name: "Xenology", stat: "intellect", group: "Knowledge" },
  ];

  return skills;
}

function initializeSkills(record) {
  const existingSkills = record?.data?.skills || [];

  // Only initialize if no skills exist
  if (existingSkills.length === 0) {
    const allSkills = getAllStarWarsSkills();

    // Create array of all skill objects
    const skillObjects = allSkills.map((skill) => ({
      _id: generateUuid(),
      name: skill.name,
      unidentifiedName: skill.name,
      recordType: "skill",
      identified: true,
      icon: "IconTools",
      data: {
        group: skill.group,
        stat: skill.stat,
      },
    }));

    // Set all skills at once
    api.setValues({
      "data.skills": skillObjects,
    });
  }
}

function getBestArmor(record) {
  const inventory = record?.data?.inventory || [];
  const equippedArmor = inventory.filter(
    (item) => item.data?.carried === "equipped" && item.data?.type === "armor"
  );

  if (equippedArmor.length === 0) {
    return {
      defense: 0,
      soakBonus: 0,
      armor: null,
    };
  }

  // Find the armor with the highest defense value
  let bestArmor = equippedArmor[0];
  let bestScore =
    (bestArmor.data?.defense || 0) * 2 + (bestArmor.data?.soakBonus || 0);

  for (const armor of equippedArmor) {
    const defense = armor.data?.defense || 0;
    const soakBonus = armor.data?.soakBonus || 0;
    const score = defense * 2 + soakBonus; // Defense is worth 2x soak

    if (score > bestScore) {
      bestScore = score;
      bestArmor = armor;
    }
  }

  return {
    defense: bestArmor.data?.defense || 0,
    soakBonus: bestArmor.data?.soakBonus || 0,
    armor: bestArmor,
  };
}

function recalculateThresholds(record, moreValuesToSet = undefined) {
  const valuesToSet = moreValuesToSet || {};

  // Get mods for soakBonus, soakPenalty, woundThresholdBonus, strainThresholdBonus
  const soakBonuses = getEffectsAndModifiersForToken(record, ["soakBonus"]);
  const soakPenalties = getEffectsAndModifiersForToken(record, ["soakPenalty"]);
  // Bonuses for defense, ranged defense, and melee defense
  const defenseBonuses = getEffectsAndModifiersForToken(record, [
    "defenseBonus",
  ]);
  const defensePenalties = getEffectsAndModifiersForToken(record, [
    "defensePenalty",
    "all",
  ]);
  const rangedDefenseBonuses = getEffectsAndModifiersForToken(record, [
    "defenseBonus",
    "ranged",
  ]);
  const rangedDefensePenalties = getEffectsAndModifiersForToken(record, [
    "defensePenalty",
    "ranged",
  ]);
  const meleeDefenseBonuses = getEffectsAndModifiersForToken(record, [
    "defenseBonus",
    "melee",
  ]);
  const meleeDefensePenalties = getEffectsAndModifiersForToken(record, [
    "defensePenalty",
    "melee",
  ]);

  const woundThresholdBonuses = getEffectsAndModifiersForToken(record, [
    "woundThresholdBonus",
  ]);
  const strainThresholdBonuses = getEffectsAndModifiersForToken(record, [
    "strainThresholdBonus",
  ]);

  // Get species data
  const species = record?.data?.species?.[0];
  const speciesWoundThreshold = species?.data?.woundThreshold || 10;
  const speciesStrainThreshold = species?.data?.strainThreshold || 10;

  // Get current attribute values
  let brawn = parseInt(record?.data?.brawn || "0", 10);
  if (moreValuesToSet["data.brawn"]) {
    brawn = moreValuesToSet["data.brawn"];
  }
  const willpower = parseInt(record?.data?.willpower || "0", 10);

  // Calculate base thresholds (species + attribute)
  const baseWoundThreshold = speciesWoundThreshold + brawn;
  const baseStrainThreshold = speciesStrainThreshold + willpower;

  // Calculate total bonus values from current effects
  const totalWoundBonus = woundThresholdBonuses.reduce(
    (sum, bonus) => sum + bonus.value,
    0
  );
  const totalStrainBonus = strainThresholdBonuses.reduce(
    (sum, bonus) => sum + bonus.value,
    0
  );

  // Get previously stored bonus values
  const previousWoundBonus = parseInt(
    record?.data?.woundThresholdBonus || "0",
    10
  );
  const previousStrainBonus = parseInt(
    record?.data?.strainThresholdBonus || "0",
    10
  );

  // Calculate the difference in bonuses
  const woundBonusDifference = totalWoundBonus - previousWoundBonus;
  const strainBonusDifference = totalStrainBonus - previousStrainBonus;

  // Set the new threshold values
  // Only set base threshold if it's undefined (first time)
  if (record?.data?.woundThreshold === undefined) {
    valuesToSet["data.woundThreshold"] = baseWoundThreshold;
  } else {
    // Add the difference in bonuses to the current threshold
    valuesToSet["data.woundThreshold"] =
      parseInt(record?.data?.woundThreshold || "0", 10) + woundBonusDifference;
  }

  if (record?.data?.strainThreshold === undefined) {
    valuesToSet["data.strainThreshold"] = baseStrainThreshold;
  } else {
    // Add the difference in bonuses to the current threshold
    valuesToSet["data.strainThreshold"] =
      parseInt(record?.data?.strainThreshold || "0", 10) +
      strainBonusDifference;
  }

  // Store the current bonus values for future reference
  valuesToSet["data.woundThresholdBonus"] = totalWoundBonus;
  valuesToSet["data.strainThresholdBonus"] = totalStrainBonus;

  // Recalculate soak value
  const bestArmor = getBestArmor(record);
  valuesToSet["data.soakValue"] = brawn + bestArmor.soakBonus;
  soakBonuses.forEach((bonus) => {
    valuesToSet["data.soakValue"] += bonus.value;
  });
  soakPenalties.forEach((penalty) => {
    valuesToSet["data.soakValue"] -= penalty.value;
  });

  // Set defense values to the best armor's defense
  valuesToSet["data.defenseRanged"] = bestArmor.defense;
  valuesToSet["data.defenseMelee"] = bestArmor.defense;
  defenseBonuses.forEach((bonus) => {
    valuesToSet["data.defenseRanged"] += bonus.value;
    valuesToSet["data.defenseMelee"] += bonus.value;
  });
  defensePenalties.forEach((penalty) => {
    valuesToSet["data.defenseRanged"] -= penalty.value;
    valuesToSet["data.defenseMelee"] -= penalty.value;
  });
  rangedDefenseBonuses.forEach((bonus) => {
    valuesToSet["data.defenseRanged"] += bonus.value;
  });
  rangedDefensePenalties.forEach((penalty) => {
    valuesToSet["data.defenseRanged"] -= penalty.value;
  });
  meleeDefenseBonuses.forEach((bonus) => {
    valuesToSet["data.defenseMelee"] += bonus.value;
  });
  meleeDefensePenalties.forEach((penalty) => {
    valuesToSet["data.defenseMelee"] -= penalty.value;
  });

  // Calculate remaining wounds and strain
  const currentWounds = parseInt(record?.data?.wounds || "0", 10);
  const currentStrain = parseInt(record?.data?.strain || "0", 10);
  valuesToSet["data.woundsRemaining"] = Math.max(
    0,
    valuesToSet["data.woundThreshold"] - currentWounds
  );
  valuesToSet["data.strainRemaining"] = Math.max(
    0,
    valuesToSet["data.strainThreshold"] - currentStrain
  );

  // If moreValuesToSet was passed, merge the values instead of setting them
  if (moreValuesToSet) {
    Object.keys(valuesToSet).forEach((key) => {
      moreValuesToSet[key] = valuesToSet[key];
    });
  } else {
    // Set the values directly
    api.setValues(valuesToSet);
  }
}

function rollCheck(attribute) {
  const characteristicValue = parseInt(record?.data?.[attribute] || "0", 10);

  const metadata = {
    rollName: `${capitalize(attribute)}`,
    tooltip: `${capitalize(attribute)} Ability Check Roll`,
    characteristic: characteristicValue,
  };

  const modifiers = getEffectsAndModifiersForToken(
    record,
    ["abilityBonus"],
    attribute
  );

  // Star Wars RPG narrative dice system
  api.promptRoll(
    `${capitalize(attribute)} Check`,
    `${characteristicValue}ability`,
    modifiers,
    metadata,
    "ability"
  );
}

function rollSkill(
  record,
  skill,
  additionalMetadata = {},
  ability = undefined,
  additionalModifiers = []
) {
  const attributeValue = parseInt(
    record?.data?.[skill.data?.stat || "brawn"] || "0",
    10
  );
  const skillRank = parseInt(skill.data?.rank || "0", 10);

  // Star Wars RPG skill dice mechanics:
  // Start with Ability dice equal to the characteristic
  // Upgrade dice equal to skill rank from Ability to Proficiency
  // If skill rank > characteristic, add extra Ability dice

  let abilityDice = attributeValue;
  let proficiencyDice = 0;

  if (skillRank > 0) {
    const upgrades = Math.min(skillRank, attributeValue);
    proficiencyDice = upgrades;
    abilityDice =
      Math.max(0, abilityDice - upgrades) +
      Math.max(0, skillRank - attributeValue);
  }

  // Build the dice string
  let diceString = "";
  if (abilityDice > 0) {
    diceString += `${abilityDice}ability`;
  }
  if (proficiencyDice > 0) {
    if (diceString) diceString += " ";
    diceString += `${proficiencyDice}proficiency`;
  }

  // Fallback if no dice (shouldn't happen normally)
  if (!diceString) {
    diceString = "1ability";
  }

  // If difficulty, add it to the dice string
  if (additionalMetadata.difficulty) {
    let difficultyDice = 1;
    if (additionalMetadata.difficulty === "Easy") {
      difficultyDice = 1;
    } else if (additionalMetadata.difficulty === "Average") {
      difficultyDice = 2;
    } else if (additionalMetadata.difficulty === "Hard") {
      difficultyDice = 3;
    } else if (additionalMetadata.difficulty === "Daunting") {
      difficultyDice = 4;
    } else if (additionalMetadata.difficulty === "Formidable") {
      difficultyDice = 5;
    }
    diceString += ` ${difficultyDice}difficulty`;
  }

  const metadata = {
    rollName: `${skill.name}`,
    rollType: "skill",
    tooltip: `${skill.name} Skill Check Roll`,
    characteristic: attributeValue,
    skillRank: skillRank,
    attributeName: skill.data?.stat || "Brawn",
    ...additionalMetadata,
  };

  // Get modifiers for skills and the ability if provided
  const modifiers = getEffectsAndModifiersForToken(
    record,
    ["skillBonus"],
    skill.name,
    undefined,
    undefined,
    undefined,
    undefined,
    ability
  );

  // Add additional modifiers if provided
  if (additionalModifiers) {
    modifiers.push(...additionalModifiers);
  }

  // Star Wars RPG narrative dice system
  api.promptRoll(
    `${skill.name} Check`,
    diceString,
    modifiers,
    metadata,
    metadata.rollType
  );
}

function rollInitiative(record) {
  const initiativeSkill = record?.data?.initiativeSkill || "Vigilance";

  // Get the spell by path to ensure most up-to-date value
  const skills = record?.data?.skills || [];
  const skill = skills.find((skill) => skill.name === initiativeSkill);

  if (!skill) {
    api.showNotification(
      `No skill found for ${initiativeSkill}. Please add the Skills in their sheet.`,
      "red",
      "Skill Not Found"
    );
    return;
  }

  const modifiers = getEffectsAndModifiersForToken(
    record,
    ["initiativeBonus"],
    skill.name
  );

  rollSkill(
    record,
    skill,
    {
      rollName: "Initiative",
      tooltip: `Initiative Roll with ${record?.data?.initiativeSkill}`,
      rollType: "initiative",
      characteristic: initiativeSkill,
    },
    undefined,
    modifiers
  );
}

function useAbility(record, ability) {
  const abilityName = ability.name;
  const portrait = ability.portrait;
  const description = ability.data?.description || "";

  const skillRoll = ability.data?.skill || "";
  const difficulty = ability.data?.difficulty || "";

  const itemIcon = portrait
    ? `![${abilityName}](${assetUrl}${portrait}?width=40&height=40) `
    : "";
  const abilityDescription = api.richTextToMarkdown(description || "");

  // For abilitiies that don't have a primary skill, we use the ability name as the header
  // and output the description with the icon
  let abilityText = `
#### ${itemIcon}${abilityName}

---
${abilityDescription}
`;

  let type =
    ability.recordType === "signature_abilities"
      ? "Signature Ability"
      : "Force Power";
  if (ability.recordType === "talents") {
    type = "Active Talent";
  }

  const tags = [
    {
      name: type,
      tooltip: `${type}: ${abilityName}`,
    },
  ];

  if (type === "Force Power" || type === "Signature Ability") {
    // Add details on upgrades to the description
    const upgrades = ability.data?.talents || [];
    let upgradesText = upgrades
      .map(
        (upgrade) =>
          `- ${upgrade.name}${
            upgrade.data?.rank && upgrade.data?.rank > 1
              ? ` (${upgrade.data?.rank})`
              : ""
          }`
      )
      .join("\n");

    if (upgradesText) {
      abilityText += `\n\nUpgrades:\n${upgradesText}`;
    }
  }

  api.sendMessage(abilityText, undefined, [], tags);

  // If skillRoll, roll
  if (skillRoll) {
    const skills = record?.data?.skills || [];
    const skill = skills.find((skill) => skill.name === skillRoll);

    if (!skill) {
      api.showNotification(
        `No skill found for ${skillRoll}. Please add the Skills in their sheet.`,
        "red",
        "Skill Not Found"
      );
      return;
    }

    rollSkill(
      record,
      skill,
      {
        difficulty: difficulty,
      },
      ability
    );
  }

  // Check for forcePowerBonus mods
  const forcePowerBonuses = getEffectsAndModifiersForToken(
    record,
    ["forcePowerBonus"],
    ability.name
  );

  // If forcePower, roll force power
  if (type === "Force Power") {
    // Get the number of remaining force dice (total -committed)
    const totalForceDice = record?.data?.remainingForce || 0;
    if (totalForceDice <= 0) {
      api.showNotification(
        `No force dice are available to use this power.`,
        "red",
        "No Force Dice"
      );
    } else {
      api.promptRoll(
        `${ability.name} Force Power Roll`,
        `${totalForceDice} force`,
        forcePowerBonuses,
        {
          tooltip: `Force Power Roll for ${ability.name}`,
          rollName: `Force Power`,
        },
        "force"
      );
    }
  }
}

function getResultFromTable(table, total) {
  if (
    !table ||
    !table.rows ||
    !Array.isArray(table.rows) ||
    table.rows.length === 0
  ) {
    return null;
  }

  // Find the row where the total falls between minValue and maxValue (inclusive)
  const matchingRow = table.rows.find(
    (row) => total >= row.minValue && total <= row.maxValue
  );

  return matchingRow || null;
}

// Add a condition to a record and set all effects
function addConditionToRecord(record, recordLink) {
  const conditionObj = {
    ...recordLink.value,
  };

  const recordType = record.recordType;
  const recordId =
    record.recordType === "characters" && record.recordId
      ? record.recordId
      : record._id;

  // After adding the condition, add the effects to the character sequentially
  const addEffects = (updatedRecord) => {
    // First update attributes based on modifiers
    const valuesToSet = {};
    updateAttributes(
      // Merge updates with the original record
      updatedRecord,
      valuesToSet
    );

    const token =
      record.linked !== undefined
        ? record
        : api.getSelectedOrDroppedToken()?.[0];

    if (Object.keys(valuesToSet).length > 0) {
      api.setValuesOnRecord(updatedRecord, valuesToSet);
    }

    const effects = conditionObj.data?.effects || [];

    // Process effects sequentially using a recursive approach
    function processEffectsSequentially(effects, index) {
      // Base case: all effects processed
      if (index >= effects.length) return;

      // Re-query the record to get the latest data before each effect is processed
      api.getRecord(recordType, recordId, (recordUpdated) => {
        // Process current effect
        const effect = effects[index];
        const effectObj = JSON.parse(effect);

        // Add the effect and wait for completion before processing the next one
        api.addEffectById(
          effectObj._id,
          recordUpdated,
          undefined,
          undefined,
          () => {
            // Process next effect (only after current addition is complete)
            processEffectsSequentially(effects, index + 1);
          }
        );
      });
    }

    // Start processing from the first effect
    if (effects.length > 0) {
      processEffectsSequentially(effects, 0);
    }
  };

  api.addValuesToRecord(
    record,
    "data.criticalInjuries",
    [conditionObj],
    addEffects
  );
}

function onConditionChange(record, deletedItem) {
  if (!deletedItem) return;
  // Requery the record to get the latest record
  api.getRecord(record.recordType, record._id, (actualRecord) => {
    const deletedEffects = deletedItem.data?.effects || [];
    const recordId = record._id;

    // Update attributes based on modifiers
    // First update attributes based on modifiers
    const valuesToSet = {};
    // Update attributes as per modifiers
    updateAttributes(actualRecord, valuesToSet);

    if (Object.keys(valuesToSet).length > 0) {
      api.setValues(valuesToSet);
    }

    // Process effects sequentially using a recursive approach
    function processEffectsSequentially(effects, index) {
      // Base case: all effects processed
      if (index >= effects.length) return;

      // Re-query the record to get the latest data
      api.getRecord(record.recordType, recordId, (recordUpdated) => {
        // Process current effect
        const effect = effects[index];
        const effectObj = JSON.parse(effect);

        // Remove the effect and wait for completion before processing the next one
        api.removeEffectById(effectObj._id, recordUpdated, () => {
          // Process next effect (only after current removal is complete)
          processEffectsSequentially(effects, index + 1);
        });
      });
    }

    // Start processing from the first effect
    if (deletedEffects.length > 0) {
      processEffectsSequentially(deletedEffects, 0);
    }
  });
}

function addCondition(tokenOrRecord, recordLink) {
  // First requery to get the actual record
  const recordType = tokenOrRecord.recordType;
  const recordId =
    tokenOrRecord.recordType === "characters" && tokenOrRecord.recordId
      ? tokenOrRecord.recordId
      : tokenOrRecord._id;

  // This will get the Character record or the Token record (if NPC)
  api.getRecord(recordType, recordId, (actualRecord) => {
    addConditionToRecord(actualRecord, recordLink);
  });
}

function getRollCriticalInjuryMacro(record, target) {
  // A critical injury roll is d100 + any modifiers, and the
  // target's mods need to be applied to the result
  const increaseCriticalHitMods = getEffectsAndModifiersForToken(record, [
    "increaseCriticalHit",
  ]);
  const decreaseCriticalHitMods = target
    ? getEffectsAndModifiersForToken(target, ["decreaseCriticalHit"])
    : [];

  const modifiers = [];
  increaseCriticalHitMods.forEach((mod) => {
    modifiers.push({
      ...mod,
      value: Math.abs(mod.value),
    });
  });
  decreaseCriticalHitMods.forEach((mod) => {
    modifiers.push({
      ...mod,
      value: -Math.abs(mod.value),
    });
  });

  const modsAsString = JSON.stringify(modifiers);

  return `\`\`\`Roll_Critical_Hit
api.promptRoll("Critical Hit", "1d100", JSON.parse('${modsAsString}') , {
  rollName: "Critical Hit",
  tooltip: "Critical Hit Roll",
  isNarrative: false,
}, "criticalInjury");
\`\`\``;
}

function rollAttack() {
  // TODO
  // Get target's defense and apply as setback
  // Get target's defense modifieres and apply to roll
  // For crit macros check targets crit reducedCriticalHit mods
  // For crit macros check our increaseCriticalHit mods
  // For damage macros check our damageBonus and damagePenalty mods
}
