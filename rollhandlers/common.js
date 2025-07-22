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
  ammoItem = undefined
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
  const species = target?.data?.species || [];
  const careers = target?.data?.careers || [];
  const talents = [];
  // Each career has a career tree, which has a list of talents
  careers.forEach((career) => {
    const careerTree = career.data?.talentTree || [];
    careerTree.forEach((talent) => {
      if (talent.data?.active) {
        talents.push(talent);
      }
    });
  });

  // Ensure items is an array before filtering
  const items = Array.isArray(target?.data?.inventory)
    ? target?.data?.inventory
    : [];

  // Get all career features
  const classes = target?.data?.classes || [];
  const classFeatures = [];
  classes.forEach((c) => {
    const features = c.data?.features || [];
    features.forEach((feature) => {
      classFeatures.push(feature);
    });
  });

  // Get all species features
  const speciesFeatures = [];
  species.forEach((s) => {
    const features = s.data?.talentTree || [];
    features.forEach((feature) => {
      speciesFeatures.push(feature);
    });
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

  // Filter items that are not equipped
  const equippedItems = items.filter(
    (item) => item.data?.carried === "equipped"
  );
  [
    ...classFeatures,
    ...speciesFeatures,
    ...talents,
    ...equippedItems,
    ...npcFeatures,
    ...activeAttachments,
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
    const armorSoak = parseInt(record?.data?.armorSoak || "0", 10);
    const soakValue = parseInt(value || "0", 10) + armorSoak;
    valuesToSet["data.soakValue"] = soakValue;

    // Update wounds remaining with current threshold
    const currentWounds = parseInt(record?.data?.wounds || "0", 10);
    const woundThreshold = parseInt(record?.data?.woundThreshold || "0", 10);
    valuesToSet["data.woundsRemaining"] = Math.max(
      0,
      woundThreshold - currentWounds
    );
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

function recalculateThresholds(record, moreValuesToSet = undefined) {
  const valuesToSet = moreValuesToSet || {};

  // Get species data
  const species = record?.data?.species?.[0];
  const speciesWoundThreshold = species?.data?.woundThreshold || 10;
  const speciesStrainThreshold = species?.data?.strainThreshold || 10;

  // Recalculate wound threshold
  const brawn = parseInt(record?.data?.brawn || "0", 10);
  valuesToSet["data.woundThreshold"] = speciesWoundThreshold + brawn;

  // Recalculate strain threshold
  const willpower = parseInt(record?.data?.willpower || "0", 10);
  valuesToSet["data.strainThreshold"] = speciesStrainThreshold + willpower;

  // Recalculate soak value
  const armorSoak = parseInt(record?.data?.armorSoak || "0", 10);
  valuesToSet["data.soakValue"] = brawn + armorSoak;

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
    ["abilityBonus", "abilityPenalty"],
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

function rollSkill(record, skill) {
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

  const metadata = {
    rollName: `${skill.name}`,
    tooltip: `${skill.name} Skill Check Roll`,
    characteristic: attributeValue,
    skillRank: skillRank,
    attributeName: skill.data?.stat || "Brawn",
  };

  const modifiers = getEffectsAndModifiersForToken(
    record,
    ["skillBonus", "skillPenalty"],
    skill.name
  );

  // Star Wars RPG narrative dice system
  api.promptRoll(
    `${skill.name} Check`,
    diceString,
    modifiers,
    metadata,
    "skill"
  );
}
