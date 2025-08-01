// Roll handler for critical injuries
const metadata = data?.roll?.metadata;
let rollName = metadata?.rollName || "Critical Hit";
let tooltip = metadata?.tooltip || "Critical Hit Roll";

const critType = metadata?.critType;

let tags = [
  {
    name: rollName,
    tooltip: tooltip,
  },
];

let message = "**[center]Critical Hit Inflicted[/center]**";

const sendFinalMessage = () => {
  api.sendMessage(message, data?.roll, [], tags);
};

const total = data?.roll?.total || 0;

// Show both tables if critType is not set
let tablesRequired = ["Critical Injury Result", "Critical Hit Result"];
if (critType === "injury") {
  tablesRequired = ["Critical Injury Result"];
} else if (critType === "hit") {
  tablesRequired = ["Critical Hit Result"];
}

// Function to process a table and get the result
const processTable = (tableName, callback) => {
  api.getRecordByTypeAndName("tables", tableName, (table) => {
    if (!table) {
      api.showNotification(
        `No table found for ${tableName}. You may need to import the module that contains this table.`,
        "red",
        "Table Not Found"
      );
      sendFinalMessage();
      return;
    }

    // Get the result from the table
    const result = getResultFromTable(table, total);
    if (!result || !result.columns || !result.columns.length) {
      api.showNotification(
        `Error finding result for ${tableName} with total ${total}.`,
        "red",
        "Invalid Critical Injury"
      );
      sendFinalMessage();
      return;
    }

    const injuryRecordLink =
      result.columns[1]?.recordLink || result.columns[0]?.recordLink;

    if (!injuryRecordLink) {
      api.showNotification(
        `Error finding injury for ${tableName} with total ${total}.`,
        "red",
        "Invalid Critical Injury"
      );
      sendFinalMessage();
      return;
    }

    // Get the result info from the first column
    const injuryResult = result.columns[1]?.text;
    const injuryId = injuryRecordLink.value._id;
    const injuryName = injuryRecordLink.tooltip;

    callback({
      tableName,
      injuryResult,
      injuryId,
      injuryName,
      result,
    });
  });
};

// Process tables sequentially
let currentTableIndex = 0;
let allMacros = [];

const processNextTable = () => {
  if (currentTableIndex >= tablesRequired.length) {
    // All tables processed, now add all macros to the message
    allMacros.forEach((macro) => {
      message += `\n\n${macro}`;
    });

    // Send final message
    sendFinalMessage();
    return;
  }

  const tableName = tablesRequired[currentTableIndex];

  processTable(tableName, (tableData) => {
    // Add the result to the message
    message += `\n\n**[center]${tableData.tableName}[/center]**\n\n[center]${
      tableData.injuryResult ? tableData.injuryResult : tableData.injuryName
    }[/center]`;

    // Build macro to apply the injury
    const macro = `
\`\`\`Apply_${tableData.injuryName.replaceAll(" ", "_")}
let targets = api.getSelectedOrDroppedToken();

// If record is not null, check if we're the GM or owner and use it
if (record) {
  if (isGM || record?.record?.ownerId === userId) {
    targets = [record];
  }
}

// If we're a player and we did not drop on a record, get our owned tokens
if (!isGM && targets.length === 0) {
    targets = api.getSelectedOwnedTokens().map(target => target.token);
}

// First re-query the injury record
api.getRecord('conditions', '${tableData.injuryId}', (injuryRecord) => {
  if (injuryRecord) {
    const injuryRecordLink = {
      value: injuryRecord,
      tooltip: injuryRecord?.name || "Injury",
    };
    targets.forEach(target => {
      // Add strain if set
      const strain = injuryRecord?.data?.strain || 0;
      // Minions and rivals don't have strain
      const isMinionOrRival = target.recordType === "npcs" && 
        (!target.data?.type || target.data?.type === "minion" || target.data?.type === "rival");
      const isMinion = target.recordType === "npcs" && 
        (!target.data?.type || target.data?.type === "minion");
      if (strain > 0 && !isMinionOrRival) {
        let valuesToSet = {
          'data.strain': (target.data?.strain || 0) + strain,
          'data.strainRemaining': (target.data?.strainThreshold || 0) - ((target.data?.strain || 0) + strain),
        };
        api.floatText(target, '+' + strain + ' Strain', "#0000FF");
        api.setValuesOnRecord(target, valuesToSet, () => {
          addCondition(target, injuryRecordLink);
        });
      }
      else if (isMinionOrRival) {
        // Apply wounds if minion or rival
        let valuesToSet = {
          'data.wounds': (target.data?.wounds || 0) + strain,
          'data.woundsRemaining': (target.data?.woundThreshold || 0) - ((target.data?.wounds || 0) + strain),
        };
        // Also, if this is a minion, a critical injury inflicts wounds equal to 1 minion's worth + 1 (so it exceeds the threshold)
        let additionalWounds = 0;
        if (isMinion) {
          additionalWounds = (target.data?.woundsPerMinion || 0) + 1;
        }
        valuesToSet['data.wounds'] += additionalWounds;
        valuesToSet['data.woundsRemaining'] -= additionalWounds;
        
        // If this is a minion, recalculate thresholds to update skill ranks
        if (isMinion) {
          recalculateThresholds(target, valuesToSet);
        }
        
        if (strain + additionalWounds > 0) {
          api.floatText(target, '+' + (strain + additionalWounds), "#FF0000");
        }
        api.setValuesOnRecord(target, valuesToSet, () => {
          addCondition(target, injuryRecordLink);
        });
      }
      else {
        addCondition(target, injuryRecordLink);
      }
    });
  }
});
\`\`\``;

    // Store the macro for later
    allMacros.push(macro);

    // Move to next table
    currentTableIndex++;
    processNextTable();
  });
};

// Start processing tables
processNextTable();
