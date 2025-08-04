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
  // If a talent is ranked, duplicate it for each rank
  const rankedTalents = [];
  talents.forEach((talent) => {
    if (talent.data?.rank) {
      for (let i = 1; i < talent.data.rank; i++) {
        rankedTalents.push({
          ...talent,
          _id: `${talent._id}-${i + 1}`,
          name: `${talent.name} (x${i + 1})`,
        });
      }
    }
  });

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
  // If a talent is ranked, duplicate it for each rank
  abilityTalents.forEach((talent) => {
    if (talent.data?.rank) {
      for (let i = 1; i < talent.data.rank; i++) {
        rankedTalents.push({
          ...talent,
          _id: `${talent._id}-${i + 1}`,
          name: `${talent.name} (x${i + 1})`,
        });
      }
    }
  });

  // Get critical injuries
  const criticalInjuries = target?.data?.criticalInjuries || [];

  // Filter items that are not equipped
  const equippedItems = items.filter(
    (item) => item.data?.carried === "equipped"
  );
  [
    ...speciesFeatures,
    ...talents,
    ...rankedTalents,
    ...equippedItems,
    ...npcFeatures,
    ...activeAttachments,
    ...abilityTalents,
    ...criticalInjuries,
    ...(weapon ? [weapon] : []),
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
          itemId: itemOnly ? feature?.weaponId || feature?._id : undefined,
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
  skipThresholds = false,
}) {
  const valuesToSet = moreValuesToSet || {};

  // Set the attribute value
  valuesToSet[`data.${attribute}`] = value;

  // Recalculate derived attributes based on which attribute changed
  if (attribute === "brawn") {
    // Only set wound threshold if it's undefined (first time) and not an NPC
    if (record?.data?.woundThreshold === undefined) {
      const species = record?.data?.species?.[0];
      const speciesWoundThreshold = species?.data?.woundThreshold || 10;
      const woundThreshold = speciesWoundThreshold + parseInt(value || "0", 10);
      valuesToSet["data.woundThreshold"] = woundThreshold;
    }

    // Update Soak Value: brawn + armor soak, unless it's a vehicle
    if (record.data?.type !== "vehicle") {
      const armorSoak = 0;
      const soakValue = parseInt(value || "0", 10) + armorSoak;
      valuesToSet["data.soakValue"] = soakValue;
    }

    // Update wounds remaining with current threshold
    const currentWounds = parseInt(record?.data?.wounds || "0", 10);
    const woundThreshold = parseInt(record?.data?.woundThreshold || "0", 10);
    valuesToSet["data.woundsRemaining"] = Math.max(
      0,
      woundThreshold - currentWounds
    );

    // Characters have an "encumbrance threshold" of 5 plus
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

  if (attribute === "woundThreshold") {
    // Update wounds remaining: threshold - wounds
    const woundThreshold = parseInt(value || "0", 10);
    const woundsRemaining = Math.max(
      0,
      woundThreshold - parseInt(record?.data?.wounds || "0", 10)
    );
    valuesToSet["data.woundsRemaining"] = woundsRemaining;
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

  if (attribute === "strainThreshold") {
    // Update wounds remaining: threshold - wounds
    const strainThreshold = parseInt(value || "0", 10);
    const strainRemaining = Math.max(
      0,
      strainThreshold - parseInt(record?.data?.strain || "0", 10)
    );
    valuesToSet["data.strainRemaining"] = strainRemaining;
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

  // Recalculate thresholds
  if (!skipThresholds) {
    recalculateThresholds(record, valuesToSet);
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

function setTotalEncumbrance(record, valuesToSet) {
  const inventory = record?.data?.inventory || [];
  const encumbrance = inventory.reduce((acc, item) => {
    // Skip dropped items
    if (item.data?.carried === "dropped") {
      return acc;
    }

    let itemEncumbrance = item.data?.encumbrance || 0;

    // Check for armor qualities that modify encumbrance
    if (item.data?.type === "armor" && item.data?.special) {
      const qualities = Array.isArray(item.data.special)
        ? item.data.special
        : [item.data.special];

      qualities.forEach((quality) => {
        if (quality === "inferior") {
          itemEncumbrance += 1;
        } else if (quality === "superior") {
          itemEncumbrance -= 1;
        }
      });
    }

    return (
      acc +
      itemEncumbrance *
        (item.data?.count === undefined || item.data?.count === null
          ? 1
          : item.data?.count)
    );
  }, 0);

  if (valuesToSet) {
    valuesToSet["data.encumbrance"] = encumbrance;
  } else {
    api.setValues({
      "data.encumbrance": encumbrance,
    });
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
      // Skip because we do it at the end
      skipThresholds: true,
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
    // Skip because we do it at the end
    skipThresholds: true,
  });

  updateAttribute({
    record,
    attribute: "strain",
    value: currentStrain,
    moreValuesToSet: valuesToSet,
    // Skip because we do it at the end
    skipThresholds: true,
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

function getTagsForQualities(weapon) {
  const tags = [];

  const qualities = weapon?.data?.special || [];

  if (qualities.includes("accurate")) {
    tags.push({
      name: `Accurate (Passive) [${weapon.data?.accurate || 0}]`,
      tooltip:
        "Add Boost die for each level of this trait to combat checks with this weapon",
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
      name: `Breach (Passive) [${weapon.data?.breach || 0}]`,
      tooltip:
        "Ignores 1 point of armor per rank of Breach (meaning they also ignore 10 points of soak for every rating of Breach)",
    });
  }

  if (qualities.includes("burn")) {
    tags.push({
      name: `Burn (Active) [${weapon.data?.burn || 0}]`,
      tooltip:
        "If the attack is successful, can spend 2 Advantage to set target on fire. The target continues to suffer the weapon's base damage for a number of rounds equal to the weapon's Burn rating. Damage is applied at the start of each of the target's actions. A victim can attempt a Coordination check to stop the burn, or jump in water.",
    });
  }

  if (qualities.includes("blast")) {
    tags.push({
      name: `Blast (Active) [${weapon.data?.blast || 0}]`,
      tooltip:
        "If the attack is successful, can spend 2 Advantage to activate Blast. Each character (friend or foe) Engaged with the original target suffers wounds equal to the weapon's Blast rating (plus an additional wound per Success as usual). The user may also trigger Blast if the attack misses, by spending 3 Advantage. In this case, the original target and every target engaged with the original target suffers damage equal to the Blast rating of the weapon.",
    });
  }

  if (qualities.includes("concussive")) {
    tags.push({
      name: `Concussive (Active) [${weapon.data?.concussive || 0}]`,
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
      name: `Cumbersome (Passive) [${weapon.data?.cumbersome || 0}]`,
      tooltip:
        "To wield a Cumbersome weapon properly, the character needs a Brawn characteristic equal to or greater than the weapon's Cumbersome rating. For each point of Brawn the character is deficient, he must increase the difficulty of all checks made while using the weapon by one.",
    });
  }

  if (qualities.includes("defensive")) {
    tags.push({
      name: `Defensive (Passive) [${weapon.data?.defensive || 0}]`,
      tooltip:
        "A character wielding a weapon with the Defensive quality increases his melee defense by the weapon's Defensive rating.",
    });
  }

  if (qualities.includes("deflection")) {
    tags.push({
      name: `Deflection (Passive) [${weapon.data?.deflection || 0}]`,
      tooltip:
        "An item with the Deflection quality increases the wearer's ranged defense equal to its Deflection rating.",
    });
  }

  if (qualities.includes("disorient")) {
    tags.push({
      name: `Disorient (Active) [${weapon.data?.disorient || 0}]`,
      tooltip:
        "May spend 2 Advantage to disorient target for a number of rounds equal to the weapon's Disorient rating. A disoriented target adds 1 Setback die to all skill checks he performs.",
    });
  }

  if (qualities.includes("ensnare")) {
    tags.push({
      name: `Ensnare (Active) [${weapon.data?.ensnare || 0}]`,
      tooltip:
        "May spend 2 Advantage to immobilize target for a number of rounds equal to the weapon's Ensnare rating. An immobilized target cannot perform maneuvers. An Ensnared target may attempt a Hard Athletics check as his action on his turn to break free from the effect.",
    });
  }

  if (qualities.includes("guided")) {
    tags.push({
      name: `Guided (Active) [${weapon.data?.guided || 0}]`,
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
      name: `Inaccurate (Passive) [${weapon.data?.inaccurate || 0}]`,
      tooltip:
        "Add Setback die equal to the weapon's Inaccurate rating to combat checks with this weapon.",
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
      name: `Limited Ammo (Passive) [${weapon.data?.limitedAmmo || 0}]`,
      tooltip:
        "May be used to make a number of attacks equal to its Limited Ammo rating before it must be reloaded with a maneuver.",
    });
  }

  if (qualities.includes("linked")) {
    tags.push({
      name: `Linked (Active) [${weapon.data?.linked || 0}]`,
      tooltip:
        "May spend 2 Advantage to gain an additional hit, and may do so a number of times equal to the weapon's linked rating.",
    });
  }

  if (qualities.includes("pierce")) {
    tags.push({
      name: `Pierce (Passive) [${weapon.data?.pierce || 0}]`,
      tooltip: "Ignores 1 point of soak for each rank of Pierce.",
    });
  }

  if (qualities.includes("prepare")) {
    tags.push({
      name: `Prepare (Passive) [${weapon.data?.prepare || 0}]`,
      tooltip:
        "Requires maneuvers to prepare before use, equal to the weapon's Prepare rating.",
    });
  }

  if (qualities.includes("slow-firing")) {
    tags.push({
      name: `Slow-Firing (Passive) [${weapon.data?.slowFiring || 0}]`,
      tooltip:
        "Must wait a number of rounds equal to the weapon's Slow-Firing rating before firing again.",
    });
  }

  if (qualities.includes("stun")) {
    tags.push({
      name: `Stun (Active) [${weapon.data?.stun || 0}]`,
      tooltip:
        "May spend 2 Advantage to deal direct strain damage equal to the weapon's Stun rating.",
    });
  }

  if (qualities.includes("stun-damage")) {
    tags.push({
      name: "Stun Damage (Passive)",
      tooltip: "Deals strain damage instead of wounds",
    });
  }

  if (qualities.includes("stun-setting")) {
    tags.push({
      name: "Stun Setting",
      tooltip:
        "If firing on the stun setting, the max range is Short, and damage is done to strain.",
    });
  }

  if (qualities.includes("stun-damage-droid")) {
    tags.push({
      name: "Stun Damage (Passive, Droid only)",
      tooltip:
        "Deals strain damage instead of wounds and only applies to droids.",
    });
  }

  if (qualities.includes("unarmed")) {
    tags.push({
      name: "Unarmed",
      tooltip:
        "Unarmed attacks use the Brawl skill and Brawn for base damage. Damage can be done to strain instead of wounds.",
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

  const addUnarmedIfNeeded = () => {
    // Add Unarmed attack if not present
    const unarmedAttack = record?.data?.unarmedAttack;
    if (unarmedAttack === undefined) {
      // When making an unarmed combat check using
      // Brawl, the character's attack has a base damage of
      // his Brawn rating, a range of engaged, a Critical Rating
      // of 5, and the Disorient 1 and Knockdown qualities.
      // Finally,
      const attack = {
        _id: generateUuid(),
        portrait: "/images/bc390eaa-d17a-4022-a1ca-fa388c12e498_29.webp",
        name: "Unarmed Combat",
        unidentifiedName: "Unarmed Combat",
        recordType: "items",
        identified: true,
        icon: "IconBox",
        data: {
          damage: 0,
          crit: 5,
          carried: "equipped",
          type: "melee weapon",
          range: "Engaged",
          skill: "Brawl",
          weaponSkill: "Brawl",
          range: "Engaged",
          special: ["unarmed", "disorient", "knockdown"],
          disorient: 1,
          description:
            "Unarmed attacks use the Brawl skill and Brawn for base damage. Damage can be done to strain instead of wounds.",
        },
      };
      api.addValue("data.unarmedAttack", attack);
    }
  };

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
    api.setValues(
      {
        "data.skills": skillObjects,
      },
      addUnarmedIfNeeded
    );
  } else {
    addUnarmedIfNeeded();
  }
}

// Gets the defense value of an armor item
// considering the qualities of the armor
function getArmorDefense(armor) {
  let defense = armor?.data?.defense || 0;
  let soakBonus = armor?.data?.soakBonus || 0;

  // Check qualities which modify these values
  const qualities = armor?.data?.special || [];
  if (qualities.includes("superior")) {
    // Superior armor increases soak by 1
    soakBonus += 1;
  }
  if (qualities.includes("inferior")) {
    // Inferior armor decreases defense by 1. If it has none,
    // decrease soak by 1.
    defense -= 1;
    if (defense < 0) {
      defense = 0;
      soakBonus -= 1;
      if (soakBonus < 0) {
        soakBonus = 0;
      }
    }
  }

  return {
    defense: defense,
    soakBonus: soakBonus,
  };
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
      meleeDefenseBonus: 0,
      rangedDefenseBonus: 0,
      armor: null,
    };
  }

  // Find the armor with the highest defense value
  let bestArmor = equippedArmor[0];
  let bestScore =
    (bestArmor.data?.defense || 0) * 2 + (bestArmor.data?.soakBonus || 0);

  for (const armor of equippedArmor) {
    const { defense, soakBonus } = getArmorDefense(armor);

    // Defense is worth 2x soak in our determination of which is best
    const score = defense * 2 + soakBonus;

    if (score > bestScore) {
      bestScore = score;
      bestArmor = armor;
    }
  }

  // Get any items with the defense related qualities equipped
  let meleeDefenseBonus = 0;
  let rangedDefenseBonus = 0;
  const itemsEquipped = record?.data?.inventory?.filter(
    (item) =>
      item.data?.carried === "equipped" &&
      (item.data?.type === "melee weapon" ||
        item.data?.type === "ranged weapon" ||
        item.data?.type === "armor")
  );
  itemsEquipped.forEach((item) => {
    const qualities = item.data?.special || [];
    if (qualities.includes("defensive")) {
      meleeDefenseBonus += item.data?.defensive || 0;
    }
    if (qualities.includes("deflection")) {
      rangedDefenseBonus += item.data?.deflection || 0;
    }
  });

  return {
    defense: getArmorDefense(bestArmor).defense,
    soakBonus: getArmorDefense(bestArmor).soakBonus,
    meleeDefenseBonus: meleeDefenseBonus,
    rangedDefenseBonus: rangedDefenseBonus,
    armor: bestArmor,
  };
}

// Recalculates the thresholds for a character or NPC and other derived
// values based on the current effects and modifiers, equipments, etc.
function recalculateThresholds(record, moreValuesToSet = undefined) {
  const valuesToSet = { ...(moreValuesToSet || {}) };

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
  const meleeDefenseBonus = bestArmor.meleeDefenseBonus;
  const rangedDefenseBonus = bestArmor.rangedDefenseBonus;

  // Update soak and defense values for non-vehicles
  if (record.data?.type !== "vehicle") {
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
    valuesToSet["data.defenseRanged"] += rangedDefenseBonus;
    meleeDefensePenalties.forEach((penalty) => {
      valuesToSet["data.defenseMelee"] -= penalty.value;
    });
    valuesToSet["data.defenseMelee"] += meleeDefenseBonus;
  }

  // Calculate remaining wounds and strain
  const currentWounds = parseInt(record?.data?.wounds || "0", 10);
  const currentStrain = parseInt(record?.data?.strain || "0", 10);

  // Only calculate woundsRemaining if it hasn't been set in valuesToSet
  if (valuesToSet["data.woundsRemaining"] === undefined) {
    valuesToSet["data.woundsRemaining"] = Math.max(
      0,
      valuesToSet["data.woundThreshold"] - currentWounds
    );
  }

  // Only calculate strainRemaining if it hasn't been set in valuesToSet
  if (valuesToSet["data.strainRemaining"] === undefined) {
    valuesToSet["data.strainRemaining"] = Math.max(
      0,
      valuesToSet["data.strainThreshold"] - currentStrain
    );
  }

  const isNPC = record?.recordType !== "characters";
  const isMinion =
    isNPC && (!record?.data?.type || record?.data?.type === "minion");
  // If this is a minion, recalculate skill ranks
  if (isMinion) {
    const skills = record?.data?.skills || [];
    // A minion group gains one skill rank for each member of the group beyond the first
    skills.forEach((skill, index) => {
      if (skill.data?.careerOrMinionSkill) {
        // They have this skill, so we need to set the rank equal to
        // number of remaining minions - 1
        const woundsPerMinion = parseInt(
          record?.data?.woundsPerMinion || "0",
          10
        );
        const totalWounds = parseInt(
          valuesToSet["data.wounds"] !== undefined
            ? valuesToSet["data.wounds"]
            : record?.data?.wounds || "0",
          10
        );
        const woundThreshold = parseInt(
          valuesToSet["data.woundThreshold"] !== undefined
            ? valuesToSet["data.woundThreshold"]
            : record?.data?.woundThreshold || "0",
          10
        );
        const minionsDefeated = Math.max(
          0,
          Math.floor((totalWounds - 1) / woundsPerMinion)
        );
        const totalMinions = Math.ceil(woundThreshold / woundsPerMinion);
        const minionsRemaining = Math.max(0, totalMinions - minionsDefeated);
        const rank = Math.max(0, minionsRemaining - 1);
        // Only set if changed
        if (skills[index].data?.rank !== rank) {
          valuesToSet[`data.skills.${index}.data.rank`] = rank;
        }
      } else {
        if (skills[index].data?.rank !== 0) {
          valuesToSet[`data.skills.${index}.data.rank`] = 0;
        }
      }
    });
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

  const totalEncumbrance = record?.data?.encumbrance || 0;
  const encumbranceThreshold = record?.data?.encumbranceThreshold || 0;
  const encumbrancePenalty = totalEncumbrance - encumbranceThreshold;
  const isBrawnOrAgility = attribute === "brawn" || attribute === "agility";
  if (encumbrancePenalty > 0 && isBrawnOrAgility) {
    modifiers.push({
      name: "Encumbrance Penalty",
      value: `${encumbrancePenalty} setback`,
      type: "string",
      active: true,
    });
  }

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

  let abilityOverride = undefined;
  if (additionalMetadata.abilityOverride) {
    abilityOverride = additionalMetadata.abilityOverride;
  }

  const skillRank =
    abilityOverride === undefined ? parseInt(skill.data?.rank || "0", 10) : 0;

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

  if (abilityOverride) {
    abilityDice = abilityOverride;
  }

  // Build the dice string
  let diceString = "";
  if (abilityDice > 0) {
    diceString += `${abilityDice}ability`;
  }
  if (proficiencyDice > 0) {
    if (diceString) diceString += " + ";
    diceString += `${proficiencyDice}proficiency`;
  }

  // Fallback if no dice (shouldn't happen normally)
  if (!diceString) {
    diceString = "";
  }

  // If difficulty, add it to the dice string
  if (additionalMetadata.difficulty || additionalMetadata.increaseDifficulty) {
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

    // Increase difficulty dice by increaseDifficulty
    const increaseDifficulty = additionalMetadata.increaseDifficulty || 0;
    if (increaseDifficulty > 0) {
      difficultyDice += increaseDifficulty;
    }

    // Handle upgrade difficulty - convert difficulty dice to challenge dice
    const upgradeDifficulty = additionalMetadata.upgradeDifficulty || 0;
    if (upgradeDifficulty > 0) {
      const challengeDice = Math.min(difficultyDice, upgradeDifficulty);
      const remainingDifficultyDice = difficultyDice - challengeDice;
      const additionalDifficultyDice = upgradeDifficulty - challengeDice;

      // Add challenge dice
      if (challengeDice > 0) {
        if (diceString) {
          diceString += ` + ${challengeDice}challenge`;
        } else {
          diceString += ` ${challengeDice}challenge`;
        }
      }
      if (remainingDifficultyDice > 0) {
        if (diceString) {
          diceString += ` + ${remainingDifficultyDice}difficulty`;
        } else {
          diceString += ` ${remainingDifficultyDice}difficulty`;
        }
      }
      if (additionalDifficultyDice > 0) {
        if (diceString) {
          diceString += ` + ${additionalDifficultyDice}difficulty`;
        } else {
          diceString += ` ${additionalDifficultyDice}difficulty`;
        }
      }
    } else {
      if (diceString) {
        diceString += ` + ${difficultyDice}difficulty`;
      } else {
        diceString += ` ${difficultyDice}difficulty`;
      }
    }
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
    ability
  );

  // Get modifiers for the stat used
  const abilityModifiers = getEffectsAndModifiersForToken(
    record,
    ["abilityBonus"],
    skill.data?.stat || "brawn"
  );

  modifiers.push(...abilityModifiers);

  // Add additional modifiers if provided
  if (additionalModifiers) {
    modifiers.push(...additionalModifiers);
  }

  // Get encumbrance penalty
  // A total encumbrance value over the threshold means the hero
  // is "encumbered," and suffers one setback to all Agility and
  // Brawn rolls for every point of encumbrance over his limit.
  // This is cumulative with any setback dice suffered for strain
  // or other conditions, should any be in play.
  const totalEncumbrance = record?.data?.encumbrance || 0;
  const encumbranceThreshold = record?.data?.encumbranceThreshold || 0;
  const encumbrancePenalty = totalEncumbrance - encumbranceThreshold;
  const isBrawnOrAgility =
    skill.data?.stat === "brawn" || skill.data?.stat === "agility";
  if (encumbrancePenalty > 0 && isBrawnOrAgility) {
    modifiers.push({
      name: "Encumbrance Penalty",
      value: `${encumbrancePenalty} setback`,
      type: "string",
      active: true,
    });
  }

  // If the skill being rolled is Piloting (Space) or Piloting (Vehicle),
  // check the handling of the active vehicle, if any, and add setback if negative,
  // boost if positive
  if (skill.name.toLowerCase().includes("piloting")) {
    const vehicleDataPath = "data.activeVehicle.0";
    const vehicle = api.getValue(vehicleDataPath);
    const handling = vehicle?.data?.handling || 0;
    if (Math.abs(handling) > 0) {
      modifiers.push({
        name: "Handling",
        value: `${Math.abs(handling)} ${handling > 0 ? "boost" : "setback"}`,
        active: true,
      });
    }
  }

  let rollName = `${skill.name} Check`;
  if (metadata.rollType === "initiative") {
    rollName = `Initiative (${skill.name}) for ${record.name}`;
  } else if (metadata.rollType === "attack") {
    rollName = `Attack with ${skill.name}`;
  }

  // Star Wars RPG narrative dice system
  api.promptRoll(rollName, diceString, modifiers, metadata, metadata.rollType);
}

function rollInitiative(record) {
  const initiativeSkill = record?.data?.initiativeSkill || "Vigilance";

  // Get the spell by path to ensure most up-to-date value
  const skills = record?.data?.skills || [];
  const skill = skills.find((skill) => skill.name === initiativeSkill);

  if (!skill) {
    api.showNotification(
      `No skill found for ${initiativeSkill}. Add the Skill to their sheet and try again.`,
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
  if (ability.recordType === "records") {
    // An NPC ability
    type = "Ability";
  }
  // If isForcePower is set, set type accordingly
  if (ability.data?.isForcePower !== undefined) {
    type = ability.data?.isForcePower ? "Force Power" : "Ability";
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
    const isVehicle = record?.data?.type === "vehicle";

    if (isVehicle) {
      api.showNotification(
        `This action requires a Skill Check. Set the vehicle as the active vehicle for a Character or NPC and roll from their sheet.`,
        "red",
        "Skill Not Found"
      );
      return;
    }

    if (!skill) {
      api.showNotification(
        `No skill found for ${skillRoll}. Add the Skill to their sheet and try again.`,
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

  // Check for animation
  const animation = ability.data?.animation;
  if (animation) {
    const ourToken = api.getToken();
    const targets = api.getTargets();
    const targetId = targets[0]?.token?._id;
    if (ourToken) {
      api.playAnimation(animation, ourToken._id, targetId);
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

  // Sort rows by minValue to ensure we get the correct min and max values
  const sortedRows = [...table.rows].sort((a, b) => a.minValue - b.minValue);

  // Validate that rows have the expected structure
  const firstRow = sortedRows[0];
  const lastRow = sortedRows[sortedRows.length - 1];

  if (
    !firstRow ||
    !lastRow ||
    typeof firstRow.minValue === "undefined" ||
    typeof lastRow.maxValue === "undefined"
  ) {
    return null;
  }

  // Get the actual min and max values from the table
  const tableMin = firstRow.minValue;
  const tableMax = lastRow.maxValue || lastRow.minValue;

  // Clamp the total to the table's valid range
  total = Math.max(tableMin, Math.min(total, tableMax));

  // Find the row where the total falls between minValue and maxValue (inclusive)
  const matchingRow = sortedRows.find(
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

    if (Object.keys(valuesToSet).length > 0) {
      api.setValuesOnRecord(updatedRecord, valuesToSet);
    }

    api.showNotification(
      `Added ${conditionObj.name} to ${record.name}`,
      "green",
      "Condition Added"
    );

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

function rollCriticalInjury(record, critType, additionalModifiers = []) {
  const rollName = `Critical ${critType === "hit" ? "Hit" : "Injury"}`;

  const criticalHitReduction = getEffectsAndModifiersForToken(record, [
    "reducedCriticalHit",
  ]);
  criticalHitReduction.forEach((mod) => {
    mod.value = -Math.abs(mod.value);
  });
  const criticalHitIncrease = [];

  const attacksTargetingYou = getEffectsAndModifiersForToken(record, [
    "increaseCriticalHitTargetingYou",
  ]);
  if (attacksTargetingYou.length > 0) {
    attacksTargetingYou.forEach((mod) => {
      mod.value = Math.abs(mod.value);
    });
  }

  // Get the number of critical hits this character or vehicle has suffered from
  const criticalHits = record.data?.criticalInjuries || [];
  if (criticalHits.length > 0) {
    criticalHitIncrease.push({
      name: "Increase from Previous Critical Hits",
      value: criticalHits.length * 10,
      active: true,
    });
  }
  const modifiers = [
    ...additionalModifiers,
    ...criticalHitReduction,
    ...criticalHitIncrease,
    ...attacksTargetingYou,
  ];

  api.promptRollForToken(
    record,
    rollName,
    "1d100",
    modifiers,
    {
      rollName: rollName,
      tooltip: `Critical ${critType === "hit" ? "Hit" : "Injury"} Roll`,
      isNarrative: false,
      critType: `${critType ? critType : "notset"}`,
    },
    "criticalInjury"
  );
}

function getRollCriticalInjuryMacro(modifiers, critType) {
  // A critical injury roll is d100 + any modifiers
  const modsAsString = JSON.stringify(modifiers);

  return `\`\`\`Roll_Critical_${critType === "hit" ? "Hit" : "Injury"}
  const rollName = "Critical ${critType === "hit" ? "Hit" : "Injury"}";
  const additionalModifiers = JSON.parse('${modsAsString}');
  // Here we get the selected token and prompt a roll for it, after we 
  // get mods on this token for reduction of a critical hit, or increase due to previous critical hits
  const selectedTokens = api.getSelectedOrDroppedToken();
  selectedTokens.forEach(token => {
    rollCriticalInjury(token, '${
      critType ? critType : "notset"
    }', additionalModifiers);
  });
  \`\`\``;
}

function rollAttack(
  record,
  weapon,
  dataPathToWeapon,
  attackType = "attack",
  scale = "personal"
) {
  const isMelee = weapon.data?.type === "melee weapon";
  let skill = weapon.data?.weaponSkill || "";
  if (skill === "") {
    skill = isMelee ? "Brawl" : "Ranged (Light)";
  }
  const weaponId = weapon._id;
  // Get attack modifiers
  const attackBonusModifiers = getEffectsAndModifiersForToken(
    record,
    ["attackBonus"],
    isMelee ? "melee" : "ranged",
    weaponId,
    undefined,
    weapon
  );

  // Find the skill in the character's skills
  const skillObj = record.data?.skills?.find((s) => s.name === skill);
  if (!skillObj) {
    api.showNotification(
      `No skill found for ${skill}. Add the Skill to their sheet and try again.`,
      "red",
      "Skill Not Found"
    );
    return;
  }

  // For each target... (if there is one)
  const targets = api.getTargets();
  const ourToken = api.getToken();
  if (targets.length < 1) {
    targets.push({ token: { noToken: true, data: {} }, distance: 0 });
  }
  const narrativeDistance = record.data?.rangeBand || "Short";
  targets.forEach((target) => {
    let ourSilhouette = record.data?.size || "Silhouette 1";
    let ourSilhouetteNumber = parseInt(ourSilhouette.split(" ")[1], 10);
    const token = target?.token;
    let targetSilhouette = token?.data?.size || "Silhouette 1";
    let targetSilhouetteNumber = parseInt(targetSilhouette.split(" ")[1], 10);

    // Check if we're making a planetary attack and the record is not a vehicle
    // which is likely the case because vehicle attacks are made from non-vehicle NPCs and Characters
    if (scale === "planetary" && record.data?.type !== "vehicle") {
      // If we're making a planetary attack, we use the vehicle's silhouette
      const vehicleDataPath = getNearestParentDataPath(dataPathToWeapon);
      const vehicle = api.getValue(vehicleDataPath);
      ourSilhouette = vehicle.data?.size || "Silhouette 1";
      ourSilhouetteNumber = parseInt(ourSilhouette.split(" ")[1], 10);
      // If target is not defined, assume silhouette is the same so we have an Avg difficulty
      if (!token?.data?.size) {
        targetSilhouette = ourSilhouette;
        targetSilhouetteNumber = ourSilhouetteNumber;
      }
    }

    // Check for difficultyIncrease modifiers
    let difficultyIncrease = 0;

    // Default difficulty to Easy (Engaged | Short)
    let difficulty = "Easy";
    // Ranged difficulty is based on the range band
    // Distance is used for base difficulty on personal scale
    if (scale === "personal") {
      if (narrativeDistance === "Engaged") {
        difficulty = "Easy";
        // Add modifiers if engaged w/ specific skills
        if (skillObj.name === "Ranged (Light)") {
          difficultyIncrease += 1;
        } else if (skillObj.name === "Ranged (Heavy)") {
          difficultyIncrease += 2;
        } else if (skillObj.name === "Gunnery") {
          // Technically impossible - show error
          api.showNotification(
            "Gunnery is impossible to use when Engaged with a target.",
            "red",
            "Impossible Roll"
          );
          return;
        }
      } else if (narrativeDistance === "Short") {
        difficulty = "Easy";
      } else if (narrativeDistance === "Medium") {
        difficulty = "Average";
      } else if (narrativeDistance === "Long") {
        difficulty = "Hard";
      } else if (narrativeDistance === "Extreme") {
        difficulty = "Daunting";
      }
    } else {
      // In planetary scale, difficulty is dependent on silhouette of target
      // vs our silhouette according to Table 7-4: Silhouette Comparison
      const silhouetteDifference = ourSilhouetteNumber - targetSilhouetteNumber;

      if (silhouetteDifference >= 4) {
        // Firing vessel has a silhouette four or more points larger than target ship
        difficulty = "Formidable";
      } else if (silhouetteDifference === 3) {
        // Firing vessel has a silhouette three points larger than the target ship
        difficulty = "Daunting";
      } else if (silhouetteDifference === 2) {
        // Firing vessel has a silhouette two points larger than the target ship
        difficulty = "Hard";
      } else if (silhouetteDifference <= -2) {
        // Firing vessel has a silhouette two or more points smaller than the target vessel
        difficulty = "Easy";
      } else {
        // Firing vessel has the same silhouette as target, or the silhouette is one larger or smaller than the target
        difficulty = "Average";
      }
    }

    // Increase difficulty if the weapon has cumbersome and their brawn is deficient
    if (
      weapon.data?.special?.includes("cumbersome") &&
      record.data?.brawn < (weapon.data?.cumbersome || 0)
    ) {
      difficultyIncrease += Math.abs(
        (weapon.data?.cumbersome || 0) - (record.data?.brawn || 0)
      );
    }

    // Check target's difficultyOfAttacksTargetingYou modifiers
    const difficultyOfAttacksTargetingYouModifiers =
      getEffectsAndModifiersForToken(
        token,
        ["difficultyOfAttacksTargetingYou"],
        isMelee ? "melee" : "ranged"
      );
    difficultyOfAttacksTargetingYouModifiers.forEach((mod) => {
      const modValue = parseInt(mod.value, 10);
      if (modValue > 0 && !isNaN(modValue)) {
        difficultyIncrease += modValue;
      }
    });

    // If this was an auto-fire attack, we need to add a difficulty increase
    if (attackType === "auto-fire") {
      difficultyIncrease += 1;
    }

    // Check for upgradeDifficultyOfAttacksTargetingYou modifiers
    const upgradeDifficultyOfAttacksTargetingYouModifiers =
      getEffectsAndModifiersForToken(
        token,
        ["upgradeDifficultyOfAttacksTargetingYou"],
        isMelee ? "melee" : "ranged"
      );
    let upgradeDifficulty = 0;
    upgradeDifficultyOfAttacksTargetingYouModifiers.forEach((mod) => {
      const modValue = parseInt(mod.value, 10);
      if (modValue > 0 && !isNaN(modValue)) {
        upgradeDifficulty += modValue;
      }
    });

    let modifiers = [];
    attackBonusModifiers.forEach((mod) => {
      // Add attack bonus modifiers to modifiers
      modifiers.push(mod);
    });

    // Add modifiers based on silhouette of target compared to ours
    if (scale === "personal") {
      const silhouetteDifference = ourSilhouetteNumber - targetSilhouetteNumber;

      // If target is 2+ points larger than attacker, decrease difficulty by 1
      if (silhouetteDifference <= -2) {
        modifiers.push({
          name: "Target Silhouette is 2+ Points Larger",
          value: `-1 difficulty`,
          active: true,
        });
      }
      // If target is 2+ points smaller than attacker, increase difficulty by 1
      else if (silhouetteDifference >= 2) {
        modifiers.push({
          name: "Target Silhouette is 2+ Points Smaller",
          value: `+1 difficulty`,
          active: true,
        });
      }
    }

    // Get target's defense and apply as setback
    const targetDefense = isMelee
      ? token?.data?.defenseMelee || 0
      : token?.data?.defenseRanged || 0;
    if (targetDefense > 0) {
      modifiers.push({
        name: "Target Defense",
        value: `${targetDefense} setback`,
        active: true,
      });
    }

    // For vehicles, we don't know the firing arc, so we
    // set each shield defense as an optional setback modifier
    if (token.data?.type === "vehicle") {
      const shieldDefenses = [
        { name: "Fore Defense", value: "defFore" },
        { name: "Aft Defense", value: "defAft" },
        { name: "Port Defense", value: "defPort" },
        { name: "Starboard Defense", value: "defStarboard" },
      ];

      // Check if this is a small ship (silhouette 4 or lower)
      const isSmallShip = targetSilhouetteNumber <= 4;

      // For small ships, find the highest defense and set it as active
      if (isSmallShip) {
        let highestDefense = 0;
        let highestDefenseName = "";

        shieldDefenses.forEach(({ name, value }) => {
          const defenseValue = token.data?.[value] || 0;
          if (defenseValue > highestDefense) {
            highestDefense = defenseValue;
            highestDefenseName = name;
          }
        });

        // Add only the highest defense as active
        if (highestDefense > 0) {
          modifiers.push({
            name: `${highestDefenseName}`,
            value: `${highestDefense} setback`,
            active: true,
          });
        }
      } else {
        // For larger ships (silhouette 5+), all defenses are optional
        shieldDefenses.forEach(({ name, value }) => {
          if (token.data?.[value] && token.data?.[value] > 0) {
            modifiers.push({
              name: name,
              value: `${token.data?.[value] || 0} setback`,
              active: false,
            });
          }
        });
      }
    }

    // Get modifiers for attacksTargetingYou on token
    const attacksTargetingYouModifiers = getEffectsAndModifiersForToken(
      token,
      ["attacksTargetingYou"],
      isMelee ? "melee" : "ranged"
    );
    attacksTargetingYouModifiers.forEach((mod) => {
      modifiers.push(mod);
    });

    const ourTokenId = ourToken?._id;
    const targetId = token?._id;
    const animation = weapon.data?.animation;

    // Get bonuses for other special abilities
    const accurate = weapon.data?.accurate || 0;
    if (accurate > 0) {
      // Accurate adds a boost for each value
      modifiers.push({
        name: "Accurate",
        value: `${accurate} boost`,
        active: true,
      });
    }
    const inaccurate = weapon.data?.inaccurate || 0;
    if (inaccurate > 0) {
      // Inaccurate adds a penalty for each value
      modifiers.push({
        name: "Inaccurate",
        value: `${inaccurate} setback`,
        active: true,
      });
    }

    // Check for superior, which generates automatic advantage on each use
    const isSuperior = weapon.data?.special?.includes("superior");
    if (isSuperior) {
      modifiers.push({
        name: "Superior",
        value: "1 advantage",
        active: true,
      });
    }

    let rollName = attackType === "auto-fire" ? "Auto-Fire Attack" : "Attack";
    if (attackType === "stun-setting") {
      rollName = "Stun Attack";
    }
    let abilityOverride = undefined;
    if (attackType === "guided") {
      rollName = "Guided Attack";
      abilityOverride = weapon.data?.guided || 0;
    }

    rollSkill(
      record,
      skillObj,
      {
        rollName: rollName,
        tooltip: `${rollName} Roll with ${skillObj.name} for ${weapon?.name}`,
        rollType: "attack",
        characteristic: skillObj.data?.stat || "Brawn",
        difficulty: difficulty,
        increaseDifficulty: difficultyIncrease,
        upgradeDifficulty: upgradeDifficulty,
        recordId: record._id,
        tokenId: ourTokenId,
        targetId: targetId,
        animation: animation,
        dataPathToWeapon: dataPathToWeapon,
        attackType: attackType,
        abilityOverride: abilityOverride,
        scale: scale,
        // Send brawn for melee / unarmed attacks
        brawn: record.data?.brawn || 0,
      },
      undefined,
      modifiers
    );
  });

  // Deduce ammo if needed
  const ammo = weapon.data?.ammo || 0;
  if (ammo > 0 && weapon.data?.special?.includes("limited-ammo")) {
    api.setValuesOnRecord(record, {
      [`${dataPathToWeapon}.data.ammo`]: ammo - 1,
    });
  }
}

function getDamageForMacroForAttack({
  record,
  weapon,
  damage = 0,
  // Damage scale (personal for characters, planetary for vehicles)
  scale = "personal",
  damageType = "wounds",
  breach = 0,
  pierce = 0,
}) {
  // Get the weapon's type
  const isMelee = weapon.data?.type === "melee weapon";

  // Get any bonuses or penalties to the damage
  const damageModifiers = getEffectsAndModifiersForToken(
    record,
    ["damageBonus", "damagePenalty"],
    isMelee ? "melee" : "ranged",
    weapon._id,
    undefined,
    weapon
  );
  damageModifiers.forEach((mod) => {
    if (mod.active === true) {
      damage += mod.value;
    }
  });

  return getDamageMacro({ damage, damageType, scale, breach, pierce });
}

function getHealingMacro(healing, deduct = false) {
  // Apply healing to targets -- if deduct is true,
  // then deduct from the healing the amount of stims used today
  return `\`\`\`Apply_Healing
  let targets = api.getSelectedOrDroppedToken();
  targets.forEach(target => {
    const usedStims = target.data?.healingUsed || 0;
    let healingToApply = ${healing};
    const valuesToSet = {};
    const oldValues = {};
    let message = '';
    let deductMessage = '.';
    if (${deduct}) {
      healingToApply -= usedStims;
      oldValues["data.healingUsed"] = usedStims;
      valuesToSet["data.healingUsed"] = usedStims + 1;
      deductMessage = \` (Deducted \${usedStims} stims used today.)\`;
    }
    message += \`Healed \${healingToApply} wounds\${deductMessage}.\\n\`;
    if (healingToApply > 0) {
      // Get healingBonus and penalties for target
      const healingBonus = getEffectsAndModifiersForToken(target, ["healingBonus"]);
      const healingPenalty = getEffectsAndModifiersForToken(target, ["healingPenalty"]);
      const healingBonusValue = healingBonus.reduce((sum, mod) => sum + mod.value, 0);
      const healingPenaltyValue = healingPenalty.reduce((sum, mod) => sum + mod.value, 0);
      const healingValue = healingToApply + Math.abs(healingBonusValue) - Math.abs(healingPenaltyValue);
      oldValues["data.wounds"] = target.data?.wounds;
      oldValues["data.woundsRemaining"] = target.data?.woundsRemaining;
      valuesToSet["data.wounds"] = Math.max(0, target.data?.wounds - healingValue);
      valuesToSet["data.woundsRemaining"] = Math.max(0, target.data?.woundThreshold - valuesToSet["data.wounds"]);
      api.setValuesOnRecord(target, valuesToSet);
      api.floatText(target, '+' + healingValue, "#1bc91b");
    }
    // UNDO macro using api.setValuesOnRecord to avoid race conditions
    const undoMacro = Object.keys(oldValues).length > 0 ? 
  \`\\\`\\\`\\\`Undo
  const oldValuesObj = JSON.parse('\$\{JSON.stringify(oldValues)\}\');
  if (isGM) { 
    api.setValuesOnTokenById('\$\{target._id\}', '\$\{target.recordType\}', oldValuesObj, () => { 
      api.editMessage(null, '~\$\{message.replace(/\\n/g, " ").trim()\}~'); 
    }); 
  } else { 
    api.showNotification('Only the GM can undo healing.', 'yellow', 'Notice'); 
  } 
  \\\`\\\`\\\`\` : '';

    api.sendMessage(\`\${message.trim()}\\n\${undoMacro ? '\\n' + undoMacro : ''}\`, undefined, undefined, undefined, target);

  });
  \`\`\``;
}

function targetHasCortosis(target) {
  // Get best equipped armor
  const bestArmor = getBestArmor(target);
  if (!bestArmor.armor) {
    return false;
  }

  // Check if the best armor is cortosis
  const special = bestArmor.armor?.data?.special || [];
  return special.includes("cortosis");
}

function getDamageMacro({
  damage,
  damageType = "wounds",
  scale = "personal",
  breach = 0,
  pierce = 0,
}) {
  let macroName = damageType === "wounds" ? "Apply_Damage" : "Apply_Strain";
  if (damageType === "blast") {
    macroName = "Apply_Blast_Damage";
    damageType = "wounds";
  }
  return `\`\`\`${macroName}
  const scale = "${scale}";
  let targets = api.getSelectedOrDroppedToken();
  targets.forEach(target => {
    let damageToApply = ${damage};
    const damageType = "${damageType}";
    const valuesToSet = {};
    // Damage is reduced by target's soak value
    let soakValue = target.data?.soakValue || 0;

    // If the scale is personal, and the target is a vehicle,
    // we multiply the soakValue by 10 (because armor is technically 10x soak)
    if (scale === "personal" && target.data?.type === "vehicle") {
      soakValue = soakValue * 10;
    }
    else if (scale === "planetary" && target.data?.type !== "vehicle") {
      // If the scale is planetary, and the target is not a vehicle,
      // we multiply the damage by 10 (because vehicles do 10x damage)
      damageToApply = damageToApply * 10;
    }

    // Breach ignores vehicle 1 armor and 10 soak
    // for each point of breach
    let breachValue = ${breach};
    // Pierce ignores 1 soak for each point unless cortosis
    let pierceValue = ${pierce};
    if (target.data?.type !== "vehicle") {
      // In personal scale, breach ignores 10x 
      breachValue = 10 * breachValue;
    }
    // Check if the target has cortosis armor before applying breach or pierce
    const hasCortosis = targetHasCortosis(target);
    if (breachValue > 0 && !hasCortosis) {
      soakValue = Math.max(0, soakValue - breachValue);
    }
    if (pierceValue > 0 && !hasCortosis) {
      soakValue = Math.max(0, soakValue - pierceValue);
    }

    // minions and rivals don't have strain
    const isMinionOrRival = target.recordType === "npcs" && 
      (!target.data?.type || target.data?.type === "minion" || target.data?.type === "rival");
    const isMinion = target.recordType === "npcs" && 
      (!target.data?.type || target.data?.type === "minion");

    const damageValue = Math.max(0, damageToApply - soakValue);
    const oldValues = {};
    let damageMessage = damageType === "wounds" ? "damage" : "strain";
    if (damageMessage === "strain" && isMinionOrRival) {
      damageMessage = "strain as wounds";
    }
    let soakMessage = soakValue > 0 ? \` (\${soakValue} absorbed by Soak.)\` : '.';
    if (target.data?.type === "vehicle") {
      soakMessage = soakValue > 0 ? \` (\${soakValue} absorbed by Armor.)\` : '.';
    }
    let message = \`Took \${damageValue} \${damageMessage}\${soakMessage}\\n\`;

    let minionRemainingMessage = '';
    let addDeadEffect = false;
    let addUnconsciousEffect = false;

    if (damageValue > 0 && (damageType === "wounds" || isMinionOrRival)) {
      const woundThreshold = parseInt(target.data?.woundThreshold || "0", 10);
      const wounds = parseInt(target.data?.wounds || "0", 10);
      const woundsRemaining = parseInt(target.data?.woundsRemaining !== undefined ? target.data?.woundsRemaining : woundThreshold, 10);
      oldValues["data.wounds"] = wounds;
      oldValues["data.woundsRemaining"] = woundsRemaining;
      valuesToSet["data.wounds"] = wounds + damageValue;
      valuesToSet["data.woundsRemaining"] = Math.max(0, woundsRemaining - valuesToSet["data.wounds"]);
      
      // If this is a minion, recalculate thresholds to update skill ranks
      if (isMinion) {
        recalculateThresholds(target, valuesToSet);
      }
      
      api.setValuesOnRecord(target, valuesToSet);
      api.floatText(target, '+' + damageValue, "#FF0000");
      if (isMinionOrRival) {
        const woundsPerMinion = parseInt(target.data?.woundsPerMinion || "0", 10);
        const totalWounds = wounds + damageValue;
        const minionsDefeated = Math.max(0, Math.floor((totalWounds - 1) / woundsPerMinion));
        const totalMinions = Math.ceil(woundThreshold / woundsPerMinion);
        let minionsRemaining = Math.max(0, totalMinions - minionsDefeated);
        
        // If wounds exceeds threshold, all minions are dead
        if (totalWounds > woundThreshold) {
          minionsRemaining = 0;
        }
        
        if (isMinion) {
          if (minionsRemaining > 0) {
            minionRemainingMessage = \`\n\nMinions remaining: \${minionsRemaining}\`;
          } else {
            minionRemainingMessage = \`\n\nAll minions are dead.\`;
          }
        }
        
        if (totalWounds > woundThreshold) {
          if (isMinion) {
            minionsRemaining = 0;
            minionRemainingMessage = \`\n\nAll minions are dead.\`;
          }
          addDeadEffect = true;
        } else if (isMinion && minionsRemaining <= 0) {
          minionsRemaining = 0;
          minionRemainingMessage = \`\n\nAll minions are dead.\`;
        }
        message += minionRemainingMessage;
      }
      else {
        // Check if we need to add unconscious effect
        if (wounds + damageValue > woundThreshold) {
          addUnconsciousEffect = true;
        }
      }
    }
    else if (damageValue > 0 && damageType === "stun") {
      const strainThreshold = parseInt(target.data?.strainThreshold || "0", 10);
      const strainRemaining = parseInt(target.data?.strainRemaining !== undefined ? target.data?.strainRemaining : strainThreshold, 10);
      const strain = parseInt(target.data?.strain || "0", 10);  
      oldValues["data.strain"] = strain;
      oldValues["data.strainRemaining"] = strainRemaining;
      valuesToSet["data.strain"] = strain + damageValue;
      valuesToSet["data.strainRemaining"] = Math.max(0, strainRemaining - valuesToSet["data.strain"]);
      api.setValuesOnRecord(target, valuesToSet);
      api.floatText(target, '+' + damageValue + ' Strain', "#0000FF");
      // Check if we need to add unconscious effect
      if (strain + damageValue > strainThreshold) {
        addUnconsciousEffect = true;
      }
    }
    else {
      api.floatText(target, 'Absorbed by Soak', "#0000FF");
    }

    // UNDO macro using api.setValuesOnRecord to avoid race conditions
    const undoMacro = Object.keys(oldValues).length > 0 ? 
  \`\\\`\\\`\\\`Undo
  const oldValuesObj = JSON.parse('\$\{JSON.stringify(oldValues)\}\');
  if (isGM) { 
    api.setValuesOnTokenById('\$\{target._id\}', '\$\{target.recordType\}', oldValuesObj, () => { 
      api.editMessage(null, '~\$\{message.replace(/\\n/g, " ").trim()\}~'); 
    }); 
  } else { 
    api.showNotification('Only the GM can undo damage.', 'yellow', 'Notice'); 
  } 
  \\\`\\\`\\\`\` : '';

    if (addDeadEffect) {
      api.addEffect("Dead", target);
    } else if (addUnconsciousEffect) {
      api.addEffect("Unconscious", target);
    }

    api.sendMessage(\`\${message.trim()}\\n\${undoMacro ? '\\n' + undoMacro : ''}\`, undefined, undefined, undefined, target);
  });
  \`\`\``;
}

function getSkillCheckMacro(skillCheck) {
  return `\`\`\`Roll_${skillCheck.trim().replace(/ /g, "_")}_Check
  let targets = api.getSelectedOrDroppedToken();
  targets.forEach(target => {
    // Try to find the skill in the character's skills
    const skill = target.data?.skills?.find(skill => skill.name === "${skillCheck}");
    if (skill) {
      rollSkill(target, skill);
    } else {
      api.showNotification(
        'No skill found for ${skillCheck}. Add the Skill to their sheet and try again.',
        "red",
        "Skill Not Found"
      );
    }
  });
  \`\`\``;
}

function getEffectMacroByName(name, duration, value = undefined) {
  return `\`\`\`Apply_${name.replace(/ /g, "_")}
let targets = api.getSelectedOrDroppedToken();
targets.forEach(target => {
  api.addEffect('${name}', target, ${duration}, ${value});
});
\`\`\``;
}

function getEffectMacros(effects) {
  // If we're using a potion with an effect or healing, add the buttons
  if (effects) {
    // Create macros for all effects that this action can apply
    let effectButtons = "";
    effects.forEach((effectJson) => {
      const effect = JSON.parse(effectJson);
      const effectName = effect?.name || "";
      const effectID = effect?._id || "";
      const effectTitle = `Apply_${effectName.replace(/ /g, "_")}`;
      if (effectButtons !== "") {
        effectButtons += "\n";
      }
      effectButtons += `\`\`\`${effectTitle}
    let targets = api.getSelectedOrDroppedToken();
    targets.forEach(target => {
      api.addEffectById('${effectID}', target);
    });
    \`\`\``;
    });

    return effectButtons;
  } else {
    return "";
  }
}

function useItem(record, itemDataPath) {
  // Deduct count by 1, delete item if count is 0,
  // and output the description to Chat
  // Include macros to relevant fields
  const itemName = api.getValueOnRecord(record, `${itemDataPath}.name`);
  const itemCount = api.getValueOnRecord(record, `${itemDataPath}.data.count`);
  const indexValue = parseInt(itemDataPath.split(".").pop());
  const isConsumable =
    api.getValueOnRecord(record, `${itemDataPath}.data.consumable`) || false;

  // Output the description to Chat
  let description =
    api.getValueOnRecord(record, `${itemDataPath}.data.description`) || "";
  let effects =
    api.getValueOnRecord(record, `${itemDataPath}.data.effects`) || [];
  const itemType = api.getValueOnRecord(record, `${itemDataPath}.data.type`);

  const skillCheck = api.getValueOnRecord(
    record,
    `${itemDataPath}.data.skillCheck`
  );

  const healing = api.getValueOnRecord(record, `${itemDataPath}.data.healing`);
  let damage = api.getValueOnRecord(record, `${itemDataPath}.data.useDamage`);
  const portrait = api.getValueOnRecord(record, `${itemDataPath}.portrait`);

  const itemIcon = portrait
    ? `![${itemName}](${assetUrl}${portrait}?width=40&height=40) `
    : "";
  const itemDescription = api.richTextToMarkdown(description || "");
  let markdownDescription = `
  #### ${itemIcon}${itemName}

  ---
  ${itemDescription}
  `;

  // If there is healing, get the healing macro
  const deductStimUses =
    api.getValueOnRecord(record, `${itemDataPath}.data.countsAsHealing`) ===
    true;
  const healingValue = healing
    ? parseInt(checkForReplacements(healing, {}, record), 10)
    : 0;
  const healingMacro =
    healingValue > 0 ? getHealingMacro(healingValue, deductStimUses) : "";

  // If there is damage, get the damage macro
  const damageValue = damage
    ? parseInt(checkForReplacements(damage, {}, record), 10)
    : 0;
  // If this is being used by a vehicle, use the planetary damage macro
  let scale = "personal";
  if (record.data?.type === "vehicle") {
    scale = "planetary";
  }
  const damageMacro =
    damageValue > 0 ? getDamageMacro({ damage: damageValue, scale }) : "";

  // If there is skill check, get the skill check macro
  const skillCheckMacro = skillCheck ? getSkillCheckMacro(skillCheck) : "";

  // Get effect macros
  const effectMacros = getEffectMacros(effects);

  let message = markdownDescription;
  if (healingMacro) {
    message += `\n${healingMacro}`;
  }
  if (damageMacro) {
    message += `\n${damageMacro}`;
  }
  if (skillCheckMacro) {
    message += `\n${skillCheckMacro}`;
  }
  if (effectMacros) {
    message += `\n${effectMacros}`;
  }

  api.sendMessage(message, undefined, []);

  // If consumable, delete item if count is 0
  if (isConsumable) {
    const count = parseFloat(itemCount || "0");
    if (count - 1 > 0) {
      api.setValuesOnRecord(record, {
        [`${itemDataPath}.data.count`]: count - 1,
      });
    } else if (!isNaN(indexValue)) {
      api.removeValueFromRecord(record, `data.inventory`, indexValue);
    }
  }
}

function getGuidedMacro(dataPathToWeapon) {
  // This is a macro that rolls an attack again
  // with the same weapon but using the guided rating
  // as the ability dice
  return `\`\`\`Roll_Guided_Attack
const selectedTokens = api.getSelectedOrDroppedToken();
selectedTokens.forEach(token => {
  const weapon = api.getValueOnRecord(token, "${dataPathToWeapon}");
  if (weapon) {
    rollAttack(token, weapon, "${dataPathToWeapon}", "guided");
  } else {
    api.showNotification(
      'Guided weapon was not found. Make sure the correct token is selected and try again.',
      "red",
      "Weapon Not Found"
    );
  }
});
\`\`\``;
}
